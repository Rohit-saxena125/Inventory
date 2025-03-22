const Sale = require('../../models/Sales/salesModel');
const InvoiceCounter = require('../../models/Sales/invoiceCounterModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');
const PDFDocument = require('pdfkit');
const fs = require('fs');
exports.fetchSales = async (req, res) => {
  try {
    const { page, limit, search, itemId } = req.query;
    const query = {isDeleted:false};
    if (itemId) {
      query.itemId = itemId;
    }
    if (search) {
      query.orderType = {
        $regex: search,
        $options: 'i',
      };
    }
    const sales = await pagination(Sale, query, page, limit);
    sales.result = await Promise.all(
      sales.result.map(async (item) => {
        const totalPrice = (
          parseFloat(item.pricePerUnit) * parseFloat(item.quantity)
        ).toFixed(2);
        return {
          ...item.toObject(),
          totalPrice: totalPrice-parseFloat(item.discount),
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
    const sales = await Sale.findById({_id:id,isDeleted:false}).populate('itemId');
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
    });
    const sale = await Sale.findById({_id:sales._id}).populate({ path: 'itemId' });
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
    const sales = await Sale.findById(id).populate('itemId');
    if (!sales) {
      return badRequestErrorResponse(res, 'Sales not found');
    }
    if(sales.orderType === 'Sales'){
      const outputPath = `invoice-${sales.invoiceNumber}.pdf`;
    await createInvoicePDF(sales, outputPath);
    res.download(outputPath, `invoice-${sales.invoiceNumber}.pdf`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Could not download the file.');
      }
    });
    }
    return successResponse(res, 'Invoice downloaded successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
}
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
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  doc.fontSize(20).text('Invoice', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text(`Invoice Number: ${invoiceData.invoiceNumber}`);
  doc.fontSize(14).text(`Customer Name: ${invoiceData.customerName}`);
  doc.fontSize(14).text(`Sale Date: ${new Date(invoiceData.saleDate).toLocaleDateString()}`);
  doc.moveDown();

  doc.fontSize(12).text(`Item: ${invoiceData.itemId.itemName}`);
  doc.fontSize(12).text(`Quantity: ${invoiceData.quantity}`);
  doc.fontSize(12).text(`Price Per Unit: $${invoiceData.pricePerUnit}`);
  doc.fontSize(12).text(`Discount: $${invoiceData.discount}`);
  doc.fontSize(12).text(`Total Amount: $${invoiceData.totalAmount}`);
  doc.moveDown();

  doc.fontSize(12).text(`Description: ${invoiceData.description}`);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
