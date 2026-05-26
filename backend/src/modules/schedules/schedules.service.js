const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');

/* ─── list ──────────────────────────────────────────────────────────── */
async function listSchedules({ search, status, from_date, to_date, page, limit, panelist_id }) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (panelist_id) {
    conditions.push('EXISTS (SELECT 1 FROM schedule_panelists sp WHERE sp.schedule_id = ds.id AND sp.panelist_id = ?)');
    params.push(panelist_id);
  }

  if (status) {
    conditions.push('ds.status = ?');
    params.push(status);
  }

  if (from_date) {
    conditions.push('ds.scheduled_at >= ?');
    params.push(from_date);
  }

  if (to_date) {
    conditions.push('ds.scheduled_at <= ?');
    params.push(to_date);
  }

  if (search) {
    conditions.push('ts.title LIKE ?');
    params.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const from = `FROM defense_schedules ds
    JOIN thesis_submissions ts ON ds.submission_id = ts.id
    LEFT JOIN venues v         ON ds.venue_id = v.id
    JOIN users u               ON ds.created_by = u.id
    ${where}`;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total ${from}`,
    params
  );

  const [rows] = await db.query(
    `SELECT ds.id, ds.submission_id, ds.venue_id, ds.scheduled_at,
            ds.duration_min, ds.status, ds.notes, ds.defense_type,
            ds.created_by, ds.created_at, ds.updated_at,
            ts.title AS submission_title, ts.type AS submission_type,
            ts.school_year,
            v.name AS venue_name,
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
            (SELECT COUNT(*) FROM schedule_panelists sp WHERE sp.schedule_id = ds.id) AS panelists_count
     ${from}
     ORDER BY ds.scheduled_at ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query(
    `SELECT ds.id, ds.submission_id, ds.venue_id, ds.scheduled_at,
            ds.duration_min, ds.status, ds.notes, ds.defense_type,
            ds.created_by, ds.created_at, ds.updated_at,
            ts.title AS submission_title, ts.type AS submission_type,
            ts.school_year,
            v.name AS venue_name,
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM defense_schedules ds
     JOIN thesis_submissions ts ON ds.submission_id = ts.id
     LEFT JOIN venues v         ON ds.venue_id = v.id
     JOIN users u               ON ds.created_by = u.id
     WHERE ds.id = ?`,
    [id]
  );

  if (!row) return null;

  const [panelists] = await db.query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email, u.role
     FROM schedule_panelists sp
     JOIN users u ON sp.panelist_id = u.id
     WHERE sp.schedule_id = ?`,
    [id]
  );

  row.panelists = panelists;
  return row;
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createSchedule({ submission_id, venue_id, scheduled_at, duration_min, notes, panelist_ids, created_by }) {
  const [result] = await db.query(
    `INSERT INTO defense_schedules
       (submission_id, venue_id, scheduled_at, duration_min, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      submission_id,
      venue_id || null,
      scheduled_at,
      duration_min || 60,
      notes || null,
      created_by,
    ]
  );

  const scheduleId = result.insertId;

  if (Array.isArray(panelist_ids) && panelist_ids.length > 0) {
    const values = panelist_ids.map(uid => [scheduleId, uid]);
    await db.query(
      `INSERT INTO schedule_panelists (schedule_id, panelist_id) VALUES ?`,
      [values]
    );
  }

  return getById(scheduleId);
}

/* ─── update ────────────────────────────────────────────────────────── */
async function updateSchedule(id, { venue_id, scheduled_at, duration_min, notes, panelist_ids }) {
  const updates = {};
  if (venue_id     !== undefined) updates.venue_id     = venue_id || null;
  if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
  if (duration_min !== undefined) updates.duration_min = duration_min;
  if (notes        !== undefined) updates.notes        = notes || null;

  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await db.query(
      `UPDATE defense_schedules SET ${set}, updated_at = NOW() WHERE id = ?`,
      [...Object.values(updates), id]
    );
  }

  if (Array.isArray(panelist_ids)) {
    await db.query(`DELETE FROM schedule_panelists WHERE schedule_id = ?`, [id]);
    if (panelist_ids.length > 0) {
      const values = panelist_ids.map(uid => [id, uid]);
      await db.query(
        `INSERT INTO schedule_panelists (schedule_id, panelist_id) VALUES ?`,
        [values]
      );
    }
  }

  return getById(id);
}

/* ─── update status ─────────────────────────────────────────────────── */
async function updateStatus(id, status) {
  await db.query(
    `UPDATE defense_schedules SET status = ?, updated_at = NOW() WHERE id = ?`,
    [status, id]
  );
  return getById(id);
}

/* ─── delete ────────────────────────────────────────────────────────── */
async function deleteSchedule(id) {
  await db.query(`DELETE FROM defense_schedules WHERE id = ?`, [id]);
}

module.exports = { listSchedules, getById, createSchedule, updateSchedule, updateStatus, deleteSchedule };
