const service = require('./adviser.service');
const { getPagination } = require('../../utils/pagination');
const { sendSuccess, sendCreated, send400 } = require('../../utils/responseHelper');

async function myAdvisees(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await service.getMyAdvisees(req.user.id, {
      search: req.query.search,
      status: req.query.status,
      page, limit,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function uploadList(req, res, next) {
  try {
    if (!req.file) return send400(res, 'No CSV file uploaded.');
    const result = await service.bulkAssign(req.file.path, req.user.id);
    sendCreated(res, result, `Adviser assignment complete. ${result.assigned} student(s) updated.`);
  } catch (err) {
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

module.exports = { myAdvisees, uploadList };
