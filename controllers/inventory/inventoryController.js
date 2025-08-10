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
    let {
      page = 1,
      limit = 10,
      search = '',
      startDate,
      endDate,
      qty,
      outOfStock,
      inActive,
    } = req.query;

    const toBool = (val) => String(val).toLowerCase() === 'true';
    page = parseInt(page);
    limit = parseInt(limit);

    const query = {};

    // Date filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: moment.tz(startDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').utc().toDate(),
        $lte: moment.tz(endDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').utc().toDate(),
      };
    }

    // Search filter
    search = String(search).trim();
    if (search) {
      const cleaned = search.replace(/[^a-zA-Z0-9]/g, '');
      const flexibleRegex = cleaned.split('').join('[^a-zA-Z0-9]*');
      query.itemName = { $regex: flexibleRegex, $options: 'i' };
    }

    // Fetch only item _ids for filtering & optimization
    const items = await Inventory.find(query).lean();
    const itemIds = items.map((item) => item._id);

    if (!itemIds.length) {
      return successResponse(res, 'Inventory fetched successfully', {
        result: [],
        total: 0,
        page,
        limit,
      });
    }

    // Fetch relevant sales data in parallel
    const [openingStocks, salesByItem] = await Promise.all([
      Sale.aggregate([
        { $match: { orderType: 'Opening', itemId: { $in: itemIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$itemId',
            minQty: { $first: '$minQty' },
          },
        },
      ]),
      Sale.aggregate([
        { $match: { itemId: { $in: itemIds } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: '$itemId',
            sales: { $push: '$$ROOT' },
          },
        },
      ]),
    ]);

    // Map for quick access
    const openingStockMap = Object.fromEntries(openingStocks.map(stock => [stock._id.toString(), stock]));
    const salesMap = Object.fromEntries(salesByItem.map(entry => [entry._id.toString(), entry.sales]));

    // Merge and compute enriched data
    let enrichedItems = items.map((item) => {
      const itemId = item._id.toString();
      const sales = salesMap[itemId] || [];
      const openingStock = openingStockMap[itemId];

      let quantity = 0;
      let stockValue = 0;
      let lastSaleDate = null;

      for (const sale of sales) {
        const qty = parseInt(sale.quantity, 10) || 0;
        const rate = parseFloat(sale.pricePerUnit);

        if (sale.orderType === 'Sales' && !lastSaleDate) {
          lastSaleDate = sale.createdAt;
        }

        switch (sale.orderType) {
          case 'Opening':
          case 'Add':
            quantity += qty;
            stockValue += qty * rate;
            break;
          case 'Reduce':
            quantity -= qty;
            stockValue -= qty * rate;
            break;
          case 'Sales':
            const avg = quantity > 0 ? stockValue / quantity : rate;
            quantity -= qty;
            stockValue -= qty * avg;
            break;
        }

      }

      return {
        ...item,
        quantity,
        stockValue:quantity<=0? 0: parseFloat(stockValue.toFixed(2)),
        isOutOfStock: quantity <= 0,
        isBelowMinQty: quantity <= parseInt(openingStock?.minQty || 0),
        isInactive: lastSaleDate
          ? moment().diff(moment(lastSaleDate), 'days') > 60
          : false,
      };
    });

    // Apply filters
    if (toBool(qty)) {
      enrichedItems = enrichedItems.filter((item) => item.isBelowMinQty);
    }
    if (toBool(outOfStock)) {
      enrichedItems = enrichedItems.filter((item) => item.isOutOfStock);
    }
    if (toBool(inActive)) {
      enrichedItems = enrichedItems.filter((item) => item.isInactive);
    }

    const total = enrichedItems.length;
    const start = (page - 1) * limit;
    const result = enrichedItems.slice(start, start + limit);

    return successResponse(res, 'Inventory fetched successfully', {
      result,
      total,
      page,
      limit,
    });
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
          const avgCost = currentQuantity > 0 ? currentStockValue / currentQuantity : pricePerUnit;
          const costOfGoodsSold = quantity * avgCost;
          currentQuantity -= quantity;
          currentStockValue -= costOfGoodsSold;
          break;
        default:
          break;
      }
      currentQuantity = currentQuantity;
      currentStockValue =  currentStockValue;
    });
    const openingStock = sales.find((s) => s.orderType === 'Opening');
    inventory = inventory.toObject();
    inventory.openingStock = openingStock;
    inventory.stockValue = currentQuantity<=0?0: parseFloat(currentStockValue.toFixed(2));
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
    let sales = await Sale.find({ itemId: inventory._id,type: 'Inventory' });
    if (sales.length > 0) {
      await Sale.deleteMany({ itemId: inventory._id, type: 'Inventory' });
    }
    return successResponse(res, 'Inventory deleted successfully');
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.reportInventory = async (req, res, next) => {
  try {
    const { startDate, endDate, type, userId, qty, outOfStock, inActive } = req.query;
    const toBool = (val) => String(val).toLowerCase() === 'true';
    let query = {};

    if (type === 'Inventory') {
      // Prepare date filter for inventory items
      if (startDate && endDate) {
        query.createdAt = {
          $gte: moment.tz(startDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').utc().toDate(),
          $lte: moment.tz(endDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').utc().toDate(),
        };
      }

      const allInventoryItems = await Inventory.find(query);
      const itemIds = allInventoryItems.map((item) => item._id);

      // Batch fetch all sales for these items
      const salesByItem = await Sale.aggregate([
        { $match: { itemId: { $in: itemIds } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: '$itemId',
            sales: { $push: '$$ROOT' },
          },
        },
      ]);

      const salesMap = new Map();
      salesByItem.forEach((item) => salesMap.set(item._id.toString(), item.sales));

      // Batch fetch latest opening stock entries
      const openingStockAgg = await Sale.aggregate([
        { $match: { orderType: 'Opening', itemId: { $in: itemIds } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: '$itemId',
            minQty: { $first: '$minQty' },
          },
        },
      ]);

      const openingStockMap = new Map();
      openingStockAgg.forEach((stock) => openingStockMap.set(stock._id.toString(), stock));

      // Perform calculation locally
      let inventoryCalculations = allInventoryItems.map((item) => {
        const itemId = item._id.toString();
        const sales = salesMap.get(itemId) || [];
        const openingStock = openingStockMap.get(itemId);

        let currentQuantity = 0;
        let currentStockValue = 0;
        let lastSaleDate = null;

        for (const sale of sales) {
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
              const avgCost = currentQuantity > 0 ? currentStockValue / currentQuantity : pricePerUnit;
              const costOfGoodsSold = quantity * avgCost;
              currentQuantity -= quantity;
              currentStockValue -= costOfGoodsSold;
              break;
          }
        }

        return {
          item,
          quantity: currentQuantity,
          stockValue: currentQuantity <=0 ? 0 :currentStockValue,
          isOutOfStock: currentQuantity <= 0,
          isBelowMinQty: currentQuantity <= parseInt(openingStock?.minQty || 0),
          isInactive: lastSaleDate ? moment().diff(moment(lastSaleDate), 'days') > 60 : false,
        };
      });

      // Apply filters
      if (toBool(qty)) {
        inventoryCalculations = inventoryCalculations.filter((item) => item.isBelowMinQty);
      }
      if (toBool(outOfStock)) {
        inventoryCalculations = inventoryCalculations.filter((item) => item.isOutOfStock);
      }
      if (toBool(inActive)) {
        inventoryCalculations = inventoryCalculations.filter((item) => item.isInactive);
      }

      // Final statistics
      const noOFItems = inventoryCalculations.length;
      const totalStockValue = inventoryCalculations.reduce((sum, calc) => sum + Math.abs(calc.stockValue), 0);
      const lowStockCount = inventoryCalculations.filter((item) => item.isBelowMinQty).length;

      return successResponse(res, 'Inventory report fetched successfully', {
        noOFItems,
        totalStockValue: parseFloat(totalStockValue.toFixed(2)),
        lowStockItems: lowStockCount,
      });

    } else {
      // Sales report
      query.isDeleted = false;
      if (startDate && endDate) {
        query.saleDate = {
          $gte: moment.tz(startDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').utc().toDate(),
          $lte: moment.tz(endDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').utc().toDate(),
        };
      }
      query.orderType = 'Sales';
      if (userId) query.createdBy = userId;

      const sales = await Sale.find(query);
      const uniqueInvoices = new Set();
      let totalSalesAmount = 0;

      for (const sale of sales) {
        const price = parseFloat(sale.pricePerUnit) || 0;
        const quantity = parseInt(sale.quantity, 10) || 0;
        totalSalesAmount += price * quantity;
        if (sale.invoiceNumber) uniqueInvoices.add(sale.invoiceNumber);
      }

      return successResponse(res, 'Sales report fetched successfully', {
        noOFItems: uniqueInvoices.size,
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
    const item = await Inventory.findById({_id:itemId});
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
      const updateFields = {
  orderType: sale.orderType,
  quantity,
  pricePerUnit :sale?.orderType =="Reduce" && (pricePerUnit ==0 && sale.pricePerUnit ==0)?itemId.salePrice: pricePerUnit>0?pricePerUnit: sale.pricePerUnit,
  description,
};
if (saleDate) {
  updateFields.saleDate = new Date(saleDate);
}
      sale = await Sale.findByIdAndUpdate(
        { _id: sale._id },
        {
           $set: updateFields,
        },
        { new: true, runValidators: true }
      );
      return successResponse(res, 'Inventory updated successfully', sale);
    }
    const addReduce = await Sale.create({
      orderType: type,
      itemId: itemId,
      quantity: quantity,
      pricePerUnit: type ==="Reduce" && pricePerUnit == 0? item.salePrice : pricePerUnit,
      description: description?description: null,
      saleDate: new Date(saleDate),
    });
    return successResponse(res, `Inventory ${type} successfully`);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};
