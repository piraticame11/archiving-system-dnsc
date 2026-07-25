const service = require('./adviser.service');
const { getPagination } = require('../../utils/pagination');
const { sendSuccess, sendCreated, send400, send403, send404 } = require('../../utils/responseHelper');

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

async function removeGroup(req, res, next) {
  try {
    await service.removeFromGroup(parseInt(req.params.id), req.user.id);
    sendSuccess(res, null, 'You have been removed as adviser from this group.');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    next(err);
  }
}

async function myGroups(req, res, next) {
  try {
    const result = await service.getMyGroups(req.user.id, { school_year: req.query.school_year });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function groupRequests(req, res, next) {
  try {
    const result = await service.getAdviserRequests(req.user.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function approveGroupRequest(req, res, next) {
  try {
    const group = await service.respondToAdviserRequest(parseInt(req.params.groupId), req.user.id, 'approved', null);
    sendSuccess(res, group, 'Group request approved.');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function rejectGroupRequest(req, res, next) {
  try {
    const group = await service.respondToAdviserRequest(parseInt(req.params.groupId), req.user.id, 'rejected', req.body.reason);
    sendSuccess(res, group, 'Group request declined.');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const value = req.body.max_advisee_groups === '' || req.body.max_advisee_groups === null
      ? null
      : parseInt(req.body.max_advisee_groups);
    const row = await service.setMaxAdviseeGroups(req.user.id, value);
    sendSuccess(res, row, 'Settings updated.');
  } catch (err) { next(err); }
}

async function listAdvisers(req, res, next) {
  try {
    const result = await service.listAdvisers();
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function importStudents(req, res, next) {
  try {
    if (!req.file) return send400(res, 'No file uploaded.');
    const results = await service.importStudents(req.file.path, req.user);
    sendCreated(res, results, `Import complete. Created: ${results.created}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`);
  } catch (err) {
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function downloadImportTemplate(req, res, next) {
  try {
    const buffer = service.downloadImportTemplate();
    res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) { next(err); }
}

async function exportCredentials(req, res, next) {
  try {
    const credentials = req.body.credentials;
    if (!Array.isArray(credentials) || !credentials.length) {
      return send400(res, 'credentials array is required and must not be empty.');
    }
    const buffer = service.exportCredentials(credentials);
    res.setHeader('Content-Disposition', 'attachment; filename="student_credentials.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) { next(err); }
}

async function myStudents(req, res, next) {
  try {
    const result = await service.getMyStudents(req.user.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

module.exports = {
  myAdvisees, uploadList, myGroups, removeGroup, listAdvisers,
  importStudents, downloadImportTemplate, exportCredentials, myStudents,
  groupRequests, approveGroupRequest, rejectGroupRequest, updateSettings,
};
