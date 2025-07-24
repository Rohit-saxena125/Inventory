const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  itemName:{
    type:String,
    required: true,
    index: true 
  },
  units:{
    type: String,
    required : true
  },
  purchasePrice:{
    type:String,
    default:"0"
  },
  salePrice:{
    type:String,
    default:"0"
  },
},{timestamps:true, versionKey:false});
inventorySchema.index({ itemName: 1 });

module.exports = mongoose.model("Inventory",inventorySchema);