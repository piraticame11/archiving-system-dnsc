const { send403 } = require('../utils/responseHelper');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return send403(res, 'Forbidden.');
    if (!roles.includes(req.user.role)) return send403(res, 'Insufficient permissions.');
    next();
  };
}

module.exports = { requireRole };
