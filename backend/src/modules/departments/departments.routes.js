const router = require('express').Router();
const db = require('../../config/database');
const { sendSuccess } = require('../../utils/responseHelper');

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT id, code, name FROM departments ORDER BY name`);
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
