const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');
const { sendMail, scheduleAssignedHtml } = require('../../config/mailer');

const VALID_SLOTS = [
  '8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-12:00',
  '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00',
];

function parseSlots(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

/* ─── list ──────────────────────────────────────────────────────────── */
async function listSchedules({ search, status, from_date, to_date, page, limit, panelist_id, group_id }) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (panelist_id) {
    conditions.push('EXISTS (SELECT 1 FROM schedule_panelists sp WHERE sp.schedule_id = ds.id AND sp.panelist_id = ?)');
    params.push(panelist_id);
  }

  if (group_id) {
    conditions.push('EXISTS (SELECT 1 FROM schedule_groups sg WHERE sg.schedule_id = ds.id AND sg.group_id = ?)');
    params.push(group_id);
  }

  if (status) {
    conditions.push('ds.status = ?');
    params.push(status);
  }

  if (from_date) {
    conditions.push('ds.scheduled_date >= ?');
    params.push(from_date);
  }

  if (to_date) {
    conditions.push('ds.scheduled_date <= ?');
    params.push(to_date);
  }

  if (search) {
    conditions.push(`(ts.title LIKE ? OR ds.notes LIKE ? OR EXISTS (
      SELECT 1 FROM schedule_groups sg2
      JOIN thesis_groups tg2 ON sg2.group_id = tg2.id
      WHERE sg2.schedule_id = ds.id AND (tg2.name LIKE ? OR tg2.title LIKE ?)
    ))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const from = `FROM defense_schedules ds
    LEFT JOIN thesis_submissions ts ON ds.submission_id = ts.id
    LEFT JOIN venues v              ON ds.venue_id = v.id
    JOIN users u                    ON ds.created_by = u.id
    ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);

  const [rows] = await db.query(
    `SELECT ds.id, ds.submission_id, ds.venue_id,
            ds.scheduled_date, ds.time_slots,
            ds.status, ds.notes,
            ds.created_by, ds.created_at, ds.updated_at,
            ts.title AS submission_title, ts.type AS submission_type,
            ts.school_year,
            v.name AS venue_name,
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
            (SELECT COUNT(*) FROM schedule_panelists sp WHERE sp.schedule_id = ds.id) AS panelists_count,
            (SELECT COUNT(*) FROM schedule_groups    sg WHERE sg.schedule_id = ds.id) AS groups_count,
            (SELECT GROUP_CONCAT(tg.name ORDER BY tg.name SEPARATOR ', ')
             FROM schedule_groups sg JOIN thesis_groups tg ON sg.group_id = tg.id
             WHERE sg.schedule_id = ds.id) AS group_names,
            (SELECT GROUP_CONCAT(tg.title ORDER BY tg.name SEPARATOR ' / ')
             FROM schedule_groups sg JOIN thesis_groups tg ON sg.group_id = tg.id
             WHERE sg.schedule_id = ds.id) AS group_titles
     ${from}
     ORDER BY ds.scheduled_date ASC, ds.time_slots ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  rows.forEach(r => { r.time_slots = parseSlots(r.time_slots); });
  return paginatedResponse(rows, total, page, limit);
}

/* ─── calendar view (expanded: one row per schedule+slot) ───────────── */
async function getCalendar({ from_date, to_date }) {
  const [rows] = await db.query(
    `SELECT ds.id, ds.scheduled_date, ds.time_slots, ds.status, ds.notes,
            ds.venue_id, v.name AS venue_name,
            ts.title AS submission_title, ts.type AS submission_type
     FROM defense_schedules ds
     LEFT JOIN thesis_submissions ts ON ds.submission_id = ts.id
     LEFT JOIN venues v              ON ds.venue_id = v.id
     WHERE ds.scheduled_date >= ? AND ds.scheduled_date <= ?
       AND ds.status != 'cancelled'
     ORDER BY ds.scheduled_date ASC, ds.time_slots ASC`,
    [from_date, to_date]
  );

  // Attach groups for each schedule
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const [grpRows] = await db.query(
      `SELECT sg.schedule_id, tg.id AS group_id, tg.name AS group_name
       FROM schedule_groups sg
       JOIN thesis_groups tg ON sg.group_id = tg.id
       WHERE sg.schedule_id IN (?)`,
      [ids]
    );
    const grpMap = {};
    grpRows.forEach(g => {
      if (!grpMap[g.schedule_id]) grpMap[g.schedule_id] = [];
      grpMap[g.schedule_id].push({ id: g.group_id, name: g.group_name });
    });
    rows.forEach(r => { r.groups = grpMap[r.id] || []; });
  }

  // Expand: one entry per slot so the calendar grid can index by date|slot
  const expanded = [];
  rows.forEach(row => {
    const slots = parseSlots(row.time_slots);
    slots.forEach(slot => {
      expanded.push({ ...row, time_slot: slot, time_slots: slots });
    });
  });
  return expanded;
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query(
    `SELECT ds.id, ds.submission_id, ds.venue_id,
            ds.scheduled_date, ds.time_slots,
            ds.status, ds.notes,
            ds.created_by, ds.created_at, ds.updated_at,
            ts.title AS submission_title, ts.type AS submission_type,
            ts.school_year,
            v.name AS venue_name,
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM defense_schedules ds
     LEFT JOIN thesis_submissions ts ON ds.submission_id = ts.id
     LEFT JOIN venues v              ON ds.venue_id = v.id
     JOIN users u                    ON ds.created_by = u.id
     WHERE ds.id = ?`,
    [id]
  );
  if (!row) return null;

  row.time_slots = parseSlots(row.time_slots);

  const [panelists] = await db.query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email, r.name AS role
     FROM schedule_panelists sp
     JOIN users u ON sp.panelist_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE sp.schedule_id = ?`,
    [id]
  );
  row.panelists = panelists;

  const [groups] = await db.query(
    `SELECT tg.id, tg.name, tg.title AS group_title, tg.school_year
     FROM schedule_groups sg
     JOIN thesis_groups tg ON sg.group_id = tg.id
     WHERE sg.schedule_id = ?`,
    [id]
  );
  row.groups = groups;

  return row;
}

/* ─── venue conflict check ──────────────────────────────────────────── */
async function checkVenueConflict(venue_id, scheduled_date, time_slots, excludeId = 0) {
  if (!venue_id || !time_slots.length) return null;

  const [rows] = await db.query(
    `SELECT id, time_slots FROM defense_schedules
     WHERE venue_id = ? AND scheduled_date = ? AND id != ? AND status != 'cancelled'`,
    [venue_id, scheduled_date, excludeId]
  );

  for (const row of rows) {
    const existing = parseSlots(row.time_slots);
    const overlap  = time_slots.some(s => existing.includes(s));
    if (overlap) return row;
  }
  return null;
}

/* ─── sync groups ───────────────────────────────────────────────────── */
async function syncGroups(scheduleId, group_ids) {
  await db.query(`DELETE FROM schedule_groups WHERE schedule_id = ?`, [scheduleId]);
  if (group_ids.length) {
    const values = group_ids.map(gid => [scheduleId, gid]);
    await db.query(`INSERT INTO schedule_groups (schedule_id, group_id) VALUES ?`, [values]);
  }
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createSchedule({ venue_id, scheduled_date, time_slots, notes, panelist_ids, group_ids, created_by }) {
  const conflict = await checkVenueConflict(venue_id, scheduled_date, time_slots);
  if (conflict) {
    const err = new Error('This venue already has a schedule that overlaps the selected timeslots.');
    err.status = 409;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO defense_schedules
       (venue_id, scheduled_date, time_slots, notes, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [venue_id || null, scheduled_date, JSON.stringify(time_slots), notes || null, created_by]
  );

  const scheduleId = result.insertId;

  if (Array.isArray(panelist_ids) && panelist_ids.length) {
    const vals = panelist_ids.map(uid => [scheduleId, uid]);
    await db.query(`INSERT INTO schedule_panelists (schedule_id, panelist_id) VALUES ?`, [vals]);
  }

  if (Array.isArray(group_ids) && group_ids.length) {
    await syncGroups(scheduleId, group_ids);
  }

  const schedule = await getById(scheduleId);

  if (schedule.panelists && schedule.panelists.length) {
    const dateStr = `${schedule.scheduled_date} — ${schedule.time_slots.join(', ')}`;
    const venue   = schedule.venue_name || 'TBA';
    const title   = schedule.submission_title
      || (schedule.groups && schedule.groups.map(g => g.group_title || g.name).join(' / '))
      || 'Defense';
    for (const panelist of schedule.panelists) {
      sendMail({
        to:      panelist.email,
        subject: 'Defense Schedule Assignment',
        html:    scheduleAssignedHtml(panelist.full_name, title, dateStr, venue),
      }).catch(err => console.error(`[mailer] panelist ${panelist.id}:`, err.message));
    }
  }

  return schedule;
}

/* ─── update ────────────────────────────────────────────────────────── */
async function updateSchedule(id, { venue_id, scheduled_date, time_slots, notes, panelist_ids, group_ids }) {
  const current    = await getById(id);
  const newVenueId = venue_id       !== undefined ? (venue_id || null) : current.venue_id;
  const newDate    = scheduled_date !== undefined ? scheduled_date     : current.scheduled_date;
  const newSlots   = time_slots     !== undefined ? time_slots         : current.time_slots;

  const conflict = await checkVenueConflict(newVenueId, newDate, newSlots, id);
  if (conflict) {
    const err = new Error('This venue already has a schedule that overlaps the selected timeslots.');
    err.status = 409;
    throw err;
  }

  const updates = {};
  if (venue_id       !== undefined) updates.venue_id       = venue_id || null;
  if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;
  if (time_slots     !== undefined) updates.time_slots     = JSON.stringify(time_slots);
  if (notes          !== undefined) updates.notes          = notes || null;

  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await db.query(
      `UPDATE defense_schedules SET ${set}, updated_at = NOW() WHERE id = ?`,
      [...Object.values(updates), id]
    );
  }

  if (Array.isArray(panelist_ids)) {
    await db.query(`DELETE FROM schedule_panelists WHERE schedule_id = ?`, [id]);
    if (panelist_ids.length) {
      const vals = panelist_ids.map(uid => [id, uid]);
      await db.query(`INSERT INTO schedule_panelists (schedule_id, panelist_id) VALUES ?`, [vals]);
    }
  }

  if (Array.isArray(group_ids)) {
    await syncGroups(id, group_ids);
  }

  return getById(id);
}

/* ─── update status ─────────────────────────────────────────────────── */
async function updateStatus(id, status) {
  await db.query(`UPDATE defense_schedules SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);
  return getById(id);
}

/* ─── delete ────────────────────────────────────────────────────────── */
async function deleteSchedule(id) {
  await db.query(`DELETE FROM defense_schedules WHERE id = ?`, [id]);
}

module.exports = {
  listSchedules, getCalendar, getById,
  createSchedule, updateSchedule, updateStatus, deleteSchedule,
};
