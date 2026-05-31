const service = require('./evaluations.service');
const { getPagination } = require('../../utils/pagination');
const { sendSuccess, sendCreated, send400, send403, send404 } = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const panelist_id = req.user.role === 'panelist' ? req.user.id : req.query.panelist_id;
    const result = await service.listEvaluations({
      panelist_id,
      schedule_id: req.query.schedule_id,
      status:      req.query.status,
      page, limit,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const ev = await service.getById(req.params.id);
    if (!ev) return send404(res, 'Evaluation not found');
    if (req.user.role === 'panelist' && ev.panelist_id !== req.user.id)
      return send403(res, 'Forbidden');
    sendSuccess(res, ev);
  } catch (err) { next(err); }
}

async function getBySchedule(req, res, next) {
  try {
    const ev = await service.getByScheduleAndPanelist(req.params.scheduleId, req.user.id);
    sendSuccess(res, ev || null);
  } catch (err) { next(err); }
}

async function upsert(req, res, next) {
  try {
    const { schedule_id, group_id, score, remarks, submit } = req.body;
    const ev = await service.upsertEvaluation({
      schedule_id,
      panelist_id: req.user.id,
      group_id:    group_id ?? null,
      score,
      remarks,
      submit: Boolean(submit),
    });
    const msg = submit ? 'Evaluation submitted' : 'Evaluation saved as draft';
    sendCreated(res, ev, msg);
  } catch (err) {
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function getMyScores(req, res, next) {
  try {
    const result = await service.getStudentScores(req.user.id);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

module.exports = { list, getOne, getBySchedule, upsert, getMyScores };
