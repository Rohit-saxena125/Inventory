const Inventory = require('../../models/inventory/inventoryModel');
const Sale = require('../../models/Sales/salesModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');

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
    const { page, limit, search } = req.query;
    const query = {};
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
        sales.forEach((sale) => {
          quantity = parseInt(sale.quantity, 10);
          console.log(quantity);
          if (sale.orderType === 'Opening' || sale.orderType === 'Add') {
            quantity += quantity;
          } else if (sale.orderType === 'Sale' || sale.orderType === 'Reduce') {
            quantity -= quantity;
          }
          console.log(quantity);
        });
        return {
          ...item.toObject(),
          quantity: quantity,
        };
      })
    );
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
      } else if (sale.orderType === 'Sale' || sale.orderType === 'Reduce') {
        inventory.quantity -= quantity;
      }
    });
    inventory.stockValue = inventory.stockValue.toFixed(2);
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

exports.addReduceInventory = async (req, res, next) => {
  try {
    const type = req.query.type;
    const itemId = req.params.id;
    const { quantity, pricePerUnit, description, saleDate } = req.body;
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
