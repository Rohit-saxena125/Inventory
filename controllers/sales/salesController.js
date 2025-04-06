const Sale = require('../../models/Sales/salesModel');
const SaleDummy = require('../../models/Sales/salesDummyModel')
const InvoiceCounter = require('../../models/Sales/invoiceCounterModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');
const PDFDocument = require('pdfkit');
const {misData} = require("../../middlewares/upload/upload")
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

exports.fetchSales = async (req, res) => {
  try {
    const { page, limit, search, itemId,startDate,endDate,userId } = req.query;
    const query = {isDeleted:false};
    if (itemId) {
      query.itemId = itemId;
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
    const populate = [
      {path: 'itemId',select: 'itemName'},
    ]
    const sales = await pagination(Sale, query, page, limit,null,null,populate);
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
    const sales = await Sale.findOne({_id:id,isDeleted:false}).populate('itemId');
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
      invoiceNumber
    } = req.body;
    // await updateInvoiceNumber(invoiceNumber);
    let sales = await SaleDummy.create({
      orderType: 'Sales',
      quantity,
      pricePerUnit,
      description,
      saleDate,
      itemId,
      customerName,
      discount,
      totalAmount,
      invoiceNumber,
      createdBy: req.user._id,
    });
    const sale = await SaleDummy.findById({_id:sales._id}).populate({ path: 'itemId' }).populate({ path: 'createdBy' });
    return successResponse(res, 'Sales created successfully', sale);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
exports.createFinalSales = async (req, res) => {
  try {
    const { listSales } = req.body;
    const invoiceNumber = req.queryinvoiceNumber;

    await updateInvoiceNumber(invoiceNumber);

    const sales = [];

    for (const item of listSales) {
      const dummySales = await SaleDummy.findOne({_id:item});
      if (!dummySales) {
        return badRequestErrorResponse(res, 'Sales not found');
      }

      const sale = await Sale.create({
        orderType: 'Sales',
        quantity: dummySales.quantity,
        pricePerUnit: dummySales.pricePerUnit,
        description: dummySales.description,
        saleDate: dummySales.saleDate,
        itemId: dummySales.itemId,
        customerName: dummySales.customerName,
        discount: dummySales.discount,
        totalAmount: dummySales.totalAmount,
        invoiceNumber: invoiceNumber,
        createdBy: req.user._id,
      });

      await SaleDummy.findByIdAndDelete(item._id);
      sales.push(sale);
    }

    return successResponse(res, 'Sales created successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
}


exports.fetchDummySales = async (req, res) => {
  try {
    const {invoiceNumber} = req.query;
    let sales = await SaleDummy.find({invoiceNumber:invoiceNumber}).populate('itemId').populate('createdBy');
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    let totalBill = 0;
    sales =  await Promise.all(
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
      }))
    return successResponse(res, 'Sales fetched successfully', {sales,totalBill});
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
}

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
      const updatedSales = await Sale.findByIdAndUpdate
        (id, {
          orderType: 'Sales',
          quantity,
          pricePerUnit,
          description,
          saleDate,
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
    await Sale.findByIdAndUpdate(id,{$set:{isDeleted:true}},{new:true,runValidators:true});
    }
    return successResponse(res, 'Sales deleted successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.downloadInvoice = async(req,res) => {
  try {
    const { id } = req.params;
    const sales = await Sale.findById(id).populate('itemId').populate('createdBy');
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    if (sales.orderType === "Sales") {
      const outputPath = path.join(__dirname, `invoice-${sales.invoiceNumber}.pdf`);
      await createInvoicePDF(sales, outputPath);
      const s3Url = await misData(outputPath);
      return successResponse(res, 'Invoice downloaded successfully', s3Url);
    }
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
}

exports.deleteSalesAll = async (req, res) => {
  try {
    await Sale.deleteMany({orderType:"Sales"});
    return successResponse(res, 'All Sales deleted successfully ');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
async function generateInvoiceNumber() {
    const latestSale = await Sale.findOne({orderType:"Sales"}).sort({_id:-1});
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
}

  async function updateInvoiceNumber(invoiceNumber) {
    const isinvoiceNumber = await InvoiceCounter.findOne({invoiceNumber:invoiceNumber});
    if (isinvoiceNumber) {
      let invoiceNumbergen = await generateInvoiceNumber();
      await InvoiceCounter.findOneAndUpdate({}, { $set: { invoiceNumber: invoiceNumbergen} }, { upsert: true });
    }
    await InvoiceCounter.findOneAndUpdate({}, { $set: { invoiceNumber: invoiceNumber } }, { upsert: true });
  }

  async function createInvoicePDF(invoiceData, outputPath) {
    const saleDate = new Date(invoiceData.saleDate).toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true, 
    });
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(outputPath);
  
      doc.pipe(stream);
      doc.fontSize(20).text("Invoice", { align: "center" }).moveDown();
      doc.fontSize(14).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
      doc.fontSize(14).text(`Customer Name: ${invoiceData.customerName}`);
      doc.fontSize(14).text(`Sale Date: ${saleDate}`).moveDown();
      doc.fontSize(12).text(`Item: ${invoiceData.itemId.itemName}`);
      doc.fontSize(12).text(`Quantity: ${invoiceData.quantity}`);
      doc.fontSize(12).text(`Price Per Unit: ₹${invoiceData.pricePerUnit}`);
      doc.fontSize(12).text(`Discount: ₹${invoiceData.discount}`);
      doc.fontSize(12).text(`Total Amount: ₹${invoiceData.totalAmount}`).moveDown();
      doc.fontSize(12).text(`Description: ${invoiceData.description}`);
      doc.fontSize(12).text(`Created By: ${invoiceData.createdBy.name}`).moveDown();
      doc.end();
  
      stream.on("finish", () => resolve(outputPath));
      stream.on("error", reject);
    });
  }
  

  exports.downloadSalesReport = async (req, res) => {
    try {
      const { format = 'pdf', headers = [], startDate, endDate, userId, search } = req.body;
      const query = { isDeleted: false };
      if (userId) query.createdBy = userId;
      if (startDate && endDate) {
        query.saleDate = {
          $gte: moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate(),
          $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate()
        };
      }
      if (search) {
        query.orderType = { $regex: search, $options: 'i' };
      }
  
      const sales = await Sale.find(query).populate('itemId').populate('createdBy');
  
      if (!sales || sales.length === 0) {
        return badRequestErrorResponse(res, 'No sales data found for the given filters.');
      }
  
      const fileName = `sales-report-${Date.now()}.${format}`;
      const outputPath = path.join(__dirname,fileName);
  
      if (format === 'pdf') {
        await createSalesReportPDF(sales, headers, outputPath);
      } else if (format === 'csv') {
        await createSalesReportCSV(sales, headers, outputPath);
      } else {
        return badRequestErrorResponse(res, 'Invalid format. Use "pdf" or "csv".');
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
    return headers.map(header => `"${getValueByHeader(sale, header)}"`).join(',');
  });
  const csvContent = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outputPath, csvContent);
}

// Helper to resolve field values
function getValueByHeader(sale, header) {
  switch (header) {
    case 'saleDate': return sale.saleDate
      ? moment(sale.saleDate).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mm A')
      : '-';
    case 'itemId': return sale.itemId?.itemName || '-';
    case 'quantity': return sale.quantity || 0;
    case 'pricePerUnit': return sale.pricePerUnit || 0;
    case 'stock value': return ((sale.pricePerUnit || 0) * (sale.quantity || 0)).toFixed(2);
    case 'salesPrice': return sale.itemId?.salePrice || '-';
    case 'purchasePrice': return sale.itemId?.purchasePrice || '-';
    default: return '';
  }
}
  