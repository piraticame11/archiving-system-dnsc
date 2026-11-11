const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const {
  registerRules, loginRules, forgotPasswordRules,
  changePasswordRules, updateProfileRules,
  bindPersonalEmailRules, verifyOtpRules,
  studentRegisterRules, studentResendOtpRules, studentVerifyOtpRules,
} = require('./auth.validators');
const { handleValidation } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { uploadProfilePhoto } = require('../../config/multer');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});


// Public student self-registration with OTP
router.post('/student-register',            authLimiter, studentRegisterRules,  handleValidation, ctrl.studentRegister);
router.post('/student-register/send-otp',   authLimiter, studentRegisterRules,  handleValidation, ctrl.studentRegister);
router.post('/student-register/resend-otp', authLimiter, studentResendOtpRules, handleValidation, ctrl.studentResendOtp);
router.post('/student-register/verify-otp', authLimiter, studentVerifyOtpRules, handleValidation, ctrl.studentVerifyOtp);

router.post('/register',        authLimiter, registerRules,       handleValidation, ctrl.register);
router.post('/login',           authLimiter, loginRules,          handleValidation, ctrl.login);
router.post('/refresh',         ctrl.refresh);
router.post('/logout',          ctrl.logout);
router.post('/forgot-password', authLimiter, forgotPasswordRules, handleValidation, ctrl.forgotPassword);

router.get('/me',              verifyToken, ctrl.getMe);
router.patch('/me',            verifyToken, uploadProfilePhoto.single('profile_photo'), updateProfileRules, handleValidation, ctrl.updateMe);
router.patch('/me/password',   verifyToken, changePasswordRules, handleValidation, ctrl.changePassword);

const studentGuard = [verifyToken, requireRole('student')];
router.post('/me/personal-email',         studentGuard, authLimiter, bindPersonalEmailRules, handleValidation, ctrl.bindPersonalEmail);
router.post('/me/personal-email/resend',  studentGuard, authLimiter, ctrl.resendPersonalEmailOtp);
router.post('/me/personal-email/verify',  studentGuard, authLimiter, verifyOtpRules, handleValidation, ctrl.verifyPersonalEmailOtp);

module.exports = router;
