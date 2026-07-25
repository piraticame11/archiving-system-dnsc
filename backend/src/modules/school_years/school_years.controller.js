const service = require('./school_years.service');
const { sendSuccess, sendCreated, send404 } = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const include_inactive = ['true', '1'].includes(req.query.include_inactive);
    const rows = await service.listSchoolYears({ include_inactive });
    sendSuccess(res, rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const row = await service.createSchoolYear(req.body.label);
    sendCreated(res, row, 'School year created');
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'School year not found');
    const row = await service.toggleActive(req.params.id);
    sendSuccess(res, row, 'School year status toggled');
  } catch (err) { next(err); }
}

module.exports = { list, create, toggleActive };
