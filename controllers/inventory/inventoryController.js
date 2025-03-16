const Inventory = require('../../models/inventory/inventoryModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const {pagination} = require("../../utils/pagination");

exports.createInventory = async (req,res ,next) => {
    try {
        const {itemName, quantity, units, purchasePrice, salePrice, openingStock, minStockQty, asOfDate,payPerUnit} = req.body;
        const inventoryExist = await Inventory.findOne({itemName});
        if(inventoryExist){
            return badRequestErrorResponse(res, "Inventory already exist");
        }
        const inventory = await Inventory.create({
            itemName,
            quantity,
            units,
            purchasePrice,
            salePrice,
        });
        return successResponse(res, "Inventory created successfully", inventory);
    } catch (error) {
        return internalServerErrorResponse(res, error.message);
    }
}

exports.getAllInventory = async (req,res ,next) => {
    const { page, limit , search, } = req.query;
    try {
        const query = {};
        if(search){
            query.itemName = {
                $regex: search,
                $options: "i"
            }
        }
        const inventory = await
        pagination(Inventory, query, "", page, limit);
        return successResponse(res, "Inventory fetched successfully", inventory);
    }
    catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.getInventoryById = async (req,res ,next) => {
    try {
        const inventory = await Inventory.findById(req.params.id);
        if(!inventory){
            return badRequestErrorResponse(res, "Inventory not found");
        }
        return successResponse(res, "Inventory fetched successfully", inventory);
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.updateInventory = async (req,res ,next) => {
    try {
        const inventory = await Inventory.findByIdAndUpdate(req
            .params.id, req.body, {new: true});
        if(!inventory){
            return badRequestErrorResponse(res, "Inventory not found");
        }
        return successResponse(res, "Inventory updated successfully", inventory);
    }
    catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.deleteInventory = async (req,res ,next) => {
    try {
        const inventory = await Inventory.findByIdAndDelete(req.params.id);
        if(!inventory){
            return badRequestErrorResponse(res, "Inventory not found");
        }
        return successResponse(res, "Inventory deleted successfully");
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}