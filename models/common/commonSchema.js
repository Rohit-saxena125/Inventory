const mongoose = require('mongoose');

const commonSchema = new mongoose.Schema(
  {
    // createdBy: {
    //     type: String,
    //     required: true,
    // },
    // updatedBy: {
    //     type: String,
    //     required: true,
    // },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // createdAt: {
    //     type: Date,
    //     required: true,
    // },
    // updatedAt: {
    //     type: Date,
    //     required: true,
    // },
    deletedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // isActive: {
    //     type: Boolean,
    //     required: true,
    // },
    // isBlocked: {
    //     type: Boolean,
    //     required: true,
    // },
    // isVerified: {
    //     type: Boolean,
    //     required: true,
    // },
    // isSuspended: {
    //     type: Boolean,
    //     required: true,
    // },
    // isApproved: {
    //     type: Boolean,
    //     required: true,
    // },
    // isRejected: {
    //     type: Boolean,
    //     required: true,
    // },
    // isPending: {
    //     type: Boolean,
    //     required: true,
    // },
    // isExpired: {
    //     type: Boolean,
    //     required: true,
    // },
  },
  { timestamps: true, versionKey: false, _id: false }
);

module.exports = commonSchema;
