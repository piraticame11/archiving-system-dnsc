const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { send401 } = require('../utils/responseHelper');

function verifyToken(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return send401(res, 'Access token required.');

  try {
    req.user = jwt.verify(token, jwtConfig.secret);
    next();
  } catch {
    return send401(res, 'Invalid or expired token.');
  }
}

module.exports = { verifyToken };
