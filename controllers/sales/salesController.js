const Sale = require('../../models/Sales/salesModel');
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
    } = req.body;
    let invoiceNumber = await generateInvoiceNumber();
    await updateInvoiceNumber(invoiceNumber);
    let sales = await Sale.create({
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
    const sale = await Sale.findById({_id:sales._id}).populate({ path: 'itemId' }).populate({ path: 'createdBy' });
    return successResponse(res, 'Sales created successfully', sale);
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

  async function updateInvoiceNumber(invoiceNumber) {
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
      hour12: true, // Set to false if you prefer 24-hour format
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
      doc.fontSize(12).text(`Price Per Unit: $${invoiceData.pricePerUnit}`);
      doc.fontSize(12).text(`Discount: $${invoiceData.discount}`);
      doc.fontSize(12).text(`Total Amount: $${invoiceData.totalAmount}`).moveDown();
      doc.fontSize(12).text(`Description: ${invoiceData.description}`);
      doc.fontSize(12).text(`Created By: ${invoiceData.createdBy.name}`).moveDown();
      doc.end();
  
      stream.on("finish", () => resolve(outputPath));
      stream.on("error", reject);
    });
  }
  