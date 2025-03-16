const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  itemName:{
    type:String,
    required: true,
  },
  quantity:{
    type:String,
    required:true
  },
  units:{
    type: String,
    required : true
  },
  purchasePrice:{
    type:Number,
    default:0
  },
  salePrice:{
    type:Number,
    default:0
  },
},{timestamps:true, versionKey:false});

module.exports = mongoose.model("Inventory",inventorySchema);