const User = require('../models/user/userModel');

exports.createAdmin = async () => {
  try {
    const adminExists = await User.findOne({
      role: 'Admin',
      'isDeleted.isDeleted': false,
    });
    if (adminExists) return;
    const admin = new User({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      phone: process.env.ADMIN_PHONE,
      role: 'Admin',
      password: process.env.ADMIN_PASSWORD,
    });
    await admin.save();
    console.log('Admin Created');
  } catch (error) {
    console.log(error);
  }
};
