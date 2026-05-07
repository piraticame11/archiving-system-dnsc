const authService = require('./auth.service');
const { sendSuccess, sendCreated, sendError, send400, send401 } = require('../../utils/responseHelper');

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
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });
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
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });
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
    res.clearCookie('refresh_token');
    sendSuccess(res, null, 'Logged out.');
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, null, 'If that email is registered, a reset link has been sent.');
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password reset successfully.');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
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

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, getMe, updateMe, changePassword };
