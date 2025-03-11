const jwt = require('jsonwebtoken');
const User = require('../models/user/userModel');
const {
  unauthorizedErrorResponse,
  internalServerErrorResponse,
} = require('../utils/customResponse');

exports.tokenVerify = async (req, res, next) => {
  try {
    let token;
    const refreshToken = req.cookies['jwt'];

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return unauthorizedErrorResponse(
        res,
        'Access Denied. No token provided.'
      );
    }

    let decoded,
      accessTokenExpired = false;
    jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET,
      async (err, decodeData) => {
        if (err) {
          if (err.message === 'jwt expired' && refreshToken) {
            decodeData = jwt.verify(
              refreshToken,
              process.env.JWT_REFRESH_SECRET
            );
            accessTokenExpired = true;
          } else {
            return unauthorizedErrorResponse(res, 'Invalid token');
          }
        }

        decoded = decodeData;
        const user = await User.findById(decoded._id);

        if (!user) {
          return unauthorizedErrorResponse(res, 'Invalid token');
        }

        if (user.isDeleted.isDeleted) {
          return unauthorizedErrorResponse(
            res,
            'Account deleted or disabled. Please contact admin.'
          );
        }

        if (accessTokenExpired) {
          res
            .cookie('jwt', user.getSignedJwtRefreshToken(), {
              httpOnly: true,
              sameSite: 'strict',
              secure: true,
              maxAge: 24 * 60 * 60 * 1000,
            })
            .header('Authorization', user.getSignedJwtToken());
        }

        req.user = user;
        next();
      }
    );
  } catch (error) {
    internalServerErrorResponse(res, error);
  }
};

exports.checkRole = (roles) => async (req, res, next) => {
  try {
    if (!roles.includes(req?.user?.role)) {
      return unauthorizedErrorResponse(res, 'You are not allowed to access');
    }
    next();
  } catch (error) {
    internalServerErrorResponse(res, error);
  }
};
