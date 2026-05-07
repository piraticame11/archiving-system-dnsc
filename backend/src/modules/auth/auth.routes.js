const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const {
  registerRules, loginRules, forgotPasswordRules,
  resetPasswordRules, changePasswordRules, updateProfileRules,
} = require('./auth.validators');
const { handleValidation } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register',        authLimiter, registerRules,       handleValidation, ctrl.register);
router.post('/login',           authLimiter, loginRules,          handleValidation, ctrl.login);
router.post('/refresh',         ctrl.refresh);
router.post('/logout',          ctrl.logout);
router.post('/forgot-password', authLimiter, forgotPasswordRules, handleValidation, ctrl.forgotPassword);
router.post('/reset-password',  authLimiter, resetPasswordRules,  handleValidation, ctrl.resetPassword);

router.get('/me',              verifyToken, ctrl.getMe);
router.patch('/me',            verifyToken, updateProfileRules, handleValidation, ctrl.updateMe);
router.patch('/me/password',   verifyToken, changePasswordRules, handleValidation, ctrl.changePassword);

module.exports = router;
