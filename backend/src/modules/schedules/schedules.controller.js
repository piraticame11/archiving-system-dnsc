const service = require('./schedules.service');
const db      = require('../../config/database');
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
      page, limit, panelist_id,
    });
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function calendar(req, res, next) {
  try {
    const rows = await service.getCalendar({
      from_date: req.query.from_date,
      to_date:   req.query.to_date,
    });
    sendSuccess(res, rows);
  } catch (err) { next(err); }
}

/* Student endpoint: schedules where their group is presenting */
async function myGroupSchedule(req, res, next) {
  try {
    const [[membership]] = await db.query(
      `SELECT group_id FROM group_members WHERE student_id = ?`, [req.user.id]
    );
    if (!membership) {
      sendSuccess(res, { data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }, has_group: false });
      return;
    }

    const { page, limit } = getPagination(req.query);
    const result = await service.listSchedules({
      group_id:  membership.group_id,
      status:    req.query.status,
      from_date: req.query.from_date,
      to_date:   req.query.to_date,
      page, limit,
    });
    sendSuccess(res, { ...result, has_group: true });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const schedule = await service.getById(req.params.id);
    if (!schedule) return send404(res, 'Schedule not found');
    if (req.user.role === 'panelist') {
      const assigned = schedule.panelists?.some(p => p.id === req.user.id);
      if (!assigned) return send404(res, 'Schedule not found');
    }
    sendSuccess(res, schedule);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const schedule = await service.createSchedule({ ...req.body, created_by: req.user.id });
    sendCreated(res, schedule, 'Schedule created');
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Schedule not found');
    const schedule = await service.updateSchedule(req.params.id, req.body);
    sendSuccess(res, schedule, 'Schedule updated');
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    next(err);
  }
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

async function uploadMinutes(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const existing = await service.getById(req.params.id);
    if (!existing) return send404(res, 'Schedule not found');
    const schedule = await service.uploadMinutes(req.params.id, req.file.path);
    sendSuccess(res, schedule, 'Minutes photo uploaded');
  } catch (err) {
    if (err.status === 404) return send404(res, err.message);
    next(err);
  }
}

async function getMinutes(req, res, next) {
  try {
    const schedule = await service.getById(req.params.id);
    if (!schedule) return send404(res, 'Schedule not found');
    if (req.user.role === 'panelist') {
      const assigned = schedule.panelists?.some(p => p.id === req.user.id);
      if (!assigned) return send404(res, 'Schedule not found');
    }
    const absPath = await service.getMinutesFile(req.params.id);
    res.sendFile(absPath);
  } catch (err) {
    if (err.status === 404) return send404(res, err.message);
    next(err);
  }
}

module.exports = { list, calendar, myGroupSchedule, getOne, create, update, updateStatus, remove, uploadMinutes, getMinutes };
