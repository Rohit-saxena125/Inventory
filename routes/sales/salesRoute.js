const router = require('express').Router();
const salesController = require('../../controllers/sales/salesController');
const { tokenVerify,checkRole } = require('../../middlewares/authMiddleware');

router.get('/fetchSales', tokenVerify, checkRole(['Admin']), salesController.fetchSales);
router.get('/fetchSales/:id', tokenVerify, checkRole(['Admin']), salesController.fetchSalesById);
router.post('/createSales', tokenVerify, checkRole(['Admin','Cashier']), salesController.createSales);
router.patch('/updateSales/:id', tokenVerify, checkRole(['Admin']), salesController.updateSales);
router.patch('/deleteSales/:id', tokenVerify, checkRole(['Admin']), salesController.deleteSales);

module.exports = router;