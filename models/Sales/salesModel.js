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
        required:true
    },
    price:{
        type:Number,
        required : true
    },
    saleDate:{
        type:Date,
        default: Date.now
    },
    itemId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Inventory",
        required:true
    },
    invoiceNumber:{
        type:Number,
    }
},{timestamps:true, versionKey:false});