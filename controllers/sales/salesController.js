const Sale = require('../../models/Sales/salesModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const {pagination} = require("../../utils/pagination");

exports.fetchSales = async(req,res) =>{
    try {
       const {page,limit,search,itemId} = req.query;
       const query = {};
       if(itemId){
           query.itemId = itemId;
       }
       if(search){
           query.orderType = {
               $regex: search,
               $options: "i"
           }
       }
       const sales = await pagination(Sale,query,page,limit);
       sales.result = await Promise.all(sales.result.map(async (item) =>{
        const totalPrice = (parseFloat(item.pricePerUnit) * parseFloat(item.quantity)).toFixed(2);
        return{
            ...item.toObject(),
            totalPrice: totalPrice
        }
       }));
       return successResponse(res,"Sales fetched successfully",sales);
    } catch (error) {
        return internalServerErrorResponse(res,error);
    }
}

exports.fetchSalesById = async(req,res) =>{
    try {
        const {id} = req.params;
        const sales = await Sale.findById(id).populate("itemId");
        if(!sales){
            return badRequestErrorResponse(res,"Sales not found");
        }
        if(sales.orderType === "Opening"){
            return badRequestErrorResponse(res,"Opening stock cannot be updated");
        }
        return successResponse(res,"Sales fetched successfully",sales);
    } catch (error) {
        return internalServerErrorResponse(res,error);
    }
}