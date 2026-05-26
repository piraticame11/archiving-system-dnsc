const service = require('./schedules.service');
const { sendSuccess, sendCreated, send404 } = require('../../utils/responseHelper');
const { getPagination } = require('../../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const panelist_id = req.user.role === 'panelist' ? req.user.id : undefined;
    const result = await service.listSchedules({
      search:    req.query.search,
      status:    req.query.status,
      from_date: req.query.from_date,
      to_date:   req.query.to_date,
      page,
      limit,
      panelist_id,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const schedule = await service.getById(req.params.id);
    if (!schedule) return send404(res, 'Schedule not found');
    /* panelists can only view schedules they are assigned to */
    if (req.user.role === 'panelist') {
      const assigned = schedule.panelists?.some(p => p.id === req.user.id);
      if (!assigned) return send404(res, 'Schedule not found');
    }
    sendSuccess(res, schedule);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const schedule = await service.createSchedule({
      ...req.body,
      created_by: req.user.id,
    });
    sendCreated(res, schedule, 'Schedule created');
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Schedule not found');
    const schedule = await service.updateSchedule(req.params.id, req.body);
    sendSuccess(res, schedule, 'Schedule updated');
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Schedule not found');
    const schedule = await service.updateStatus(req.params.id, req.body.status);
    sendSuccess(res, schedule, 'Schedule status updated');
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Schedule not found');
    await service.deleteSchedule(req.params.id);
    sendSuccess(res, null, 'Schedule deleted');
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, updateStatus, remove };
