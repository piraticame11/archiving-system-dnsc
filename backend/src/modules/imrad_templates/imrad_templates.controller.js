const fs   = require('fs');
const path = require('path');
const service = require('./imrad_templates.service');
const { sendSuccess, sendCreated, send400, send404 } = require('../../utils/responseHelper');

async function list(req, res, next) {
  try {
    const templates = await service.listTemplates();
    sendSuccess(res, templates);
  } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    if (!req.file) return send400(res, 'No file uploaded.');

    const template = await service.createTemplate({
      title:       req.body.title,
      description: req.body.description || null,
      file_name:   req.file.originalname,
      file_path:   req.file.path,
      file_size:   req.file.size,
      mime_type:   req.file.mimetype,
      uploaded_by: req.user.id,
    });
    sendCreated(res, template, 'Template uploaded');
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const template = await service.getById(req.params.id);
    if (!template) return send404(res, 'Template not found');

    const filePath = path.resolve(template.file_path);
    if (!fs.existsSync(filePath)) return send404(res, 'File not found on disk');

    res.download(filePath, template.file_name);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const template = await service.getById(req.params.id);
    if (!template) return send404(res, 'Template not found');
    await service.deleteTemplate(req.params.id);
    sendSuccess(res, null, 'Template deleted');
  } catch (err) { next(err); }
}

module.exports = { list, upload, download, remove };
