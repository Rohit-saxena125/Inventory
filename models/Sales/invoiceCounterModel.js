const mongoose = require("mongoose");
const invoiceCounterSchema = new mongoose.Schema({
    invoiceNumber: { type: Number, default: 0 },
  },{versionKey:false},{timestamps:true});

module.exports = mongoose.model("InvoiceCounter",invoiceCounterSchema);