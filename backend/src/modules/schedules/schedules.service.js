const path = require('path');
const fs   = require('fs');
const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');
const { sendMail, scheduleAssignedHtml } = require('../../config/mailer');

/* Proposal defenses run 30 minutes; outline-to-final defenses run 1h30. */
const SLOTS_BY_TYPE = {
  proposal: [
    '8:00-8:30', '8:30-9:00', '9:00-9:30', '9:30-10:00',
    '10:00-10:30', '10:30-11:00', '11:00-11:30', '11:30-12:00',
    '13:00-13:30', '13:30-14:00', '14:00-14:30', '14:30-15:00',
    '15:00-15:30', '15:30-16:00', '16:00-16:30', '16:30-17:00',
  ],
  final: [
    '8:00-9:30', '9:30-11:00', '11:00-12:30',
    '13:00-14:30', '14:30-16:00',
  ],
};

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
    `SELECT ds.id, ds.submission_id, ds.venue_id, ds.defense_type,
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
            ds.venue_id, ds.defense_type, v.name AS venue_name,
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
    `SELECT ds.id, ds.submission_id, ds.venue_id, ds.defense_type,
            ds.scheduled_date, ds.time_slots,
            ds.status, ds.notes, ds.minutes_photo, ds.minutes_uploaded_at,
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
  row.has_minutes = !!row.minutes_photo;

  const [panelists] = await db.query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email, r.name AS role,
            sp.role_label AS panel_role
     FROM schedule_panelists sp
     JOIN users u ON sp.panelist_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE sp.schedule_id = ?
     ORDER BY FIELD(sp.role_label, 'chairperson', 'industry_panelist', 'member')`,
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

/* Proposal (30min) and final (1h30) slots share the same time grid but use
   different string values, so exact-match comparison can't detect overlap
   across types. Parse start/end minutes and compare ranges instead. */
function parseSlotRange(slot) {
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const [start, end] = slot.split('-');
  return [toMin(start), toMin(end)];
}

function slotsOverlap(a, b) {
  const [aStart, aEnd] = parseSlotRange(a);
  const [bStart, bEnd] = parseSlotRange(b);
  return aStart < bEnd && bStart < aEnd;
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
    const overlap  = time_slots.some(s => existing.some(e => slotsOverlap(s, e)));
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

/* ─── validate that the chosen slot(s) match the defense type's duration ── */
function validateSlotsForType(defense_type, time_slots) {
  const allowed = SLOTS_BY_TYPE[defense_type];
  if (!allowed) {
    const err = new Error('Invalid defense type.');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(time_slots) || time_slots.length !== 1 || !allowed.includes(time_slots[0])) {
    const label = defense_type === 'proposal' ? '30-minute' : '1 hour 30-minute';
    const err = new Error(`A ${defense_type} defense requires exactly one valid ${label} timeslot.`);
    err.status = 400;
    throw err;
  }
}

/* Every defense panel must have exactly 1 chairperson, 1 industry panelist,
   and 2 members. An empty panel is allowed (assigned later). */
const PANEL_COMPOSITION = { chairperson: 1, industry_panelist: 1, member: 2 };

function validatePanelComposition(panelists) {
  if (!panelists.length) return;

  const ids = panelists.map(p => p.panelist_id);
  if (new Set(ids).size !== ids.length) {
    const err = new Error('A panelist cannot be assigned more than one role on the same schedule.');
    err.status = 400;
    throw err;
  }

  const counts = { chairperson: 0, industry_panelist: 0, member: 0 };
  for (const p of panelists) {
    if (!(p.role in PANEL_COMPOSITION)) {
      const err = new Error(`Invalid panel role: ${p.role}`);
      err.status = 400;
      throw err;
    }
    counts[p.role]++;
  }

  const mismatches = Object.entries(PANEL_COMPOSITION)
    .filter(([role, expected]) => counts[role] !== expected)
    .map(([role, expected]) => `${role.replace('_', ' ')}: need ${expected}, got ${counts[role]}`);
  if (mismatches.length) {
    const err = new Error(
      `A defense panel must have exactly 1 chairperson, 1 industry panelist, and 2 members. (${mismatches.join('; ')})`
    );
    err.status = 400;
    throw err;
  }
}

async function syncPanelists(scheduleId, panelists) {
  await db.query(`DELETE FROM schedule_panelists WHERE schedule_id = ?`, [scheduleId]);
  if (panelists.length) {
    const vals = panelists.map(p => [scheduleId, p.panelist_id, p.role]);
    await db.query(`INSERT INTO schedule_panelists (schedule_id, panelist_id, role_label) VALUES ?`, [vals]);
  }
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createSchedule({ venue_id, defense_type, scheduled_date, time_slots, notes, panelists, group_ids, created_by }) {
  const panelList = Array.isArray(panelists) ? panelists : [];
  validateSlotsForType(defense_type, time_slots);
  validatePanelComposition(panelList);

  const conflict = await checkVenueConflict(venue_id, scheduled_date, time_slots);
  if (conflict) {
    const err = new Error('This venue already has a schedule that overlaps the selected timeslots.');
    err.status = 409;
    throw err;
  }

  const [result] = await db.query(
    `INSERT INTO defense_schedules
       (venue_id, defense_type, scheduled_date, time_slots, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [venue_id || null, defense_type, scheduled_date, JSON.stringify(time_slots), notes || null, created_by]
  );

  const scheduleId = result.insertId;

  if (panelList.length) {
    await syncPanelists(scheduleId, panelList);
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
async function updateSchedule(id, { venue_id, defense_type, scheduled_date, time_slots, notes, panelists, group_ids }) {
  const current    = await getById(id);
  const newVenueId = venue_id       !== undefined ? (venue_id || null) : current.venue_id;
  const newType     = defense_type  !== undefined ? defense_type       : current.defense_type;
  const newDate    = scheduled_date !== undefined ? scheduled_date     : current.scheduled_date;
  const newSlots   = time_slots     !== undefined ? time_slots         : current.time_slots;

  if (defense_type !== undefined || time_slots !== undefined) {
    validateSlotsForType(newType, newSlots);
  }
  if (panelists !== undefined) {
    validatePanelComposition(Array.isArray(panelists) ? panelists : []);
  }

  const conflict = await checkVenueConflict(newVenueId, newDate, newSlots, id);
  if (conflict) {
    const err = new Error('This venue already has a schedule that overlaps the selected timeslots.');
    err.status = 409;
    throw err;
  }

  const updates = {};
  if (venue_id       !== undefined) updates.venue_id       = venue_id || null;
  if (defense_type   !== undefined) updates.defense_type   = defense_type;
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

  if (Array.isArray(panelists)) {
    await syncPanelists(id, panelists);
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

/* ─── minutes photo: the panel's written minutes are what the system's
   record of the defense outcome is based on ──────────────────────────── */
async function uploadMinutes(id, filePath) {
  const [[row]] = await db.query('SELECT minutes_photo FROM defense_schedules WHERE id = ?', [id]);
  if (!row) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    const err = new Error('Schedule not found');
    err.status = 404;
    throw err;
  }

  if (row.minutes_photo) {
    const oldPath = path.isAbsolute(row.minutes_photo) ? row.minutes_photo : path.resolve(process.cwd(), row.minutes_photo);
    try { fs.unlinkSync(oldPath); } catch (_) {}
  }

  await db.query(
    `UPDATE defense_schedules SET minutes_photo = ?, minutes_uploaded_at = NOW() WHERE id = ?`,
    [filePath, id]
  );
  return getById(id);
}

async function getMinutesFile(id) {
  const [[row]] = await db.query('SELECT minutes_photo FROM defense_schedules WHERE id = ?', [id]);
  if (!row || !row.minutes_photo) {
    const err = new Error('No minutes photo uploaded for this schedule.');
    err.status = 404;
    throw err;
  }
  const absPath = path.isAbsolute(row.minutes_photo) ? row.minutes_photo : path.resolve(process.cwd(), row.minutes_photo);
  if (!fs.existsSync(absPath)) {
    const err = new Error('Minutes file not found on disk.');
    err.status = 404;
    throw err;
  }
  return absPath;
}

module.exports = {
  listSchedules, getCalendar, getById,
  createSchedule, updateSchedule, updateStatus, deleteSchedule,
  uploadMinutes, getMinutesFile,
  SLOTS_BY_TYPE,
};
