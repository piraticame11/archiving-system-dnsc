const path    = require('path');
const fs      = require('fs');
const service = require('./submissions.service');
const { getPagination } = require('../../utils/pagination');
const { sendSuccess, sendCreated, send400, send403, send404 } = require('../../utils/responseHelper');
const { ROLES } = require('../../config/constants');

async function list(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const filters = {
      search:        req.query.search,
      status:        req.query.status,
      department_id: req.query.department_id,
      type:          req.query.type,
      school_year:   req.query.school_year,
      page, limit,
    };
    /* students only see their own; instructors only see their advisees */
    if (req.user.role === ROLES.STUDENT)     filters.student_id  = req.user.id;
    if (req.user.role === ROLES.INSTRUCTOR)  filters.adviser_id  = req.user.id;

    const result = await service.listSubmissions(filters);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const sub = await service.getById(req.params.id);
    if (!sub) return send404(res, 'Submission not found');

    /* students can only view their own */
    if (req.user.role === ROLES.STUDENT && sub.student_id !== req.user.id)
      return send403(res, 'Forbidden');

    sendSuccess(res, sub);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    /* get student's department from their profile */
    const db = require('../../config/database');
    const [[user]] = await db.query('SELECT department_id FROM users WHERE id = ?', [req.user.id]);
    if (!user?.department_id)
      return send400(res, 'Your account does not have a department assigned. Please contact the admin.');

    const sub = await service.createSubmission({
      ...req.body,
      student_id:    req.user.id,
      department_id: user.department_id,
    });
    sendCreated(res, sub, 'Submission created as draft');
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const sub = await service.getById(req.params.id);
    if (!sub) return send404(res, 'Submission not found');

    if (req.user.role === ROLES.STUDENT) {
      if (sub.student_id !== req.user.id) return send403(res, 'Forbidden');
      if (sub.status !== 'draft')         return send400(res, 'Only draft submissions can be edited.');
    }

    const updated = await service.updateSubmission(req.params.id, req.body, req.user.id);
    sendSuccess(res, updated, 'Submission updated');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function submit(req, res, next) {
  try {
    const sub = await service.submitForReview(req.params.id, req.user.id);
    sendSuccess(res, sub, 'Submission sent for review');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const sub = await service.updateStatus(req.params.id, req.body.status, req.user.id, req.body.remarks);
    sendSuccess(res, sub, 'Status updated');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.deleteSubmission(req.params.id, req.user.id, req.user.role);
    sendSuccess(res, null, 'Submission deleted');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) return send400(res, 'No file uploaded.');

    const sub = await service.getById(req.params.id);
    if (!sub) return send404(res, 'Submission not found');

    if (req.user.role === ROLES.STUDENT) {
      if (sub.group_id) {
        /* group submission: only the leader can upload */
        const groupService = require('../groups/groups.service');
        const groupRole = await groupService.getStudentGroupRole(req.user.id);
        if (!groupRole.isLeader || groupRole.groupId !== sub.group_id)
          return send403(res, 'Only the group leader can upload documents for this submission.');
      } else if (sub.student_id !== req.user.id) {
        return send403(res, 'Forbidden');
      }
    }

    const docId = await service.addDocument({
      submission_id: parseInt(req.params.id),
      uploaded_by:   req.user.id,
      doc_type:      req.body.doc_type,
      file_name:     req.file.originalname,
      file_path:     req.file.path,
      file_size:     req.file.size,
      mime_type:     req.file.mimetype,
    });
    sendCreated(res, { id: docId }, 'Document uploaded successfully');
  } catch (err) { next(err); }
}

async function viewDocument(req, res, next) {
  try {
    const sub = await service.getById(req.params.id);
    if (!sub) return send404(res, 'Submission not found');

    if (req.user.role === ROLES.STUDENT && sub.student_id !== req.user.id)
      return send403(res, 'Forbidden');

    const doc = await service.getDocumentFile(req.params.docId, req.params.id);
    if (!doc) return send404(res, 'Document not found');

    const absPath = path.isAbsolute(doc.file_path)
      ? doc.file_path
      : path.resolve(process.cwd(), doc.file_path);

    if (!fs.existsSync(absPath)) return send404(res, 'File not found on disk');

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    res.setHeader('Content-Length', fs.statSync(absPath).size);
    fs.createReadStream(absPath).pipe(res);
  } catch (err) { next(err); }
}

async function stats(req, res, next) {
  try {
    const data = await service.getStats();
    sendSuccess(res, data);
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, submit, updateStatus, remove, uploadDocument, viewDocument, stats };
