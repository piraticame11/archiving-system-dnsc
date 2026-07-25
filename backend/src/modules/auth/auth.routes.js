const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const {
  registerRules, loginRules, forgotPasswordRules,
  changePasswordRules, updateProfileRules,
  bindPersonalEmailRules, verifyOtpRules,
} = require('./auth.validators');
const { handleValidation } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');

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

router.get('/me',              verifyToken, ctrl.getMe);
router.patch('/me',            verifyToken, updateProfileRules, handleValidation, ctrl.updateMe);
router.patch('/me/password',   verifyToken, changePasswordRules, handleValidation, ctrl.changePassword);

const studentGuard = [verifyToken, requireRole('student')];
router.post('/me/personal-email',         studentGuard, authLimiter, bindPersonalEmailRules, handleValidation, ctrl.bindPersonalEmail);
router.post('/me/personal-email/resend',  studentGuard, authLimiter, ctrl.resendPersonalEmailOtp);
router.post('/me/personal-email/verify',  studentGuard, authLimiter, verifyOtpRules, handleValidation, ctrl.verifyPersonalEmailOtp);

module.exports = router;
