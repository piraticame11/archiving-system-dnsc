const db     = require('../../config/database');
const bcrypt = require('bcryptjs');
const { paginatedResponse } = require('../../utils/pagination');

/* ─── list ─────────────────────────────────────────────────────────── */
async function listPanelists({ search, status, page, limit }) {
  const offset     = (page - 1) * limit;
  const conditions = ["u.deleted_at IS NULL AND r.name = 'panelist'"];
  const params     = [];

  if (search) {
    conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (status === 'active')   conditions.push('u.is_active = 1');
  if (status === 'inactive') conditions.push('u.is_active = 0');

  const where = conditions.join(' AND ');
  const base  = `FROM users u JOIN roles r ON u.role_id = r.id WHERE ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, params);
  const [rows] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email,
            u.is_active, u.created_at,
            (SELECT COUNT(*) FROM schedule_panelists sp WHERE sp.panelist_id = u.id) AS schedules_count
     ${base}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getPanelistById(id) {
  const [[user]] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.created_at, u.updated_at,
            r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = ? AND r.name = 'panelist' AND u.deleted_at IS NULL`,
    [id]
  );
  if (!user) return null;

  const [schedules] = await db.query(
    `SELECT ds.id, ds.scheduled_at, ds.status, ds.duration_min,
            ts.title AS submission_title, ts.type AS submission_type,
            v.name AS venue_name
     FROM schedule_panelists sp
     JOIN defense_schedules ds  ON sp.schedule_id = ds.id
     JOIN thesis_submissions ts ON ds.submission_id = ts.id
     LEFT JOIN venues v         ON ds.venue_id = v.id
     WHERE sp.panelist_id = ?
     ORDER BY ds.scheduled_at DESC`,
    [id]
  );
  user.schedules = schedules;
  return user;
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createPanelist({ first_name, last_name, email, password }) {
  const [[roleRow]] = await db.query("SELECT id FROM roles WHERE name = 'panelist'");
  if (!roleRow) throw Object.assign(new Error('Panelist role not found'), { statusCode: 500 });

  const [[existing]] = await db.query(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]
  );
  if (existing) throw Object.assign(new Error('Email is already in use'), { statusCode: 409 });

  const hash = await bcrypt.hash(password, 12);
  const [result] = await db.query(
    `INSERT INTO users (role_id, first_name, last_name, email, password_hash, is_active, is_email_verified)
     VALUES (?, ?, ?, ?, ?, 1, 1)`,
    [roleRow.id, first_name, last_name, email, hash]
  );
  return getPanelistById(result.insertId);
}

/* ─── update ────────────────────────────────────────────────────────── */
async function updatePanelist(id, { first_name, last_name, email }) {
  const user = await getPanelistById(id);
  if (!user) throw Object.assign(new Error('Panelist not found'), { statusCode: 404 });

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name  !== undefined) updates.last_name  = last_name;
  if (email      !== undefined) {
    const [[dup]] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL', [email, id]
    );
    if (dup) throw Object.assign(new Error('Email is already in use'), { statusCode: 409 });
    updates.email = email;
  }

  if (!Object.keys(updates).length) return user;
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE users SET ${set} WHERE id = ?`, [...Object.values(updates), id]);
  return getPanelistById(id);
}

/* ─── toggle active ─────────────────────────────────────────────────── */
async function toggleActive(id) {
  const user = await getPanelistById(id);
  if (!user) throw Object.assign(new Error('Panelist not found'), { statusCode: 404 });
  const next = user.is_active ? 0 : 1;
  await db.query('UPDATE users SET is_active = ? WHERE id = ?', [next, id]);
  return getPanelistById(id);
}

/* ─── reset password ────────────────────────────────────────────────── */
async function resetPassword(id, newPassword) {
  const user = await getPanelistById(id);
  if (!user) throw Object.assign(new Error('Panelist not found'), { statusCode: 404 });
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
}

/* ─── delete ────────────────────────────────────────────────────────── */
async function deletePanelist(id) {
  const user = await getPanelistById(id);
  if (!user) throw Object.assign(new Error('Panelist not found'), { statusCode: 404 });
  await db.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);
}

module.exports = { listPanelists, getPanelistById, createPanelist, updatePanelist, toggleActive, resetPassword, deletePanelist };
