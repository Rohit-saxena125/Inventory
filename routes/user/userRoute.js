const userController = require('../../controllers/user/userController');
const router = require('express').Router();
const { tokenVerify, checkRole } = require('../../middlewares/authMiddleware');

router.get('/fetchUsers', tokenVerify, checkRole(['Admin']), userController.fetchUsers);

module.exports = router;