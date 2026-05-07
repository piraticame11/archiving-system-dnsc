const service = require('./archive.service');
const { getPagination } = require('../../utils/pagination');
const { sendSuccess, sendCreated, send400, send404 } = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await service.listArchive({
      search:        req.query.search,
      department_id: req.query.department_id,
      school_year:   req.query.school_year,
      semester:      req.query.semester,
      type:          req.query.type,
      page,
      limit,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const entry = await service.getArchiveById(req.params.id);
    if (!entry) return send404(res, 'Archive entry not found');
    sendSuccess(res, entry);
  } catch (err) { next(err); }
}

async function eligible(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await service.getEligible({ page, limit });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function promote(req, res, next) {
  try {
    const entry = await service.promoteToArchive({
      ...req.body,
      archived_by: req.user.id,
    });
    sendCreated(res, entry, 'Submission archived successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const { absPath, fileName, mimeType } = await service.getDownloadInfo(req.params.id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(absPath);
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.removeFromArchive(req.params.id);
    sendSuccess(res, null, 'Removed from archive');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function stats(req, res, next) {
  try {
    const data = await service.getStats();
    sendSuccess(res, data);
  } catch (err) { next(err); }
}

module.exports = { list, getOne, eligible, promote, download, remove, stats };
