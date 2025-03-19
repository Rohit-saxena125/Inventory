const router = require('express').Router();
const salesController = require('../../controllers/sales/salesController');
const { tokenVerify,checkRole } = require('../../middlewares/authMiddleware');

router.get('/fetchSales', tokenVerify, checkRole(['Admin']), salesController.fetchSales);
router.get('/fetchSales/:id', tokenVerify, checkRole(['Admin']), salesController.fetchSalesById);

module.exports = router;