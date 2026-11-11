const service = require('./activities.service');
const { sendSuccess, sendCreated, send400, send403, send404 } = require('../../utils/responseHelper');
const path = require('path');
const fs = require('fs');

async function create(req, res, next) {
  try {
    const activity = await service.createActivity({
      instructor_id: req.user.id,
      department_id: req.body.department_id,
      set_name:      req.body.set_name,
      group_id:      req.body.group_id,
      title:         req.body.title,
      description:   req.body.description,
      deadline:      req.body.deadline,
    });
    sendCreated(res, activity, 'Activity created successfully');
  } catch (err) {
    if (err.statusCode === 400) return send400(res, err.message);
    next(err);
  }
}

async function list(req, res, next) {
  try {
    if (req.user.role === 'instructor') {
      const data = await service.listActivitiesForInstructor(req.user.id);
      return sendSuccess(res, data);
    }
    if (req.user.role === 'student') {
      const data = await service.listActivitiesForStudent(req.user.id);
      return sendSuccess(res, data);
    }
    send403(res, 'Forbidden');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const activity = await service.getActivityById(parseInt(req.params.id));
    if (!activity) return send404(res, 'Activity not found');
    sendSuccess(res, activity);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await service.deleteActivity(parseInt(req.params.id), req.user.id);
    sendSuccess(res, result, 'Activity deleted');
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    next(err);
  }
}

async function submit(req, res, next) {
  try {
    if (!req.file) {
      return send400(res, 'Please select a PDF or DOCX file to submit.');
    }
    const result = await service.submitActivity({
      activity_id: parseInt(req.params.id),
      student_id:  req.user.id,
      file:        req.file,
      comments:    req.body.comments,
    });
    sendCreated(res, result, result.message);
  } catch (err) {
    if (err.statusCode === 400) return send400(res, err.message);
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function submissions(req, res, next) {
  try {
    const list = await service.getSubmissions(parseInt(req.params.id), req.user.id);
    sendSuccess(res, list);
  } catch (err) {
    if (err.statusCode === 404) return send404(res, err.message);
    if (err.statusCode === 403) return send403(res, err.message);
    next(err);
  }
}

async function downloadFile(req, res, next) {
  try {
    const sub = await service.getSubmissionFile(parseInt(req.params.submissionId), req.user);
    if (!sub) return send404(res, 'Submission not found');

    const absPath = path.isAbsolute(sub.file_path)
      ? sub.file_path
      : path.resolve(process.cwd(), sub.file_path);

    if (!fs.existsSync(absPath)) return send404(res, 'File not found on disk');

    res.setHeader('Content-Type', sub.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(sub.file_name)}"`);
    res.setHeader('Content-Length', fs.statSync(absPath).size);
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    if (err.statusCode === 403) return send403(res, err.message);
    if (err.statusCode === 404) return send404(res, err.message);
    next(err);
  }
}

async function instructorSets(req, res, next) {
  try {
    const data = await service.getInstructorSets(req.user.id);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getOne,
  remove,
  submit,
  submissions,
  downloadFile,
  instructorSets,
};

