const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
    },
    otp: {
      type: Number,
      required: true,
      unique: true,
    },
    isUses: {
      type: Boolean,
      default: false,
    },
    expireAt: { type: Date, default: new Date(), required: true },
  },
  { versionKey: false, timestamps: true }
);
otpSchema.index({ expireAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('Otp', otpSchema);
