const Sale = require('../../models/Sales/salesModel');
const Inventory = require('../../models/inventory/inventoryModel');
const SaleDummy = require('../../models/Sales/salesDummyModel');
const InvoiceCounter = require('../../models/Sales/invoiceCounterModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');
const PDFDocument = require('pdfkit');
const { misData } = require('../../middlewares/upload/upload');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

exports.fetchSales = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      itemId,
      startDate,
      endDate,
      userId,
      invoiceNumber,
    } = req.query;
    const query = { isDeleted: false };
    if (itemId) {
      query.itemId = itemId;
    } else {
      query.orderType = 'Sales';
    }
    if (userId) {
      query.createdBy = userId;
    }
    if (startDate && endDate) {
      query.saleDate = {
        $gte: moment.tz(startDate, 'Asia/Kolkata').utc().toDate(),
        $lte: moment.tz(endDate, 'Asia/Kolkata').utc().toDate(),
      };
    }
    if (search) {
      query.orderType = {
        $regex: search,
        $options: 'i',
      };
    }
    if (invoiceNumber) {
      query.invoiceNumber = invoiceNumber;
      // query.createdBy = req.user._id;
    }
    const populate = [{ path: 'itemId', select: 'itemName' }];
    const sales = await pagination(
      Sale,
      query,
      page,
      limit,
      null,
      null,
      populate
    );
    sales.result = await Promise.all(
      sales.result.map(async (item) => {
        const totalPrice = (
          parseFloat(item.pricePerUnit) * parseFloat(item.quantity)
        ).toFixed(2);
        if (item.discount === '') {
          item.discount = 0;
        }
        return {
          ...item.toObject(),
          totalPrice: totalPrice - parseFloat(item.discount),
        };
      })
    );
    return successResponse(res, 'Sales fetched successfully', sales);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.fetchSalesById = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await Sale.findOne({ _id: id, isDeleted: false }).populate(
      'itemId'
    );
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    if (sales.orderType === 'Opening') {
      return badRequestErrorResponse(res, 'Opening stock cannot be updated');
    }
    return successResponse(res, 'Sales fetched successfully', sales);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.createSales = async (req, res) => {
  try {
    const {
      quantity,
      pricePerUnit,
      description,
      saleDate,
      itemId,
      customerName,
      discount,
      totalAmount,
      invoiceNumber,
    } = req.body;
    // await updateInvoiceNumber(invoiceNumber);
    let sales = await SaleDummy.create({
      orderType: 'Sales',
      quantity,
      pricePerUnit,
      description,
      saleDate: (() => {
        const datePart = moment.tz(saleDate, 'Asia/Kolkata');
        const currentTime = moment.tz('Asia/Kolkata');
        datePart.set({
          hour: currentTime.hour(),
          minute: currentTime.minute(),
          second: currentTime.second(),
        });
        return datePart.toDate();
      })(),
      itemId,
      customerName,
      discount,
      totalAmount:parseFloat(pricePerUnit * quantity),
      invoiceNumber,
      createdBy: req.user._id,
    });
    const sale = await SaleDummy.findById({ _id: sales._id })
      .populate({ path: 'itemId' })
      .populate({ path: 'createdBy' });
    return successResponse(res, 'Sales created successfully', sale);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.createFinalSales = async (req, res) => {
  try {
    const { listSales } = req.body;
    let invoiceNumber = req.query.invoiceNumber;

    invoiceNumber = await updateInvoiceNumber(invoiceNumber);
    const sales = [];
    for (const item of listSales) {
      const dummySales = await SaleDummy.findOne({ _id: item });
      if (!dummySales) {
        return badRequestErrorResponse(res, 'Sales not found');
      }
      const sale = await Sale.create({
        orderType: 'Sales',
        quantity: dummySales.quantity,
        pricePerUnit: dummySales.pricePerUnit,
        description: dummySales.description,
        saleDate: new Date(dummySales.saleDate),
        itemId: dummySales.itemId,
        customerName: dummySales.customerName,
        discount: dummySales.discount,
        totalAmount: dummySales.totalAmount,
        invoiceNumber: invoiceNumber,
        createdBy: req.user._id,
      });

      await SaleDummy.findByIdAndDelete(dummySales._id);
      sales.push(sale._id);
    }

    return successResponse(res, 'Sales created successfully', sales);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.fetchDummySales = async (req, res) => {
  try {
    const { invoiceNumber } = req.query;
    let sales = await SaleDummy.find({
      invoiceNumber: invoiceNumber,
      createdBy: req.user._id,
    })
      .populate('itemId')
      .populate('createdBy');
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    let totalBill = 0;
    sales = await Promise.all(
      sales.map(async (item) => {
        const totalPrice = (
          parseFloat(item.pricePerUnit) * parseFloat(item.quantity)
        ).toFixed(2);
        if (item.discount === '') {
          item.discount = 0;
        }
        totalBill = totalBill + (totalPrice - parseFloat(item.discount));
        return {
          ...item.toObject(),
          totalPrice: totalPrice - parseFloat(item.discount),
        };
      })
    );
    return successResponse(res, 'Sales fetched successfully', {
      sales,
      totalBill,
    });
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.fetchDummySalesById = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await SaleDummy.findOne({ _id: id }).populate('itemId');
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    return successResponse(res, 'Sales fetched successfully', sales);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.updateSalesDummy = async (req, res) => {
  try {
    const {
      quantity,
      pricePerUnit,
      description,
      saleDate,
      itemId,
      customerName,
      discount,
      totalAmount,
      invoiceNumber,
    } = req.body;
    const { id } = req.params;
    let sales = await SaleDummy.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          orderType: 'Sales',
          quantity,
          pricePerUnit,
          description,
          saleDate: (() => {
            const datePart = moment.tz(saleDate, 'Asia/Kolkata');
            const currentTime = moment.tz('Asia/Kolkata');
            datePart.set({
              hour: currentTime.hour(),
              minute: currentTime.minute(),
              second: currentTime.second(),
            });
            return datePart.toDate();
          })(),
          itemId,
          customerName,
          discount,
          totalAmount,
          invoiceNumber,
          createdBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    );
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    return successResponse(res, 'Sales updated successfully', sales);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.deleteSalesDummy = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await SaleDummy.findOne({ _id: id });
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    await SaleDummy.findByIdAndDelete(id);
    return successResponse(res, 'Sales deleted successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.updateSales = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      quantity,
      pricePerUnit,
      description,
      saleDate,
      itemId,
      customerName,
      discount,
      totalAmount,
    } = req.body;
    const sales = await Sale.findById(id);
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    if (sales.orderType === 'Opening') {
      return badRequestErrorResponse(res, 'Opening stock cannot be updated');
    }
    if (sales.orderType === 'Sales') {
      const updatedSales = await Sale.findByIdAndUpdate(
        id,
        {
          orderType: 'Sales',
          quantity,
          pricePerUnit,
          description,
          saleDate: new Date(saleDate),
          itemId,
          customerName,
          discount,
          totalAmount,
        },
        { new: true, runValidators: true }
      );
      return successResponse(res, 'Sales updated successfully', updatedSales);
    }
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.deleteSales = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await Sale.findById(id);
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    if (sales.orderType === 'Opening') {
      return badRequestErrorResponse(res, 'Opening stock cannot be deleted');
    }
    if (sales.orderType === 'Sales') {
      await Sale.updateMany(
        { invoiceNumber: sales.invoiceNumber },
        { $set: { isDeleted: true } },
        { new: true, runValidators: true }
      );
      await InvoiceCounter.deleteOne({
        invoiceNumber: sales.invoiceNumber,
      });
    }
    return successResponse(res, 'Sales deleted successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const { listSales } = req.body;

    if (!listSales || !Array.isArray(listSales) || listSales.length === 0) {
      return badRequestErrorResponse(res, 'No sales provided');
    }
    const salesData = await Sale.find({
      _id: { $in: listSales },
    })
      .populate('itemId')
      .populate('createdBy');

    if (!salesData || salesData.length === 0) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    const invoiceNumber = salesData[0].invoiceNumber;
    const outputPath = path.join(__dirname, `invoice-${invoiceNumber}.pdf`);
    await createInvoicePDF(salesData, outputPath);
    const s3Url = await misData(outputPath);
    fs.unlinkSync(outputPath);

    return successResponse(res, 'Invoice downloaded successfully', s3Url);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.deleteSalesAll = async (req, res) => {
  try {
    const { startDate, endDate, userId, invoiceNumber } = req.query;
    const query = { isDeleted: false };
    if (startDate && endDate) {
      query.createdAt = {
        $gte: moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate(),
        $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate(),
      };
    }
    query.orderType = 'Sales';
    if (userId) {
      query.createdBy = userId;
    }
    if (invoiceNumber) {
      query.invoiceNumber = invoiceNumber;
    }
    const sales = await Sale.find(query);
    const invoiceNumbers = [
      ...new Set(sales.map((sale) => sale.invoiceNumber)),
    ];
    await Sale.updateMany(
      query,
      { $set: { isDeleted: true } },
      { new: true, runValidators: true }
    );
    if (invoiceNumbers.length > 0) {
      await InvoiceCounter.deleteMany({
        invoiceNumber: { $in: invoiceNumbers },
      });
    }
    return successResponse(res, 'All Sales deleted successfully ');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
async function generateInvoiceNumber() {
  const latestSale = await Sale.findOne({
    orderType: 'Sales',
    isDeleted: false,
  }).sort({
    _id: -1,
  });
  if (latestSale && !isNaN(latestSale.invoiceNumber)) {
    return latestSale.invoiceNumber + 1;
  }
  return 1;
}

exports.fetchInvoiceNumber = async (req, res) => {
  try {
    const invoice = await generateInvoiceNumber();
    return successResponse(res, 'Invoice number fetched successfully', invoice);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.fetchSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const query = { isDeleted: false, orderType: 'Sales' };
    if (userId) {
      query.createdBy = userId;
    }
    if (startDate && endDate) {
      query.saleDate = {
        $gte: moment
          .tz(startDate, 'DD-MM-YYYY', 'Asia/Kolkata')
          .startOf('day')
          .toDate(),
        $lte: moment
          .tz(endDate, 'DD-MM-YYYY', 'Asia/Kolkata')
          .endOf('day')
          .toDate(),
      };
    }
    const sales = await Sale.find(query)
      .populate('itemId')
      .populate('createdBy')
      .sort({ createdAt: -1 });
    const invoiceMap = new Map();
    sales.forEach((sale) => {
      const invoiceNumber = sale.invoiceNumber;
      const customerName = sale.customerName || 'N/A';
      const saleCreatedBy = sale.createdBy?._id;
      const key = `${invoiceNumber}-${saleCreatedBy}`;
      const price = parseFloat(sale.pricePerUnit || 0);
      const qty = parseInt(sale.quantity, 10) || 0;
      const amount = price * qty;
      if (!invoiceMap.has(key)) {
        invoiceMap.set(key, {
          invoiceNumber,
          customerName,
          saleDate: sale.saleDate,
          totalAmount: 0,
        });
      }
      const invoiceData = invoiceMap.get(key);
      invoiceData.totalAmount += amount;
    });
    const uniqueInvoices = Array.from(invoiceMap.values());
    return successResponse(res, 'Sales report fetched successfully', {
      count: uniqueInvoices.length,
      invoices: uniqueInvoices,
    });
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

async function updateInvoiceNumber(invoiceNumber) {
  const isinvoiceNumber = await InvoiceCounter.findOne({
    invoiceNumber: invoiceNumber,
  });
  if (isinvoiceNumber) {
    let invoiceNumbergen = await generateInvoiceNumber();
    await InvoiceCounter.findOneAndUpdate(
      {},
      { $set: { invoiceNumber: invoiceNumbergen } },
      { upsert: true }
    );
    return invoiceNumbergen;
  }
  await InvoiceCounter.findOneAndUpdate(
    {},
    { $set: { invoiceNumber: invoiceNumber } },
    { upsert: true }
  );
  return invoiceNumber;
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
  }
  return 0;
}
function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
  }
  return 0;
}



exports.downloadSalesReport = async (req, res) => {
  try {
    const {
      format = 'pdf',
      headers = [],
      startDate,
      endDate,
      userId,
      search,
      type = 'Sale',
    } = req.body;
    if (type === 'Sale') {
      const query = { isDeleted: false, orderType: 'Sales' };
      if (userId) {
        query.createdBy = userId;
      }
      if (startDate && endDate) {
        query.saleDate = {
          $gte: moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate(),
          $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate(),
        };
      }
      const sales = await Sale.find(query)
        .populate('itemId')
        .populate('createdBy')
        .sort({ createdAt: -1 });

      const invoiceMap = new Map();
      sales.forEach((sale) => {
        const invoiceNumber = sale.invoiceNumber;
        const saleCreatedBy = sale.createdBy?._id;
        const key = `${invoiceNumber}-${saleCreatedBy}`;
        const price = parseFloat(sale.pricePerUnit || 0);
        const qty = parseInt(sale.quantity, 10) || 0;
        const amount = price * qty;

        if (!invoiceMap.has(key)) {
          invoiceMap.set(key, {
            invoiceNumber,
            saleDate: sale.saleDate,
            customerName: sale.customerName || '-',
            createdBy: sale.createdBy?.name || '-',
            totalAmount: 0,
            items: [],
          });
        }

        const invoiceData = invoiceMap.get(key);
        invoiceData.items.push({
          itemName: sale.itemId?.itemName || '-',
          quantity: qty,
          pricePerUnit: price,
          amount: amount.toFixed(2),
        });
        invoiceData.totalAmount += amount;
      });

      const uniqueInvoices = Array.from(invoiceMap.values());
      const fileName = `sales-report-${Date.now()}.${format}`;
      const outputPath = path.join(__dirname, fileName);

      if (format === 'pdf') {
        await createSalesReportPDF(uniqueInvoices, headers, outputPath, type);
      } else if (format === 'csv') {
        await createSalesReportCSV(uniqueInvoices, headers, outputPath, type);
      } else {
        return badRequestErrorResponse(
          res,
          'Invalid format. Use "pdf" or "csv".'
        );
      }

      const s3Url = await misData(outputPath);
      fs.unlinkSync(outputPath);
      return successResponse(
        res,
        'Sales report downloaded successfully',
        s3Url
      );
    } else if (type === 'Inventory') {
      const { qty, outOfStock, inActive } = req.query;
      const query = {};
      if (startDate && endDate) {
        query.createdAt = {
          $gte: moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate(),
          $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate(),
        };
      }
      let inventory = await Inventory.find(query).sort({
        createdAt: -1,
      });
      inventory = await Promise.all(
        inventory.map(async (item) => {
          let openingStock = await Sale.findOne({
            orderType: 'Opening',
            itemId: item._id,
          }).sort({ createdAt: 1 });
          const sales = await Sale.find({ itemId: item._id }).sort({
            createdAt: 1,
          });
          let currentQuantity = 0;
          let currentStockValue = 0;
          let lastSaleDate = null;
          sales.forEach((sale) => {
            const quantitySet = parseInt(sale.quantity, 10) || 0;
            const pricePerUnit = parseFloat(sale.pricePerUnit);
            if (sale.orderType === 'Sales' && lastSaleDate === null) {
              lastSaleDate = sale.createdAt;
            }
            switch (sale.orderType) {
              case 'Opening': 
              case 'Add': 
                currentQuantity += quantitySet;
                currentStockValue += Math.abs(quantitySet * pricePerUnit);
                break;
              case 'Reduce': {
                currentQuantity -= quantitySet;
                currentStockValue -= quantitySet * pricePerUnit;
                break;
              }
              case 'Sales': {
                if (currentQuantity <= 0) break;
                const avgCost = currentStockValue / currentQuantity;
                const costOfGoodsSold = quantitySet * avgCost;
                currentQuantity -= quantitySet;
                currentStockValue -= costOfGoodsSold;
                break;
              }
              default:
                break;
            }
            currentQuantity = currentQuantity;
            currentStockValue = currentQuantity <= 0 ? 0 : currentStockValue;
          });
          return {
            itemName: item.itemName,
            units: item.units,
            salesPrice: item.salePrice || 0,
            purchasePrice: item.purchasePrice || 0,
            quantity: currentQuantity,
            'stock value': parseFloat(currentStockValue.toFixed(2)),
            createdAt: item.createdAt,
            isOutOfStock: currentQuantity <= 0,
            isBelowMinQty:
              currentQuantity <= parseInt(openingStock?.minQty || 0)
                ? true
                : false,
            isInactive: lastSaleDate
              ? moment().diff(moment(lastSaleDate), 'days') > 60
              : false,
          };
        })
      );
      if (qty) {
        inventory = inventory.filter((item) => item.isBelowMinQty);
      }
      if (outOfStock) {
        inventory = inventory.filter((item) => item.isOutOfStock);
      }
      if (inActive) {
        inventory = inventory.filter((item) => item.isInactive);
      }
      const totalStockValue = inventory.reduce(
        (acc, item) => acc + parseFloat(item['stock value']),
        0
      );
      const fileName = `inventory-report-${Date.now()}.${format}`;
      const outputPath = path.join(__dirname, fileName);
      if (format === 'pdf') {
        await createSalesReportPDF(
          inventory,
          headers,
          outputPath,
          type,
          totalStockValue
        );
      } else if (format === 'csv') {
        await createSalesReportCSV(
          inventory,
          headers,
          outputPath,
          type,
          totalStockValue
        );
      } else {
        return badRequestErrorResponse(
          res,
          'Invalid format. Use "pdf" or "csv".'
        );
      }
      const s3Url = await misData(outputPath);
      fs.unlinkSync(outputPath);
      return successResponse(
        res,
        'Inventory report downloaded successfully not',
        s3Url
      );
    }
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

async function createInvoicePDF(invoiceDataArray, outputPath) {
  return new Promise((resolve, reject) => {
    // Page configuration
    const PAGE_WIDTH = 288; // 80mm width
    const MARGIN = 10;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    const LINE_HEIGHT = 20;
    const BASE_HEIGHT = 500;

    // Calculate required height
    let lineCount = 15; // Base lines for header/footer
    invoiceDataArray.forEach(sale => {
      lineCount += Math.max(1, Math.ceil(String(sale.itemId.itemName).length / 20));
    });

    const doc = new PDFDocument({
      size: [PAGE_WIDTH, BASE_HEIGHT + (lineCount * LINE_HEIGHT)],
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const firstSale = invoiceDataArray[0];
    const formattedDate = new Date(firstSale.saleDate).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Header Section
   
    // Invoice Info
    doc
      .fontSize(9)
      .text(`Invoice: ${String(firstSale.invoiceNumber || '').padEnd(10)} Date: ${formattedDate.split(',')[0]}`)
      .text(`Customer: ${String(firstSale.customerName || '').substring(0, 25)}`)
      .text(`Time: ${formattedDate.split(',')[1].trim()}`)
      .moveDown();

    // Table Configuration
    const columns = [
      { name: 'SN', width: 5, align: 'left' },
      { name: 'Item Name', width: 20, align: 'left' },
      { name: 'Qty', width: 5, align: 'right' },
      { name: 'Unit', width: 8, align: 'right' },
      { name: 'Rate', width: 12, align: 'right' },
      { name: 'Amount', width: 15, align: 'right' }
    ];

    // Draw Table Header
    let headerText = columns.map(col => 
      col.name.padEnd(col.width).substring(0, col.width)
    ).join('');
    doc
      .font('Helvetica-Bold')
      .text(headerText)
      .font('Helvetica');

    let totalAmount = 0;
    let totalQty = 0;

    // Draw Table Rows with Dynamic Wrapping
    invoiceDataArray.forEach((sale, index) => {
      const row = {
        sn: String(index + 1),
        item: String(sale.itemId.itemName || ''),
        qty: String(sale.quantity || 0),
        unit: String(sale.itemId.units || 'pc').substring(0, 5).toUpperCase(),
        rate: `Rs.${parseFloat(sale.pricePerUnit || 0).toFixed(2)}`,
        amount: sale.totalAmount ? `Rs.${parseAmount(sale.totalAmount).toFixed(2)}` : ''
      };

      // Split item name into multiple lines if needed
      const itemLines = [];
      let remainingName = row.item;
      while (remainingName.length > 0) {
        itemLines.push(remainingName.substring(0, 20));
        remainingName = remainingName.substring(20);
      }

      // Print each line
      itemLines.forEach((line, lineIndex) => {
        let rowText = '';
        
        if (lineIndex === 0) {
          // First line shows all columns
          rowText += row.sn.padEnd(columns[0].width);
          rowText += line.padEnd(columns[1].width);
          rowText += row.qty.padStart(columns[2].width);
          rowText += row.unit.padStart(columns[3].width);
          rowText += row.rate.padStart(columns[4].width);
          rowText += row.amount.padStart(columns[5].width);
        } else {
          // Subsequent lines only show item name continuation
          rowText += ' '.repeat(columns[0].width);
          rowText += line.padEnd(columns[1].width);
        }
        
        doc.text(rowText);
      });

      if (sale.totalAmount) {
        totalAmount += parseAmount(sale.totalAmount);
        totalQty += parseInt(row.qty) || 0;
      }
    });

    // Footer Section
    doc
      .moveDown()
      .font('Helvetica-Bold')
      .text(`Total Quantity:`.padEnd(30) + `${totalQty}`, { align: 'left' })
      .text(`Sub Total:`.padEnd(30) + `Rs. ${totalAmount.toFixed(2)}`, { align: 'left' })
      .text(`Total:`.padEnd(30) + `Rs. ${totalAmount.toFixed(2)}`, { align: 'left' })
      .moveDown()
      .fontSize(10)
      .text('Thank you!', { align: 'center' })
      .text('Visit us again!', { align: 'center' })
      .fontSize(6)

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

async function createSalesReportPDF(
  data,
  headers,
  outputPath,
  type,
  totalStockValue = 0
) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc.fontSize(14).text(`${type} Report`, { align: 'center' }).moveDown(1.5);

    const effectiveHeaders = getEffectiveHeaders(headers, type);
    const columnCount = effectiveHeaders.length;
    const tableWidth = 520;

    // Assign more width to "Item Name"
    const customWidths = {};
    let remainingWidth = tableWidth;

    effectiveHeaders.forEach((header) => {
      if (header === 'Item Name') {
        customWidths[header] = 200; // Wider space for item names
        remainingWidth -= 200;
      }
    });

    // Distribute remaining equally to other headers
    const equalWidth =
      remainingWidth / (columnCount - Object.keys(customWidths).length);
    effectiveHeaders.forEach((header) => {
      if (!customWidths[header]) {
        customWidths[header] = equalWidth;
      }
    });

    let y = doc.y;

    // Draw header
    doc.font('Helvetica-Bold').fontSize(10);
    let x = 30;
    effectiveHeaders.forEach((header) => {
      doc.text(header, x, y, {
        width: customWidths[header],
        align: 'left',
      });
      x += customWidths[header];
    });

    // Header underline
    y += 20;
    doc
      .moveTo(30, y)
      .lineTo(30 + tableWidth, y)
      .stroke();
    y += 2;

    // Draw rows
    data.forEach((entry, index) => {
      const rowStartY = y;

      // Calculate height for each cell
      const rowHeights = effectiveHeaders.map((header) => {
        const value = getValueByHeader(entry, header, index).toString();
        return doc.heightOfString(value, {
          width: customWidths[header] - 10,
          align: 'left',
        });
      });

      const rowHeight = Math.max(...rowHeights, 20) + 8;

      // Page break logic
      if (y + rowHeight > doc.page.height - 50) {
        doc.addPage();
        y = 50;
        x = 30;
        doc.font('Helvetica-Bold').fontSize(10);
        effectiveHeaders.forEach((header) => {
          doc.text(header, x, y, {
            width: customWidths[header],
            align: 'left',
          });
          x += customWidths[header];
        });
        y += 22;
        doc
          .moveTo(30, y)
          .lineTo(30 + tableWidth, y)
          .stroke();
        y += 2;
      }

      // Draw row data
      x = 30;
      effectiveHeaders.forEach((header) => {
        const value = getValueByHeader(entry, header, index).toString();

        // Draw borders
        doc
          .moveTo(x, y)
          .lineTo(x, y + rowHeight)
          .stroke();
        doc
          .moveTo(x + customWidths[header], y)
          .lineTo(x + customWidths[header], y + rowHeight)
          .stroke();

        // Text
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(value, x + 5, y + 5, {
            width: customWidths[header] - 10,
            align: 'left',
          });

        x += customWidths[header];
      });

      // Bottom border
      doc
        .moveTo(30, y + rowHeight)
        .lineTo(30 + tableWidth, y + rowHeight)
        .stroke();
      y += rowHeight;
    });
    if (type === 'Inventory') {
      const totalRowHeight = 20;
      doc
        .moveTo(30, y)
        .lineTo(30 + tableWidth, y)
        .stroke();
      y += 5;

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`Total Stock Value: Rs. ${totalStockValue.toFixed(2)}`, 30, y, {
          align: 'right',
          width: tableWidth,
        });

      y += totalRowHeight;
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
function getEffectiveHeaders(headers, type) {
  const defaultHeaders = {
    Sale: [
      'Serial Number',
      'Invoice Number',
      'Sale Date',
      'Customer Name',
      'Total Amount',
    ],
    Inventory: [
      'Serial Number',
      'Item Name',
      'Sales Price',
      'Purchase Price',
      'Stock Quantity',
      'Stock Value',
      'Unit',
    ],
  };

  // If no headers provided, use defaults
  if (!headers || headers.length === 0) {
    return defaultHeaders[type];
  }

  // Ensure "Item Name" is included
  if (
    !headers.includes('Item Name') &&
    !headers.some((h) => h.toLowerCase().includes('item'))
  ) {
    headers.unshift('Item Name');
    headers.unshift('Serial Number');
  }
  if (
    !headers.includes('Unit') &&
    !headers.some((h) => h.toLowerCase().includes('unit'))
  ) {
    headers.push('Unit');
  }
  return headers;
}

function getValueByHeader(entry, header, index = 0) {
  switch (header) {
    case 'Serial Number':
      return index + 1;
    case 'Item Name':
      return entry.itemName || entry.itemId?.itemName || entry.itemId || '-';
    case 'Invoice Number':
      return entry.invoiceNumber || '-';
    case 'Sale Date':
      return entry.saleDate
        ? moment(entry.saleDate).tz('Asia/Kolkata').format('DD-MM-YYYY')
        : '-';
    case 'Customer Name':
      return entry.customerName || '-';
    case 'Quantity':
    case 'Stock Quantity':
      return entry.quantity || '0';
    case 'Price Per Unit':
      return entry.pricePerUnit
        ? parseFloat(entry.pricePerUnit).toFixed(2)
        : '0.00';
    case 'Total Amount':
      return entry.totalAmount
        ? parseFloat(entry.totalAmount).toFixed(2)
        : '0.00';
    case 'Sales Price':
      return entry.salesPrice
        ? parseFloat(entry.salesPrice).toFixed(2)
        : '0.00';
    case 'Purchase Price':
      return entry.purchasePrice
        ? parseFloat(entry.purchasePrice).toFixed(2)
        : '0.00';
    case 'Stock Value':
      return entry['stock value'] || '0.00';
    case 'Created By':
      return entry.createdBy || '-';
    case 'Unit':
      return entry.units || 'pieces';
    default:
      return entry[header] || '-';
  }
}

async function createSalesReportCSV(
  data,
  headers,
  outputPath,
  type,
  totalStockValue = 0
) {
  return new Promise((resolve, reject) => {
    const effectiveHeaders = getEffectiveHeaders(headers, type);
    const csvRows = [];

    // Add header row
    csvRows.push(effectiveHeaders.join(','));

    // Add data rows
    data.forEach((entry, index) => {
      const row = effectiveHeaders.map((header) => {
        const value = getValueByHeader(entry, header, index);
        // Escape commas and quotes in CSV
        return `"${value.toString().replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });
    // Add total stock value if applicable
    if (type === 'Inventory') {
      csvRows.push(`"Total Stock Value",,"Rs. ${totalStockValue.toFixed(2)}"`);
    }
    // Write to file
    fs.writeFile(outputPath, csvRows.join('\n'), 'utf8', (err) => {
      if (err) reject(err);
      else resolve(outputPath);
    });
  });
}
