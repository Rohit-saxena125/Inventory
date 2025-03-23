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
    });
    const cahier1 = new User({
      name: 'Cashier1',
      email: 'cashier@gmail.com',
      phone: '1234567890',
      role: 'Cashier',
    });
    const cahier2 = new User({
      name: 'Cashier2',
      email: 'cashier1@gmail.com',
      phone: '1234567890',
      role: 'Cashier',
    });
    await cahier1.save();
    await cahier2.save();
    await admin.save();
  } catch (error) {
    console.log(error);
  }
};
