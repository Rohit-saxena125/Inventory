const router = require('express').Router();
const unitController = require('../../controllers/unit/unitController');
const {tokenVerify,checkRole} = require('../../middlewares/authMiddleware');

router.post('/create',tokenVerify,checkRole(['Admin']),unitController.createUnit);
router.get('/fetch',tokenVerify,checkRole(['Admin', 'Cashier']),unitController.fetchUnits);
router.get('/fetch/:id',tokenVerify,checkRole(['Admin']),unitController.fetchUnitsById);
router.patch('/update/:id',tokenVerify,checkRole(['Admin']),unitController.updateUnit);
router.patch('/delete/:id',tokenVerify,checkRole(['Admin']),unitController.deleteUnit);

module.exports = router;