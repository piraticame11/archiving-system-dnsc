const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');

const BASE_SELECT = `
  SELECT e.id, e.schedule_id, e.panelist_id, e.submission_id, e.group_id,
         e.score, e.decision, e.remarks, e.status, e.submitted_at, e.created_at, e.updated_at,
         CONCAT(p.first_name, ' ', p.last_name) AS panelist_name,
         ds.scheduled_date, ds.time_slots,
         ts.title AS submission_title, ts.type AS submission_type, ts.school_year,
         v.name AS venue_name
  FROM evaluations e
  JOIN users p                    ON e.panelist_id    = p.id
  JOIN defense_schedules ds       ON e.schedule_id    = ds.id
  LEFT JOIN thesis_submissions ts ON e.submission_id  = ts.id
  LEFT JOIN venues v              ON ds.venue_id      = v.id`;

const DECISIONS = ['approved', 'major_revisions', 'minor_revisions'];

/* ─── list ─────────────────────────────────────────────────────────── */
async function listEvaluations({ panelist_id, schedule_id, status, page, limit }) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (panelist_id)  { conditions.push('e.panelist_id = ?');  params.push(panelist_id); }
  if (schedule_id)  { conditions.push('e.schedule_id = ?');  params.push(schedule_id); }
  if (status)       { conditions.push('e.status = ?');       params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const from  = `FROM evaluations e
    JOIN users p                    ON e.panelist_id   = p.id
    JOIN defense_schedules ds       ON e.schedule_id   = ds.id
    LEFT JOIN thesis_submissions ts ON e.submission_id = ts.id
    LEFT JOIN venues v              ON ds.venue_id     = v.id
    ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);
  const [rows] = await db.query(
    `SELECT e.id, e.schedule_id, e.panelist_id, e.submission_id, e.group_id,
            e.score, e.decision, e.remarks, e.status, e.submitted_at, e.created_at, e.updated_at,
            CONCAT(p.first_name, ' ', p.last_name) AS panelist_name,
            ds.scheduled_date, ds.time_slots,
            ts.title AS submission_title, ts.type AS submission_type, ts.school_year,
            v.name AS venue_name
     ${from}
     ORDER BY ds.scheduled_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return paginatedResponse(rows, total, page, limit);
}

