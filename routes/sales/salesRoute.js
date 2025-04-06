const router = require('express').Router();
const salesController = require('../../controllers/sales/salesController');
const { tokenVerify,checkRole } = require('../../middlewares/authMiddleware');

router.get('/fetchSales', tokenVerify, checkRole(['Admin']), salesController.fetchSales);
router.get('/fetchSales/:id', tokenVerify, checkRole(['Admin']), salesController.fetchSalesById);
router.post('/createSales', tokenVerify, checkRole(['Admin','Cashier']), salesController.createSales);
router.patch('/updateSales/:id', tokenVerify, checkRole(['Admin']), salesController.updateSales);
router.patch('/deleteSales/:id', tokenVerify, checkRole(['Admin']), salesController.deleteSales);
router.get('/fetchSalesInvoice/:id', tokenVerify, checkRole(['Admin','Cashier']), salesController.downloadInvoice);
router.delete('/deleteSales', tokenVerify, checkRole(['Admin']), salesController.deleteSalesAll);
router.post('/fetchSalesReport', tokenVerify, checkRole(['Admin']), salesController.downloadSalesReport);
router.get('/fetchInvoiceNumber', tokenVerify, checkRole(['Admin','Cashier']), salesController.fetchInvoiceNumber);
router.get('/fetchSaleDummy', tokenVerify, checkRole(['Admin','Cashier']), salesController.fetchDummySales);
module.exports = router;