const { validationResult } = require('express-validator');
const { send422 } = require('../utils/responseHelper');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return send422(res, 'Validation failed.', errors.array());
  }
  next();
}

module.exports = { handleValidation };
