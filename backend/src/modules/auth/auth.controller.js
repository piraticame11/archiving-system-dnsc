const authService = require('./auth.service');
const { sendSuccess, sendCreated, sendError, send400, send401 } = require('../../utils/responseHelper');

function isHttpsRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return Boolean(req.secure || forwardedProto === 'https');
}

function refreshCookieOptions(req, includeMaxAge = true) {
  const opts = {
    path:     '/',
    httpOnly: true,
    secure:   isHttpsRequest(req),
    sameSite: 'Lax',
  };
  if (includeMaxAge) opts.maxAge = 7 * 24 * 60 * 60 * 1000;
  return opts;
}

function setRefreshCookie(res, req, refreshToken) {
  res.cookie('refresh_token', refreshToken, refreshCookieOptions(req, true));
}

async function register(req, res, next) {
  try {
    const id = await authService.register(req.body);
    sendCreated(res, { id }, 'Registration successful. Await account activation by the Research Office.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body.email, req.body.password);
    setRefreshCookie(res, req, refreshToken);
    sendSuccess(res, { accessToken, user }, 'Login successful.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!token) return send401(res, 'Refresh token required.');

    const { accessToken, refreshToken } = await authService.refresh(token);
    setRefreshCookie(res, req, refreshToken);
    sendSuccess(res, { accessToken }, 'Token refreshed.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (token) await authService.logout(token);
    res.clearCookie('refresh_token', refreshCookieOptions(req, false));
    sendSuccess(res, null, 'Logged out.');
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    await authService.forgotPassword(req.body.identifier);
    sendSuccess(res, null, 'If that email is registered, a temporary password has been sent.');
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.findUserById(req.user.id);
    if (!user) return sendError(res, 404, 'User not found.');
    const { password_hash, ...safe } = user;
    sendSuccess(res, safe);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const photo = req.file ? req.file.filename : undefined;
    await authService.updateProfile(req.user.id, { ...req.body, profile_photo: photo });
    sendSuccess(res, null, 'Profile updated.');
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body.current_password, req.body.new_password);
    sendSuccess(res, null, 'Password changed.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function bindPersonalEmail(req, res, next) {
  try {
    await authService.bindPersonalEmail(req.user.id, req.body.personal_email);
    sendSuccess(res, null, 'Verification code sent to your personal email.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function resendPersonalEmailOtp(req, res, next) {
  try {
    await authService.resendPersonalEmailOtp(req.user.id);
    sendSuccess(res, null, 'A new code has been sent.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function verifyPersonalEmailOtp(req, res, next) {
  try {
    await authService.verifyPersonalEmailOtp(req.user.id, req.body.code);
    sendSuccess(res, null, 'Personal email verified.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}


async function studentRegister(req, res, next) {
  try {
    const data = await authService.initiateStudentRegistration(req.body);
    sendSuccess(res, data, 'Verification code sent to your email.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function studentResendOtp(req, res, next) {
  try {
    const data = await authService.resendStudentRegistrationOtp(req.body.email);
    sendSuccess(res, data, 'A new verification code has been sent to your email.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

async function studentVerifyOtp(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.verifyStudentRegistrationOtp(req.body);
    setRefreshCookie(res, req, refreshToken);
    sendSuccess(res, { accessToken, user }, 'Account successfully created and verified.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
}

module.exports = {
  register, login, refresh, logout, forgotPassword, getMe, updateMe, changePassword,
  bindPersonalEmail, resendPersonalEmailOtp, verifyPersonalEmailOtp,
  studentRegister, studentResendOtp, studentVerifyOtp,
};
