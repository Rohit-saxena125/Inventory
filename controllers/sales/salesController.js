const Sale = require('../../models/Sales/salesModel');
const InvoiceCounter = require('../../models/Sales/invoiceCounterModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');

exports.fetchSales = async (req, res) => {
  try {
    const { page, limit, search, itemId } = req.query;
    const query = {};
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
          totalPrice: totalPrice,
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
    const sales = await Sale.findById(id).populate('itemId');
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
    const sales = await Sale.create({
      orderType: 'Sale',
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
    return successResponse(res, 'Sales created successfully', sales);
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
    if (sales.orderType === 'Sale') {
      const updatedSales = await Sale.findByIdAndUpdate
        (id, {
          orderType: 'Sale',
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
    if (sales.orderType === 'Sale') {
    await Sale.findByIdAndDelete(id);
    }
    return successResponse(res, 'Sales deleted successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};


async function generateInvoiceNumber() {
    const latestSale = await Sale.findOne({}, {}, { sort: { 'createdAt': -1 } });
    if (latestSale) {
      return latestSale.invoiceNumber + 1;
    }
    return 1; 
  }

  async function updateInvoiceNumber(invoiceNumber) {
    await InvoiceCounter.findOneAndUpdate({}, { $set: { invoiceNumber: invoiceNumber } }, { upsert: true });
  }