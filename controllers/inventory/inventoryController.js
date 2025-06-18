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
    const {
      page,
      limit,
      search,
      startDate,
      endDate,
      qty,
      outOfStock,
      inActive,
    } = req.query;
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: moment
          .tz(startDate,'DD-MM-YYYY', 'Asia/Kolkata')
          .startOf('day')
          .utc()
          .toDate(),
        $lte: moment.tz(endDate,'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').utc().toDate(),
      };
    }
    if (search) {
      const cleaned = search.replace(/[^a-zA-Z0-9]/g, '');
      const flexibleRegex = cleaned.split('').join('[^a-zA-Z0-9]*');
      query.itemName = {
        $regex: flexibleRegex,
        $options: 'i',
      };
    }
    let inventory = await pagination(Inventory, query, page, limit);
    inventory.result = await Promise.all(
      inventory.result.map(async (item) => {
        const openingStock = await Sale.findOne({
          orderType: 'Opening',
          itemId: item._id,
        }).sort({ createdAt: -1 });
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
              currentStockValue += quantitySet * pricePerUnit;
              break;
            case 'Reduce':
              currentQuantity -= quantitySet;
              currentStockValue -= quantitySet * pricePerUnit;
              break;
            case 'Sales':
              if (currentQuantity <= 0) break;
              const avgCost = currentStockValue / currentQuantity;
              const costOfGoodsSold = quantitySet * avgCost;
              currentQuantity -= quantitySet;
              currentStockValue -= costOfGoodsSold;
              break;
            default:
              break;
          }
          currentQuantity = currentQuantity;
          currentStockValue = currentQuantity === 0 ? 0 : currentStockValue;
        });
        return {
          ...item.toObject(),
          quantity: currentQuantity,
          stockValue: parseFloat(currentStockValue.toFixed(2)),
          isOutOfStock: currentQuantity <= 0,
          isBelowMinQty:
            currentQuantity <= parseInt(openingStock?.minQty||0) ? true : false,
          isInactive: lastSaleDate
            ? moment().diff(moment(lastSaleDate), 'days') > 60
            : false,
        };
      })
    );
    if (qty) {
      inventory.result = inventory.result.filter((item) => item.isBelowMinQty);
    }
    if (outOfStock) {
      inventory.result = inventory.result.filter((item) => item.isOutOfStock);
    }
    if (inActive) {
      inventory.result = inventory.result.filter((item) => item.isInactive);
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
    const sales = await Sale.find({ itemId: inventory._id });
    let currentQuantity = 0;
    let currentStockValue = 0;
    sales.forEach((sale) => {
      const quantity = parseInt(sale.quantity, 10) || 0;
      const pricePerUnit = parseFloat(sale.pricePerUnit);
      switch (sale.orderType) {
        case 'Opening':
        case 'Add':
          currentQuantity += quantity;
          currentStockValue += quantity * pricePerUnit;
          break;
        case 'Reduce':
          currentQuantity -= quantity;
          currentStockValue -= quantity * pricePerUnit;
          break;
        case 'Sales':
          if (currentQuantity <= 0) break;
          const avgCost = currentStockValue / currentQuantity;
          const costOfGoodsSold = quantity * avgCost;
          currentQuantity -= quantity;
          currentStockValue -= costOfGoodsSold;
          break;
        default:
          break;
      }
      currentQuantity = currentQuantity;
      currentStockValue = currentQuantity === 0 ? 0 : currentStockValue;
    });
    const openingStock = sales.find((s) => s.orderType === 'Opening');
    inventory = inventory.toObject();
    inventory.openingStock = openingStock;
    inventory.stockValue = parseFloat(currentStockValue.toFixed(2));
    inventory.quantity = currentQuantity;
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
    const { startDate, endDate, type, userId,qty,
      outOfStock,
      inActive, } = req.query;
    let query = {};
    if (type == 'Inventory') {
      if (startDate && endDate) {
        query.createdAt = {
          $gte: moment
            .tz(startDate,'DD-MM-YYYY', 'Asia/Kolkata')
            .startOf('day')
            .utc()
            .toDate(),
          $lte: moment.tz(endDate, 'DD-MM-YYYY','Asia/Kolkata').endOf('day').utc().toDate(),
        };
      }
      const allInventoryItems = await Inventory.find(query);
      let inventoryCalculations = await Promise.all(
        allInventoryItems.map(async (item) => {
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
            const quantity = parseInt(sale.quantity, 10) || 0;
            const pricePerUnit = parseFloat(sale.pricePerUnit);
            if (sale.orderType === 'Sales' && lastSaleDate === null) {
              lastSaleDate = sale.createdAt;
            }
            switch (sale.orderType) {
              case 'Opening':
              case 'Add':
                currentQuantity += quantity;
                currentStockValue += quantity * pricePerUnit;
                break;
              case 'Reduce':
                currentQuantity -= quantity;
                currentStockValue -= quantity * pricePerUnit;
                break;
              case 'Sales':
                if (currentQuantity <= 0) break;
                const avgCost = currentStockValue / currentQuantity;
                const costOfGoodsSold = quantity * avgCost;
                currentQuantity -= quantity;
                currentStockValue -= costOfGoodsSold;
                break;
            }
            currentQuantity = currentQuantity;
            currentStockValue = currentQuantity === 0 ? 0 : currentStockValue;
          });
          return {
            item,
            quantity: currentQuantity,
            stockValue: currentStockValue,
            isOutOfStock: currentQuantity <= 0,
            isBelowMinQty:
              currentQuantity <= parseInt(openingStock?.minQty||0) ? true : false,
            isInactive: lastSaleDate
              ? moment().diff(moment(lastSaleDate), 'days') > 60
              : false,
          };
        })
      );
      if (qty) {
        inventoryCalculations = inventoryCalculations.filter((item) => item.isBelowMinQty);
      }
      if (outOfStock) {
        inventoryCalculations = inventoryCalculations.filter((item) => item.isOutOfStock);
      }
      if (inActive) {
        inventoryCalculations = inventoryCalculations.filter((item) => item.isInactive);
      }
      const noOFItems = inventoryCalculations.length;
      const totalStockValue = inventoryCalculations.reduce(
        (sum, calc) => sum + calc.stockValue,
        0
      );
      const lowStockCount = inventoryCalculations.filter(
        (item) => item.isBelowMinQty
      ).length;
      return successResponse(res, 'Inventory report fetched successfully', {
        noOFItems: noOFItems,
        totalStockValue: parseFloat(totalStockValue.toFixed(2)),
        lowStockItems: lowStockCount,
      });
    } else {
      query.isDeleted = false;
      if (startDate && endDate) {
        query.saleDate = {
          $gte: moment
            .tz(startDate,'DD-MM-YYYY', 'Asia/Kolkata')
            .startOf('day')
            .utc()
            .toDate(),
          $lte: moment.tz(endDate, 'DD-MM-YYYY','Asia/Kolkata').endOf('day').utc().toDate(),
        };
      }
      query.orderType = 'Sales';
      if (userId) {
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
            saleDate: new Date(saleDate),
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
      pricePerUnit: pricePerUnit?pricePerUnit: 0,
      description: description?description: null,
      saleDate: new Date(saleDate),
    });
    return successResponse(res, `Inventory ${type} successfully`);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
