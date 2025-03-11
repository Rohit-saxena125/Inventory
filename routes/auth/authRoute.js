const router = require('express').Router();
const authController = require("../../controllers/auth/authController");
const {tokenVerify} = require('../../middlewares/authMiddleware');

router.post("/send-otp",authController.sendOtp);
router.post("/verify-otp",authController.verifyOtp);
router.get("/profile",tokenVerify,authController.profile);

module.exports = router;
