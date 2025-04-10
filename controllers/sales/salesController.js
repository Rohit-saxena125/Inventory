const Sale = require('../../models/Sales/salesModel');
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
const { create } = require('../../models/inventory/inventoryModel');

exports.fetchSales = async (req, res) => {
  try {
    const { page, limit, search, itemId, startDate, endDate, userId } =
      req.query;
    const query = { isDeleted: false };
    if (itemId) {
      query.itemId = itemId;
    }
    else{
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
      saleDate: new Date(saleDate),
      itemId,
      customerName,
      discount,
      totalAmount,
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
    const invoiceNumber = req.query.invoiceNumber;

    await updateInvoiceNumber(invoiceNumber);

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

      await SaleDummy.findByIdAndDelete(item._id);
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
    let sales = await SaleDummy.find({ invoiceNumber: invoiceNumber })
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
    const {startDate, endDate,userId,invoiceNumber} = req.query;
    const query = { isDeleted: false };
    if(startDate && endDate){
    query.createdAt= {
        $gte: moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate(),
        $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate(),
      }
    }
    query.orderType = 'Sales';
    if (userId) {
      query.createdBy = userId;
    }
    if (invoiceNumber) {
      query.invoiceNumber = invoiceNumber;
    }
    await Sale.updateMany(query,{ $set: { isDeleted: true } }, { new: true, runValidators: true });
    return successResponse(res, 'All Sales deleted successfully ');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
async function generateInvoiceNumber() {
  const latestSale = await Sale.findOne({ orderType: 'Sales' }).sort({
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
    const query = { isDeleted: false ,orderType: 'Sales'};
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
      .populate('createdBy').sort({createdAt: -1});
    const invoiceMap = new Map();
    sales.forEach((sale) => {
      const invoiceNumber = sale.invoiceNumber;
      const price = parseFloat(sale.pricePerUnit || 0);
      const qty = parseInt(sale.quantity, 10) || 0;
      const amount = price * qty;
      if (!invoiceMap.has(invoiceNumber)) {
        invoiceMap.set(invoiceNumber, {
          invoiceNumber,
          saleDate: sale.saleDate,
          totalAmount: 0,
        });
      }
      const invoiceData = invoiceMap.get(invoiceNumber);
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
}

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
  }
  await InvoiceCounter.findOneAndUpdate(
    {},
    { $set: { invoiceNumber: invoiceNumber } },
    { upsert: true }
  );
}

async function createInvoicePDF(invoiceDataArray, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc
      .fontSize(20)
      .text('Combined Sales Invoice', { align: 'center' })
      .moveDown();
    invoiceDataArray.forEach((sale, index) => {
      const saleDate = new Date(sale.saleDate).toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      doc
        .fontSize(16)
        .text(`Sale #${index + 1}`, { underline: true })
        .moveDown(0.5);
      doc.fontSize(12).text(`Invoice Number: ${sale.invoiceNumber}`);
      doc.fontSize(12).text(`Customer Name: ${sale.customerName}`);
      doc.fontSize(12).text(`Sale Date: ${saleDate}`);
      doc.fontSize(12).text(`Item: ${sale.itemId.itemName}`);
      doc.fontSize(12).text(`Quantity: ${sale.quantity}`);
      doc.fontSize(12).text(`Price Per Unit: ₹${sale.pricePerUnit}`);
      doc.fontSize(12).text(`Discount: ₹${sale.discount}`);
      doc.fontSize(12).text(`Total Amount: ₹${sale.totalAmount}`);
      doc.fontSize(12).text(`Description: ${sale.description}`);
      doc.fontSize(12).text(`Created By: ${sale.createdBy.name}`);
      doc.moveDown(1);
    });

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
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
    } = req.body;
    const query = { isDeleted: false };
    if (userId) query.createdBy = userId;
    if (startDate && endDate) {
      query.saleDate = {
        $gte: moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate(),
        $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate(),
      };
    }
    if (search) {
      query.orderType = { $regex: search, $options: 'i' };
    }

    const sales = await Sale.find(query)
      .populate('itemId')
      .populate('createdBy');

    if (!sales || sales.length === 0) {
      return badRequestErrorResponse(
        res,
        'No sales data found for the given filters.'
      );
    }

    const fileName = `sales-report-${Date.now()}.${format}`;
    const outputPath = path.join(__dirname, fileName);

    if (format === 'pdf') {
      await createSalesReportPDF(sales, headers, outputPath);
    } else if (format === 'csv') {
      await createSalesReportCSV(sales, headers, outputPath);
    } else {
      return badRequestErrorResponse(
        res,
        'Invalid format. Use "pdf" or "csv".'
      );
    }

    const s3Url = await misData(outputPath);
    fs.unlinkSync(outputPath); // Clean up temp file

    return successResponse(res, 'Sales report downloaded successfully', s3Url);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
const DEFAULT_HEADERS = [
  'saleDate',
  'itemId',
  'quantity',
  'pricePerUnit',
  'stock value',
  'salesPrice',
  'purchasePrice',
];

// PDF Generator
async function createSalesReportPDF(salesData, headers, outputPath) {
  if (!headers || headers.length === 0) headers = DEFAULT_HEADERS;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(18).text('Sales Report', { align: 'center' }).moveDown();

    salesData.forEach((sale) => {
      headers.forEach((header) => {
        let value = getValueByHeader(sale, header);
        doc.fontSize(12).text(`${header}: ${value}`);
      });
      doc.moveDown();
    });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// CSV Generator
async function createSalesReportCSV(salesData, headers, outputPath) {
  if (!headers || headers.length === 0) headers = DEFAULT_HEADERS;

  const rows = salesData.map((sale) => {
    return headers
      .map((header) => `"${getValueByHeader(sale, header)}"`)
      .join(',');
  });
  const csvContent = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outputPath, csvContent);
}

// Helper to resolve field values
function getValueByHeader(sale, header) {
  switch (header) {
    case 'saleDate':
      return sale.saleDate
        ? moment(sale.saleDate).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mm A')
        : '-';
    case 'itemId':
      return sale.itemId?.itemName || '-';
    case 'quantity':
      return sale.quantity || 0;
    case 'pricePerUnit':
      return sale.pricePerUnit || 0;
    case 'stock value':
      return ((sale.pricePerUnit || 0) * (sale.quantity || 0)).toFixed(2);
    case 'salesPrice':
      return sale.itemId?.salePrice || '-';
    case 'purchasePrice':
      return sale.itemId?.purchasePrice || '-';
    default:
      return '';
  }
}
