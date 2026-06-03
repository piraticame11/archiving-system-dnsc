const service = require('./panelists.service');
const { getPagination } = require('../../utils/pagination');
const { sendSuccess, sendCreated, send400, send404 } = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await service.listPanelists({
      search:        req.query.search,
      status:        req.query.status,
      department_id: req.query.department_id,
      page, limit,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const p = await service.getPanelistById(req.params.id);
    if (!p) return send404(res, 'Panelist not found');
    sendSuccess(res, p);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const p = await service.createPanelist(req.body);
    sendCreated(res, p, 'Panelist created successfully');
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const p = await service.updatePanelist(req.params.id, req.body);
    sendSuccess(res, p, 'Panelist updated successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const p     = await service.toggleActive(req.params.id);
    const label = p.is_active ? 'activated' : 'deactivated';
    sendSuccess(res, p, `Panelist ${label} successfully`);
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

async function remove(req, res, next) {
  try {
    await service.deletePanelist(req.params.id);
    sendSuccess(res, null, 'Panelist deleted successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

module.exports = { list, getOne, create, update, toggleActive, resetPassword, remove };
