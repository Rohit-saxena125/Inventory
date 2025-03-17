const router = require('express').Router();
const inventoryController = require('../../controllers/inventory/inventoryController');
const {tokenVerify,checkRole} = require('../../middlewares/authMiddleware');

router.post('/create',tokenVerify,checkRole(['Admin']),inventoryController.createInventory);
router.get('/fetch',tokenVerify,checkRole(['Admin', 'Cashier']),inventoryController.getAllInventory);
router.get('/fetch/:id',tokenVerify,checkRole(['Admin']),inventoryController.getInventoryById);
router.patch('/update/:id',tokenVerify,checkRole(['Admin']),inventoryController.updateInventory);
router.patch('/delete/:id',tokenVerify,checkRole(['Admin']),inventoryController.deleteInventory);

module.exports = router;