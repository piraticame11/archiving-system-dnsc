require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const cookieParser = require('cookie-parser');

const authRoutes        = require('./modules/auth/auth.routes');
const departmentRoutes  = require('./modules/departments/departments.routes');
const userRoutes        = require('./modules/users/users.routes');
const archiveRoutes     = require('./modules/archive/archive.routes');
const { errorHandler }  = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/v1/health', async (req, res) => {
  const db = require('./config/database');
  try {
    await db.query('SELECT 1');
    res.json({ success: true, uptime: process.uptime(), db: 'ok' });
  } catch {
    res.status(503).json({ success: false, message: 'DB unavailable' });
  }
});

// API routes
app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/users',       userRoutes);
app.use('/api/v1/archive',    archiveRoutes);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// 404 catch-all
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }
  // Browser asset requests (favicon, icons, images) — return 404 without redirect
  const assetExts = /\.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$/i;
  if (assetExts.test(req.path)) {
    return res.status(404).end();
  }
  // Missing page — redirect to error page
  const msg = encodeURIComponent('The page you are looking for could not be found.');
  res.redirect(`/pages/error.html?code=404&message=${msg}`);
});

app.use(errorHandler);

module.exports = app;
