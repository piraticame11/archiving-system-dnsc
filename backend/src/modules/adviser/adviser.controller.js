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

async function submittedTitles(req, res, next) {
  try {
    const result = await service.getAllSubmittedTitles(req.user.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function rejectTitle(req, res, next) {
  try {
    await service.rejectTitle(parseInt(req.params.id), req.user.id, req.body.remarks);
    sendSuccess(res, null, 'Title rejected.');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function approveTitle(req, res, next) {
  try {
    await service.approveTitle(parseInt(req.params.id), req.user.id, req.body.remarks);
    sendSuccess(res, null, 'Title approved successfully');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
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
    const result = await service.getMyGroups(req.user.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function listAdvisers(req, res, next) {
  try {
    const result = await service.listAdvisers();
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

module.exports = { myAdvisees, uploadList, submittedTitles, approveTitle, rejectTitle, myGroups, removeGroup, listAdvisers };
