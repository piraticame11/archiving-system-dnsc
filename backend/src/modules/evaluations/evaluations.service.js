const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');

const BASE_SELECT = `
  SELECT e.id, e.schedule_id, e.panelist_id, e.submission_id,
         e.score, e.remarks, e.status, e.submitted_at, e.created_at, e.updated_at,
         CONCAT(p.first_name, ' ', p.last_name) AS panelist_name,
         ds.scheduled_at, ds.defense_type,
         ts.title AS submission_title, ts.type AS submission_type, ts.school_year,
         CONCAT(st.first_name, ' ', st.last_name) AS student_name,
         st.student_number,
         v.name AS venue_name
  FROM evaluations e
  JOIN users p              ON e.panelist_id   = p.id
  JOIN defense_schedules ds ON e.schedule_id   = ds.id
  JOIN thesis_submissions ts ON e.submission_id = ts.id
  JOIN users st             ON ts.student_id   = st.id
  LEFT JOIN venues v        ON ds.venue_id     = v.id`;

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
    JOIN users p              ON e.panelist_id   = p.id
    JOIN defense_schedules ds ON e.schedule_id   = ds.id
    JOIN thesis_submissions ts ON e.submission_id = ts.id
    JOIN users st             ON ts.student_id   = st.id
    LEFT JOIN venues v        ON ds.venue_id     = v.id
    ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);
  const [rows] = await db.query(
    `SELECT e.id, e.schedule_id, e.panelist_id, e.submission_id,
            e.score, e.remarks, e.status, e.submitted_at, e.created_at, e.updated_at,
            CONCAT(p.first_name, ' ', p.last_name) AS panelist_name,
            ds.scheduled_at, ds.defense_type,
            ts.title AS submission_title, ts.type AS submission_type, ts.school_year,
            CONCAT(st.first_name, ' ', st.last_name) AS student_name,
            st.student_number,
            v.name AS venue_name
     ${from}
     ORDER BY ds.scheduled_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return paginatedResponse(rows, total, page, limit);
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query(`${BASE_SELECT} WHERE e.id = ?`, [id]);
  return row || null;
}

async function getByScheduleAndPanelist(schedule_id, panelist_id) {
  const [[row]] = await db.query(
    `${BASE_SELECT} WHERE e.schedule_id = ? AND e.panelist_id = ?`,
    [schedule_id, panelist_id]
  );
  return row || null;
}

/* ─── upsert (save draft or submit) ────────────────────────────────── */
async function upsertEvaluation({ schedule_id, panelist_id, score, remarks, submit }) {
  /* verify panelist is assigned to this schedule */
  const [[assigned]] = await db.query(
    'SELECT 1 FROM schedule_panelists WHERE schedule_id = ? AND panelist_id = ?',
    [schedule_id, panelist_id]
  );
  if (!assigned) throw Object.assign(new Error('You are not assigned to this schedule'), { statusCode: 403 });

  /* get submission_id from schedule */
  const [[sched]] = await db.query(
    'SELECT submission_id FROM defense_schedules WHERE id = ?', [schedule_id]
  );
  if (!sched) throw Object.assign(new Error('Schedule not found'), { statusCode: 404 });

  const newStatus    = submit ? 'submitted' : 'pending';
  const submittedAt  = submit ? new Date() : null;

  const [[existing]] = await db.query(
    'SELECT id, status FROM evaluations WHERE schedule_id = ? AND panelist_id = ?',
    [schedule_id, panelist_id]
  );

  if (existing) {
    if (existing.status === 'submitted' && !submit)
      throw Object.assign(new Error('Evaluation already submitted and cannot be edited'), { statusCode: 400 });

    await db.query(
      `UPDATE evaluations
       SET score = ?, remarks = ?, status = ?, submitted_at = COALESCE(submitted_at, ?)
       WHERE id = ?`,
      [score ?? null, remarks ?? null, newStatus, submittedAt, existing.id]
    );
    return getById(existing.id);
  }

  const [result] = await db.query(
    `INSERT INTO evaluations (schedule_id, panelist_id, submission_id, score, remarks, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [schedule_id, panelist_id, sched.submission_id, score ?? null, remarks ?? null, newStatus, submittedAt]
  );
  return getById(result.insertId);
}

module.exports = { listEvaluations, getById, getByScheduleAndPanelist, upsertEvaluation };
