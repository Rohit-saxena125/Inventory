const User = require('../../models/user/userModel');
const Otp = require('../../models/user/otpModel');
const { USER } = require('../../constants/userConstants');
const {
  badRequestErrorResponse,
  internalServerErrorResponse,
  successResponse,
} = require('../../utils/customResponse');
const { generateCode, sendEmail, htmlMail } = require('../../utils/helper');

exports.sendOtp = async (req, res, next) => {
  try {
    const {email} = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return next(badRequestErrorResponse(res, 'Invalid email or password'));
    }
      const otp = generateCode(4, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });
      let otpSend = await Otp.create({
        email: user.email,
        otp: otp,
      });
      let message = { name: user.name, otp: otp, type: 'OTP' };
      await sendEmail({
        subject: 'OTP Verification',
        message: htmlMail(message),
      });
      return successResponse(res, 'Otp Send Successfully');
  } catch (error) {
    return next(internalServerErrorResponse(res, error));
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const otpData = await Otp.findOneAndUpdate({
      email,
      otp,
      isUses: false,
    },{$set:{isUses:true}},{new:true,runValidators:true}).exec();
    if (!otpData) {
      return next(badRequestErrorResponse(res, 'Invalid OTP'));
    }
    const user = await User.findOne({ email: otpData.email });
    if (!user) {
      return next(badRequestErrorResponse(res, 'Your account not found'));
    }
    const token = user.getSignedJwtToken();
    const refreshToken = user.getSignedJwtRefreshToken();
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    return successResponse(res, 'login successfully', { token, user });
  } catch (error) {
    return next(internalServerErrorResponse(res, error));
  }
};

exports.profile = async (req, res, next) => {
  try {
    const user = req.user;
    return successResponse(res, 'User Profile', user);
  } catch (error) {
    return next(internalServerErrorResponse(res, error));
  }
};

exports.forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return next(badRequestErrorResponse(res, 'Your account not found'));
    }
    if (user.isDeleted.isDeleted) {
      return next(
        badRequestErrorResponse(res, 'Account is deleted, please contact admin')
      );
    }
  } catch (error) {
    return next(internalServerErrorResponse(res, error));
  }
};

// exports.changePassword = async (req, res, next) => {
//   try {
//     const { password, newPassword } = req.body;
//     const user = await User.findById(req.user.id).select('+password');
//     const isMatch = await user.matchPassword(password);
//     if (!isMatch) {
//       return next(badRequestErrorResponse(res, 'Invalid password'));
//     }
//     user.password = newPassword;
//     await user.save();
//     return successResponse(res, 'Password changed successfully');
//   } catch (error) {
//     return next(internalServerErrorResponse(res, error));
//   }
// };
