const { sendError } = require('../utils/responseHelper');

function isApiRequest(req) {
  return req.path.startsWith('/api/') || (req.headers.accept || '').includes('application/json');
}

function redirectToError(res, code, message) {
  res.redirect(`/pages/error.html?code=${code}&message=${encodeURIComponent(message)}`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const msg = 'File too large.';
    return isApiRequest(req) ? sendError(res, 413, msg) : redirectToError(res, 413, msg);
  }
  if (err.message && err.message.includes('Only')) {
    const msg = err.message;
    return isApiRequest(req) ? sendError(res, 400, msg) : redirectToError(res, 400, msg);
  }

  console.error(err);
  const msg = 'An unexpected server error occurred.';
  return isApiRequest(req) ? sendError(res, 500, msg) : redirectToError(res, 500, msg);
}

module.exports = { errorHandler };
