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
  openingStock:{
    type:Number,
    default:0
  },
  minStockQty:{
    type:Number,
    default:0
  },
  asOfDate:{
    type:Date,
    required:true,
    default: Date.now()
  },
},{timestamps:true, versionKey:false});

module.exports = mongoose.model("Inventory",inventorySchema);