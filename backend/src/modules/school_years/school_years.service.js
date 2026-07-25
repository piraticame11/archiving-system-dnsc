const db = require('../../config/database');

/* ─── list ─────────────────────────────────────────────────────────── */
async function listSchoolYears({ include_inactive } = {}) {
  const where = include_inactive ? '' : 'WHERE is_active = 1';
  const [rows] = await db.query(
    `SELECT id, label, is_active, created_at FROM school_years ${where} ORDER BY label DESC`
  );
  return rows;
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query('SELECT id, label, is_active, created_at FROM school_years WHERE id = ?', [id]);
  return row || null;
}

async function isValidActiveLabel(label) {
  const [[row]] = await db.query('SELECT id FROM school_years WHERE label = ? AND is_active = 1', [label]);
  return !!row;
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createSchoolYear(label) {
  const [[dup]] = await db.query('SELECT id FROM school_years WHERE label = ?', [label]);
  if (dup) throw Object.assign(new Error('That school year already exists.'), { statusCode: 409 });

  const [result] = await db.query('INSERT INTO school_years (label) VALUES (?)', [label]);
  return getById(result.insertId);
}

/* ─── toggle active ─────────────────────────────────────────────────── */
async function toggleActive(id) {
  await db.query('UPDATE school_years SET is_active = NOT is_active WHERE id = ?', [id]);
  return getById(id);
}

module.exports = { listSchoolYears, getById, isValidActiveLabel, createSchoolYear, toggleActive };
