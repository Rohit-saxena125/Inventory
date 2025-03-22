const mongoose = require("mongoose");
const {ORDER} = require('../../constants/userConstants');

const salesSchema = new mongoose.Schema({
    orderType:{
        type:String,
        required: true,
        enum: ORDER.STATUS
    },
    quantity:{
        type:String,
        required:true,
        default:"0"
    },
    pricePerUnit:{
        type:String,
        required : true,
        default:"0"
        
    },
    description:{
        type: String
    },
    saleDate:{
        type:Date
    },
    itemId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Inventory",
        required:true
    },
    discount:{
        type:String,
        default:"0"
    },
    totalAmount:{
        type:String,
        default:"0"
    },
    invoiceNumber:{
        type:Number,
    },
    customerName:{
        type:String
    },
    minQty:{
        type:String
    },
    isDeleted:{
        type: Boolean,
        default: false,
    },
},{timestamps:true, versionKey:false});

module.exports = mongoose.model("Sale",salesSchema);