function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendCreated(res, data = null, message = 'Created') {
  return sendSuccess(res, data, message, 201);
}

function sendError(res, statusCode = 500, message = 'Error', errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function send400(res, message = 'Bad request.', errors = null) {
  return sendError(res, 400, message, errors);
}

function send401(res, message = 'Unauthorized.') {
  return sendError(res, 401, message);
}

function send403(res, message = 'Forbidden.') {
  return sendError(res, 403, message);
}

function send404(res, message = 'Not found.') {
  return sendError(res, 404, message);
}

function send422(res, message = 'Validation failed.', errors = null) {
  return sendError(res, 422, message, errors);
}

module.exports = { sendSuccess, sendCreated, sendError, send400, send401, send403, send404, send422 };
