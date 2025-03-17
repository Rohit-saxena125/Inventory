const Unit = require('../../models/units/unitsModel');
const {
  successResponse,
  badRequestErrorResponse,
  internalServerErrorResponse,
} = require('../../utils/customResponse');
const {pagination} = require("../../utils/pagination");

exports.createUnit = async (req,res ,next) =>{
    try {
        const {unitName} = req.body;
        const unitExist = await Unit.findOne({unitName});
        if(unitExist){
            return badRequestErrorResponse(res, "Unit already exist");
        }
        const unit = await Unit.create({
            unitName
        });
        return successResponse(res, "Unit created successfully");
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.fetchUnits = async(req,res,next) => {
    try {
        const {page, limit,search} = req.query;
        const query = {};
        if(search){
            query.unitName = {
                $regex: search,
                $options: "i"
            }
        }
        const units = await pagination(Unit, query,page, limit);
        return successResponse(res, "Units fetched successfully", units);
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.fetchUnitsById = async(req,res,next) => {
    try {
        const id = req.params.id;
        const unit = await Unit.findById(id);
        if(!unit){
            return badRequestErrorResponse(res, "Unit not found");
        }
        return successResponse(res, "Unit fetched successfully", unit);
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.updateUnit = async(req,res,next) => {
    try {
        const id = req.params.id;
        const {unitName} = req.body;
        const unit = await unit.findOne({unitName:unitName ,_id:{$ne:id}});
        if(unit){
            return badRequestErrorResponse(res, "Unit already exist");
        }
        const updatedUnit = await Unit.findByIdAndUpdate(id, {unitName},{new:true,runValidators:true});
        return successResponse(res, "Unit updated successfully", updatedUnit);
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}

exports.deleteUnit = async(req,res,next) => {
    try {
        const id = req.params.id;
        const unit = await Unit.findById(id);
        if(!unit){
            return badRequestErrorResponse(res, "Unit not found");
        }
        await Unit.findByIdAndDelete(id);
        return successResponse(res, "Unit deleted successfully");
    } catch (error) {
        return internalServerErrorResponse(res, error);
    }
}