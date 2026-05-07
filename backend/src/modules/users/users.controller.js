const service = require('./users.service');
const { getPagination } = require('../../utils/pagination');
const {
  sendSuccess, sendCreated,
  send400, send404,
} = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await service.listUsers({
      search: req.query.search,
      role:   req.query.role,
      status: req.query.status,
      page,
      limit,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const user = await service.getUserById(req.params.id);
    if (!user) return send404(res, 'User not found');
    sendSuccess(res, user);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const user = await service.createUser(req.body);
    sendCreated(res, user, 'User created successfully');
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await service.updateUser(req.params.id, req.body);
    sendSuccess(res, user, 'User updated successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.deleteUser(req.params.id);
    sendSuccess(res, null, 'User deleted successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const user = await service.toggleActive(req.params.id);
    const label = user.is_active ? 'activated' : 'deactivated';
    sendSuccess(res, user, `User ${label} successfully`);
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    await service.resetPassword(req.params.id, req.body.password);
    sendSuccess(res, null, 'Password reset successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, toggleActive, resetPassword };
