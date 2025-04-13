const Inventory = require('../../models/inventory/inventoryModel');
const Sale = require('../../models/Sales/salesModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');
const moment = require('moment-timezone');

exports.createInventory = async (req, res, next) => {
  try {
    const {
      itemName,
      units,
      purchasePrice,
      salePrice,
      openingStock,
      minStockQty,
      asOfDate,
      payPerUnit,
    } = req.body;
    const inventoryExist = await Inventory.findOne({ itemName });
    if (inventoryExist) {
      return badRequestErrorResponse(res, 'Inventory already exist');
    }
    const inventory = await Inventory.create({
      itemName: itemName,
      units: units,
      purchasePrice: purchasePrice,
      salePrice: salePrice,
    });
    if (openingStock > 0 || minStockQty > 0 || payPerUnit > 0) {
      const openingStockSale = await Sale.create({
        orderType: 'Opening',
        itemId: inventory._id,
        quantity: openingStock,
        minQty: minStockQty,
        saleDate: asOfDate,
        pricePerUnit: payPerUnit,
      });
    }
    return successResponse(res, 'Inventory created successfully', inventory);
  } catch (error) {
    return internalServerErrorResponse(res, error.message);
  }
};

exports.getAllInventory = async (req, res, next) => {
  try {
    const { page, limit, search, startDate, endDate, qty } = req.query;
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: moment
          .tz(startDate, 'Asia/Kolkata')
          .startOf('day')
          .utc()
          .toDate(),
        $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').utc().toDate(),
      };
    }
    if (search) {
      query.itemName = {
        $regex: search,
        $options: 'i',
      };
    }
    const inventory = await pagination(Inventory, query, page, limit);
    inventory.result = await Promise.all(
      inventory.result.map(async (item) => {
        const sales = await Sale.find({ itemId: item._id });
        let quantity = 0;
        let stockValue = 0;
        sales.forEach((sale) => {
          const quantitySet = parseInt(sale.quantity, 10) || 0;
          const pricePerUnit = parseFloat(sale.pricePerUnit);
          if (sale.orderType === 'Opening' || sale.orderType === 'Add') {
            quantity += quantitySet;
            stockValue += quantitySet * pricePerUnit;
          } else if (
            sale.orderType === 'Sales' ||
            sale.orderType === 'Reduce'
          ) {
            quantity -= quantitySet;
            stockValue -= quantitySet * pricePerUnit;
          }
        });
        return {
          ...item.toObject(),
          quantity: quantity ,
          stockValue: parseFloat(stockValue.toFixed(2)),
        };
      })
    );
    if (qty) {
      inventory.result = inventory.result.filter((item) => item.quantity <= 0);
    }
    return successResponse(res, 'Inventory fetched successfully', inventory);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.getInventoryById = async (req, res, next) => {
  try {
    let inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return badRequestErrorResponse(res, 'Inventory not found');
    }
    const openingStock = await Sale.findOne({
      itemId: inventory._id,
      orderType: 'Opening',
    });
    inventory = inventory.toObject();
    inventory.openingStock = openingStock;
    const sales = await Sale.find({ itemId: inventory._id });
    inventory.quantity = 0;
    inventory.stockValue = 0;
    sales.forEach((sale) => {
      const quantity = parseInt(sale.quantity, 10);
      const pricePerUnit = parseFloat(sale.pricePerUnit);
      if (sale.orderType === 'Opening' || sale.orderType === 'Add') {
        inventory.quantity += quantity;
        inventory.stockValue += quantity * pricePerUnit;
      } else if (sale.orderType === 'Sales' || sale.orderType === 'Reduce') {
        inventory.quantity -= quantity;
        inventory.stockValue -= quantity * pricePerUnit;
      }
    });
    inventory.stockValue =
      inventory.stockValue.toFixed(2) ;
    inventory.quantity = inventory.quantity;
    return successResponse(res, 'Inventory fetched successfully', inventory);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
exports.updateInventory = async (req, res, next) => {
  try {
    const {
      itemName,
      units,
      purchasePrice,
      salePrice,
      openingStock,
      minStockQty,
      asOfDate,
      payPerUnit,
    } = req.body;
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          itemName: itemName,
          units: units,
          purchasePrice: purchasePrice,
          salePrice: salePrice,
        },
      },
      { new: true, runValidators: true }
    );
    if (!inventory) {
      return badRequestErrorResponse(res, 'Inventory not found');
    }
    if (openingStock > 0 || minStockQty > 0 || payPerUnit > 0) {
      const lastOpeningStock = await Sale.findOne({ itemId: inventory._id });
      if (lastOpeningStock) {
        const openingStockSale = await Sale.findOneAndUpdate(
          { _id: lastOpeningStock._id },
          {
            $set: {
              quantity: openingStock,
              minQty: minStockQty,
              saleDate: asOfDate,
              pricePerUnit: payPerUnit,
            },
          },
          { new: true, runValidators: true }
        );
      }
    }
    return successResponse(res, 'Inventory updated successfully', inventory);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.deleteInventory = async (req, res, next) => {
  try {
    const inventory = await Inventory.findByIdAndDelete(req.params.id);
    if (!inventory) {
      return badRequestErrorResponse(res, 'Inventory not found');
    }
    return successResponse(res, 'Inventory deleted successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.reportInventory = async (req, res, next) => {
  try {
    const { startDate, endDate, type, userId } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: moment
          .tz(startDate, 'Asia/Kolkata')
          .startOf('day')
          .utc()
          .toDate(),
        $lte: moment.tz(endDate, 'Asia/Kolkata').endOf('day').utc().toDate(),
      };
    }
    if (type == 'Inventory') {
      const [noOFItems, totalStockValue, allInventoryItems] = await Promise.all(
        [
          Inventory.countDocuments(query),
          Inventory.aggregate([
            { $match: query },
            {
              $lookup: {
                from: 'sales',
                localField: '_id',
                foreignField: 'itemId',
                as: 'sales',
              },
            },
            {
              $unwind: '$sales',
            },
            {
              $group: {
                _id: null,
                totalStockValue: {
                  $sum: {
                    $multiply: [
                      { $toDouble: '$sales.quantity' },
                      { $toDouble: '$sales.pricePerUnit' },
                    ],
                  },
                },
              },
            },
          ]),
          Inventory.find(query),
        ]
      );

      const totalValue =
        totalStockValue.length > 0 ? totalStockValue[0].totalStockValue : 0;
      const lowStockChecks = await Promise.all(
        allInventoryItems.map(async (item) => {
          const sales = await Sale.find({ itemId: item._id });
          let quantity = 0;

          sales.forEach((sale) => {
            const qty = parseInt(sale.quantity, 10) || 0;
            if (sale.orderType === 'Opening' || sale.orderType === 'Add') {
              quantity += qty;
            } else if (
              sale.orderType === 'Sales' ||
              sale.orderType === 'Reduce'
            ) {
              quantity -= qty;
            }
          });

          return {
            item,
            isLowStock: quantity <= 0,
          };
        })
      );

      const lowStockItems = lowStockChecks
        .filter((check) => check.isLowStock)
        .map((check) => check.item);

      const lowStockCount = lowStockItems.length;
      const noOFItemsValue = noOFItems > 0 ? noOFItems : 0;

      return successResponse(res, 'Inventory report fetched successfully', {
        noOFItems: noOFItemsValue,
        totalStockValue: totalValue,
        lowStockItems: lowStockCount,
      });
    } else {
      query.isDeleted = false;
      query.orderType = 'Sales';
      if(userId) {
        query.createdBy = userId;
      }
      const sales = await Sale.find(query);
      const uniqueInvoices = new Set();
      let totalSalesAmount = 0;
      sales.forEach((sale) => {
        const price = parseFloat(sale.pricePerUnit) || 0;
        const qty = parseInt(sale.quantity, 10) || 0;
        totalSalesAmount += price * qty;
        if (sale.invoiceNumber) {
          uniqueInvoices.add(sale.invoiceNumber);
        }
      });
      const totalInvoices = uniqueInvoices.size;
      return successResponse(res, 'Sales report fetched successfully', {
        noOFItems: totalInvoices,
        totalStockValue: totalSalesAmount.toFixed(2),
        lowStockItems: 0,
      });
    }
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.addReduceInventory = async (req, res, next) => {
  try {
    const type = req.query.type;
    const itemId = req.params.id;
    const { quantity, pricePerUnit, description, saleDate } = req.body;
    if (req.query.transactionId) {
      let sale = await Sale.findById({ _id: req.query.transactionId });
      if (!sale) {
        return badRequestErrorResponse(res, 'Transaction not found');
      }
      if (sale.orderType === 'Opening') {
        return badRequestErrorResponse(res, 'Opening stock cannot be updated');
      }
      if (sale.orderType === 'Sale') {
        return badRequestErrorResponse(res, 'Sale stock cannot be updated');
      }
      sale = await Sale.findByIdAndUpdate(
        { _id: sale._id },
        {
          $set: {
            orderType: sale.orderType,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            description: description,
            saleDate: saleDate,
          },
        },
        { new: true, runValidators: true }
      );
      return successResponse(res, 'Inventory updated successfully', sale);
    }
    const addReduce = await Sale.create({
      orderType: type,
      itemId: itemId,
      quantity: quantity,
      pricePerUnit: pricePerUnit,
      description: description,
      saleDate: saleDate,
    });
    return successResponse(res, `Inventory ${type} successfully`);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
