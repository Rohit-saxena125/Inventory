const { v4: uuid } = require('uuid');
const router = require('express').Router();
const authRoutes = require('./auth/authRoute');
const unitRoutes = require('./unit/unitRoute');
const inventoryRoutes = require('./inventory/inventoryRoute');
const salesRoutes = require('./sales/salesRoute');
const userRoutes = require('./user/userRoute');
router.use('/auth', authRoutes);
router.use('/unit', unitRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/user', userRoutes);
router.use((req, res, next) => {
  req.identifier = uuid();
  console.log(
    `API hit with id: ${req.identifier} ${req.url} ${req.method} ${req.headers['user-agent']} ${JSON.stringify(req.body)}`
  );
  next();
});
router.use((req, res) => {
  console.warn(
    `404 Not found. Id: ${req.identifier} ${req.url} ${req.method} ${
      req.headers['user-agent']
    } ${JSON.stringify(req.body)}`,
    'warn'
  );
  return res.status(404).json({
    success: false,
    msg: '404 Not found',
  });
});

module.exports = router;
