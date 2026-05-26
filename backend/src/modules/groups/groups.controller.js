const service = require('./groups.service');
const db = require('../../config/database');
const { sendSuccess, sendCreated, send400, send403, send404 } = require('../../utils/responseHelper');

async function listInstructors(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, d.name AS department_name
       FROM users u
       JOIN roles r       ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE r.name = 'instructor' AND u.is_active = 1 AND u.deleted_at IS NULL
       ORDER BY u.last_name, u.first_name`
    );
    sendSuccess(res, rows);
  } catch (err) { next(err); }
}

async function getMyGroup(req, res, next) {
  try {
    const group = await service.getMyGroup(req.user.id);
    sendSuccess(res, group);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const group = await service.createGroup({
      leader_id:   req.user.id,
      name:        req.body.name,
      adviser_id:  req.body.adviser_id,
      title:       req.body.title,
      school_year: req.body.school_year,
      max_members: req.body.max_members,
    });
    sendCreated(res, group, 'Group created successfully');
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    if (err.statusCode === 400) return send400(res, err.message);
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const group = await service.updateGroup(parseInt(req.params.id), req.user.id, req.body);
    sendSuccess(res, group, 'Group updated');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function requestJoin(req, res, next) {
  try {
    const result = await service.requestJoin(req.user.id, req.body.join_code.trim());
    sendCreated(res, result, 'Join request submitted. Wait for the leader to accept.');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function getPendingRequests(req, res, next) {
  try {
    const requests = await service.getPendingRequests(parseInt(req.params.id), req.user.id);
    sendSuccess(res, requests);
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    next(err);
  }
}

async function acceptRequest(req, res, next) {
  try {
    const group = await service.acceptRequest(
      parseInt(req.params.requestId),
      parseInt(req.params.id),
      req.user.id
    );
    sendSuccess(res, group, 'Member added to group');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const result = await service.rejectRequest(
      parseInt(req.params.requestId),
      parseInt(req.params.id),
      req.user.id
    );
    sendSuccess(res, result, 'Join request rejected');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    await service.removeMember(
      parseInt(req.params.id),
      parseInt(req.params.studentId),
      req.user.id
    );
    sendSuccess(res, null, 'Member removed from group');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function leaveGroup(req, res, next) {
  try {
    await service.leaveGroup(parseInt(req.params.id), req.user.id);
    sendSuccess(res, null, 'You have left the group');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function disbandGroup(req, res, next) {
  try {
    await service.disbandGroup(parseInt(req.params.id), req.user.id);
    sendSuccess(res, null, 'Group disbanded');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    next(err);
  }
}

module.exports = { listInstructors, getMyGroup, create, update, requestJoin, getPendingRequests, acceptRequest, rejectRequest, removeMember, leaveGroup, disbandGroup };
