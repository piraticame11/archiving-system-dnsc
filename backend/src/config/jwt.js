module.exports = {
  secret:             process.env.JWT_SECRET || 'change-me-in-production',
  expiresIn:          process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret:      process.env.JWT_REFRESH_SECRET || 'change-refresh-in-production',
  refreshExpiresIn:   process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  refreshExpiresMs:   7 * 24 * 60 * 60 * 1000,
};