function parseSlots(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

async function attachGroups(row) {
  if (!row) return row;
  const [groups] = await db.query(
    `SELECT tg.id, tg.name, tg.title AS group_title
     FROM schedule_groups sg
     JOIN thesis_groups tg ON sg.group_id = tg.id
     WHERE sg.schedule_id = ?`,
    [row.schedule_id]
  );
  row.groups = groups;
  row.time_slots = parseSlots(row.time_slots);
  return row;
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query(`${BASE_SELECT} WHERE e.id = ?`, [id]);
  return attachGroups(row || null);
}

/* Returns ALL evaluations for a schedule by this panelist (one per group). */
async function getByScheduleAndPanelist(schedule_id, panelist_id) {
  const [rows] = await db.query(
    `SELECT e.id, e.schedule_id, e.panelist_id, e.submission_id, e.group_id,
            e.score, e.decision, e.remarks, e.status, e.submitted_at, e.created_at, e.updated_at
     FROM evaluations e
     WHERE e.schedule_id = ? AND e.panelist_id = ?`,
    [schedule_id, panelist_id]
  );
  return rows;
}

/* ─── upsert (save draft or submit) ────────────────────────────────── */
async function upsertEvaluation({ schedule_id, panelist_id, group_id, score, decision, remarks, submit }) {
  if (decision != null && !DECISIONS.includes(decision)) {
    throw Object.assign(new Error('Invalid decision value'), { statusCode: 400 });
  }
  /* verify panelist is assigned to this schedule */
  const [[assigned]] = await db.query(
    'SELECT 1 FROM schedule_panelists WHERE schedule_id = ? AND panelist_id = ?',
    [schedule_id, panelist_id]
  );
  if (!assigned) throw Object.assign(new Error('You are not assigned to this schedule'), { statusCode: 403 });

  /* if group_id provided, verify the group belongs to this schedule */
  if (group_id != null) {
    const [[inSched]] = await db.query(
      'SELECT 1 FROM schedule_groups WHERE schedule_id = ? AND group_id = ?',
      [schedule_id, group_id]
    );
    if (!inSched) throw Object.assign(new Error('Group is not part of this schedule'), { statusCode: 400 });
  }

  /* get submission_id from schedule (may be null for group-based schedules) */
  const [[sched]] = await db.query(
    'SELECT submission_id FROM defense_schedules WHERE id = ?', [schedule_id]
  );
  if (!sched) throw Object.assign(new Error('Schedule not found'), { statusCode: 404 });

  const newStatus   = submit ? 'submitted' : 'pending';
  const submittedAt = submit ? new Date() : null;
  const gid         = group_id ?? null;

  /* NULL-safe equality: <=> matches NULL = NULL */
  const [[existing]] = await db.query(
    'SELECT id, status FROM evaluations WHERE schedule_id = ? AND panelist_id = ? AND group_id <=> ?',
    [schedule_id, panelist_id, gid]
  );

  if (existing) {
    if (existing.status === 'submitted')
      throw Object.assign(new Error('Evaluation already submitted and cannot be edited'), { statusCode: 400 });

    await db.query(
      `UPDATE evaluations
       SET score = ?, decision = ?, remarks = ?, status = ?, submitted_at = COALESCE(submitted_at, ?)
       WHERE id = ?`,
      [score ?? null, decision ?? null, remarks ?? null, newStatus, submittedAt, existing.id]
    );
    return getById(existing.id);
  }

  const [result] = await db.query(
    `INSERT INTO evaluations (schedule_id, panelist_id, group_id, submission_id, score, decision, remarks, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schedule_id, panelist_id, gid, sched.submission_id, score ?? null, decision ?? null, remarks ?? null, newStatus, submittedAt]
  );
  return getById(result.insertId);
}

/* ─── the chairperson's decision is the official/overall outcome ────── */
async function getChairpersonDecision({ group_id, submission_id, schedule_id }) {
  const conditions = ["e.status = 'submitted'", "sp.role_label = 'chairperson'"];
  const params = [];
  if (group_id) {
    conditions.push('e.group_id = ?');
    params.push(group_id);
  } else if (submission_id) {
    conditions.push('e.submission_id = ? AND e.group_id IS NULL');
    params.push(submission_id);
  } else {
    return null;
  }
  if (schedule_id) {
    conditions.push('e.schedule_id = ?');
    params.push(schedule_id);
  }

  const [[row]] = await db.query(
    `SELECT e.decision, e.schedule_id, ds.defense_type, ds.scheduled_date
     FROM evaluations e
     JOIN defense_schedules ds  ON e.schedule_id = ds.id
     JOIN schedule_panelists sp ON sp.schedule_id = e.schedule_id AND sp.panelist_id = e.panelist_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ds.scheduled_date DESC, e.submitted_at DESC
     LIMIT 1`,
    params
  );
  return row || null;
}

/* ─── student: decision + comments for own group (never scores) ────── */
async function getStudentScores(student_id) {
  const [[membership]] = await db.query(
    'SELECT group_id FROM group_members WHERE student_id = ? LIMIT 1',
    [student_id]
  );
  if (!membership) return { group: null, schedules: [] };

  const group_id = membership.group_id;

  const [[group]] = await db.query(
    `SELECT tg.id, tg.name, tg.title, tg.school_year,
            CONCAT(a.first_name, ' ', a.last_name) AS adviser_name
     FROM thesis_groups tg
     LEFT JOIN users a ON tg.adviser_id = a.id
     WHERE tg.id = ?`,
    [group_id]
  );

  /* deliberately excludes e.score — students only see the decision + comments */
  const [rows] = await db.query(
    `SELECT e.id, e.remarks, e.submitted_at,
            CONCAT(p.first_name, ' ', p.last_name) AS panelist_name,
            ds.id AS schedule_id, ds.defense_type, ds.scheduled_date, ds.time_slots,
            v.name AS venue_name,
            ts.title AS submission_title, ts.type AS submission_type
     FROM evaluations e
     JOIN users p                    ON e.panelist_id  = p.id
     JOIN defense_schedules ds       ON e.schedule_id  = ds.id
     LEFT JOIN venues v              ON ds.venue_id    = v.id
     LEFT JOIN thesis_submissions ts ON e.submission_id = ts.id
     WHERE e.group_id = ? AND e.status = 'submitted'
     ORDER BY ds.scheduled_date DESC, e.submitted_at DESC`,
    [group_id]
  );

  const scheduleMap = new Map();
  for (const ev of rows) {
    const sid = ev.schedule_id;
    if (!scheduleMap.has(sid)) {
      scheduleMap.set(sid, {
        schedule_id:      sid,
        defense_type:     ev.defense_type,
        scheduled_date:   ev.scheduled_date,
        time_slots:       parseSlots(ev.time_slots),
        venue_name:       ev.venue_name,
        submission_title: ev.submission_title,
        submission_type:  ev.submission_type,
        comments:         [],
      });
    }
    scheduleMap.get(sid).comments.push({
      id:            ev.id,
      panelist_name: ev.panelist_name,
      remarks:       ev.remarks,
      submitted_at:  ev.submitted_at,
    });
  }

  const schedules = [...scheduleMap.values()];
  for (const s of schedules) {
    const chair = await getChairpersonDecision({ group_id, schedule_id: s.schedule_id });
    s.decision = chair ? chair.decision : null;
  }

  return { group, schedules };
}

module.exports = {
  listEvaluations, getById, getByScheduleAndPanelist, upsertEvaluation,
  getStudentScores, getChairpersonDecision,
};
