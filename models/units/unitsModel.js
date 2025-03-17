const mongoose = require("mongoose");

const unitsSchema = new mongoose.Schema({
    unitName:{
        type:String,
        required:true
    }
},{timestamps:true, versionKey:false});

module.exports = mongoose.model("Units",unitsSchema);