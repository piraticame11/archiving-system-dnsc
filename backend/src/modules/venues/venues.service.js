const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');

/* ─── list ─────────────────────────────────────────────────────────── */
async function listVenues({ search, include_inactive, page, limit }) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (!include_inactive) {
    conditions.push('is_active = 1');
  }

  if (search) {
    conditions.push('(name LIKE ? OR location LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM venues ${where}`,
    params
  );

  const [rows] = await db.query(
    `SELECT id, name, location, capacity, is_active, created_at
     FROM venues ${where}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query(
    `SELECT id, name, location, capacity, is_active, created_at
     FROM venues
     WHERE id = ?`,
    [id]
  );
  return row || null;
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createVenue({ name, location, capacity }) {
  const [result] = await db.query(
    `INSERT INTO venues (name, location, capacity) VALUES (?, ?, ?)`,
    [name, location || null, capacity || null]
  );
  return getById(result.insertId);
}

/* ─── update ────────────────────────────────────────────────────────── */
async function updateVenue(id, fields) {
  const updates = {};
  const { name, location, capacity } = fields;
  if (name     !== undefined) updates.name     = name;
  if (location !== undefined) updates.location = location || null;
  if (capacity !== undefined) updates.capacity = capacity || null;

  if (!Object.keys(updates).length) return getById(id);

  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await db.query(
    `UPDATE venues SET ${set} WHERE id = ?`,
    [...Object.values(updates), id]
  );
  return getById(id);
}

/* ─── toggle active ─────────────────────────────────────────────────── */
async function toggleActive(id) {
  await db.query(
    `UPDATE venues SET is_active = NOT is_active WHERE id = ?`,
    [id]
  );
  return getById(id);
}

/* ─── delete ────────────────────────────────────────────────────────── */
async function deleteVenue(id) {
  await db.query(`DELETE FROM venues WHERE id = ?`, [id]);
}

module.exports = { listVenues, getById, createVenue, updateVenue, toggleActive, deleteVenue };
