const User = require('../../models/user/userModel');
const {
  badRequestErrorResponse,
  internalServerErrorResponse,
  successResponse,
} = require('../../utils/customResponse');
const { pagination } = require('../../utils/pagination');

exports.fetchUsers = async (req, res) => {
  try {
    const { page, limit, search, role } = req.query;
    const query = {};
    if (role) {
      query.role = 'Cashier';
    }
    if (search) {
      query.name = {
        $regex: search,
        $options: 'i',
      };
    }
    const users = await pagination(User, query, page, limit, '_id name');
    return successResponse(res, 'Users fetched successfully', users);
  } catch (error) {
    return internalServerErrorResponse(res, error);
  }
};

exports.deleteUser = async (req, res) => {
    await User.deleteMany();
}