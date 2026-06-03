const fs      = require('fs');
const path    = require('path');
const service = require('./instructor_guidelines.service');
const { sendSuccess, sendCreated, send400, send403, send404 } = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const items = await service.listAll();
    sendSuccess(res, items);
  } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    if (!req.file) return send400(res, 'No file uploaded.');

    const guideline = await service.create({
      title:       req.body.title,
      description: req.body.description || null,
      category:    req.body.category    || 'General',
      file_name:   req.file.originalname,
      file_path:   req.file.path,
      file_size:   req.file.size,
      mime_type:   req.file.mimetype,
      uploaded_by: req.user.id,
    });
    sendCreated(res, guideline, 'Guideline uploaded successfully');
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const guideline = await service.getById(req.params.id);
    if (!guideline) return send404(res, 'Guideline not found');

    const filePath = path.resolve(guideline.file_path);
    if (!fs.existsSync(filePath)) return send404(res, 'File not found on disk');

    res.download(filePath, guideline.file_name);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const guideline = await service.getById(req.params.id);
    if (!guideline) return send404(res, 'Guideline not found');

    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    if (!isAdmin && guideline.uploaded_by !== req.user.id) {
      return send403(res, 'You can only delete your own uploads');
    }

    await service.softDelete(req.params.id);
    sendSuccess(res, null, 'Guideline deleted');
  } catch (err) { next(err); }
}

module.exports = { list, upload, download, remove };
