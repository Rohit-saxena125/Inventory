const mongoose = require('mongoose');
const commonSchema = require('../common/commonSchema');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { USER } = require('../../constants/userConstants');
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: USER.ROLE,
      default: USER.ROLE[2],
    },
    createdBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false }
);

userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRE,
    }
  );
};

userSchema.methods.getSignedJwtRefreshToken = function () {
  this.refreshToken = jwt.sign(
    { _id: this._id, email: this.email },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE,
    }
  );
  return this.refreshToken;
};

module.exports = mongoose.model('User', userSchema);
