const db = require('../../config/database');
const { paginatedResponse } = require('../../utils/pagination');
const groupService = require('../groups/groups.service');

/* ─── shared SELECT ───────────────────────────────────────────────── */
const BASE_SELECT = `
  SELECT ts.id, ts.title, ts.abstract, ts.keywords, ts.type,
         ts.school_year, ts.semester, ts.status,
         ts.submitted_at, ts.approved_at, ts.created_at, ts.updated_at,
         ts.student_id, ts.adviser_id, ts.department_id,
         CONCAT(st.first_name, ' ', st.last_name) AS student_name,
         st.student_number,
         CONCAT(adv.first_name, ' ', adv.last_name) AS adviser_name,
         d.name AS department_name, d.code AS department_code
  FROM thesis_submissions ts
  JOIN users st       ON ts.student_id    = st.id
  JOIN departments d  ON ts.department_id = d.id
  LEFT JOIN users adv ON ts.adviser_id    = adv.id`;

/* ─── list ────────────────────────────────────────────────────────── */
async function listSubmissions({ search, status, department_id, type, school_year, page, limit, student_id, adviser_id }) {
  const offset     = (page - 1) * limit;
  const conditions = ['ts.deleted_at IS NULL'];
  const params     = [];

  if (search) {
    conditions.push('(ts.title LIKE ? OR st.first_name LIKE ? OR st.last_name LIKE ? OR st.student_number LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (status)        { conditions.push('ts.status = ?');         params.push(status); }
  if (department_id) { conditions.push('ts.department_id = ?');  params.push(department_id); }
  if (type)          { conditions.push('ts.type = ?');           params.push(type); }
  if (school_year)   { conditions.push('ts.school_year = ?');    params.push(school_year); }
  if (student_id)    { conditions.push('ts.student_id = ?');     params.push(student_id); }
  if (adviser_id)    { conditions.push('ts.adviser_id = ?');     params.push(adviser_id); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const from  = `FROM thesis_submissions ts
    JOIN users st ON ts.student_id = st.id
    JOIN departments d ON ts.department_id = d.id
    LEFT JOIN users adv ON ts.adviser_id = adv.id
    ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);
  const [rows] = await db.query(
    `SELECT ts.id, ts.title, ts.type, ts.school_year, ts.semester, ts.status,
            ts.submitted_at, ts.approved_at, ts.created_at,
            ts.student_id, ts.adviser_id, ts.department_id,
            CONCAT(st.first_name, ' ', st.last_name) AS student_name,
            st.student_number,
            CONCAT(adv.first_name, ' ', adv.last_name) AS adviser_name,
            d.name AS department_name, d.code AS department_code,
            (SELECT COUNT(*) FROM submission_documents sd WHERE sd.submission_id = ts.id) AS documents_count,
            (SELECT sh.remarks FROM submission_history sh WHERE sh.submission_id = ts.id ORDER BY sh.changed_at DESC LIMIT 1) AS latest_remarks
     ${from}
     ORDER BY ts.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return paginatedResponse(rows, total, page, limit);
}

/* ─── single ──────────────────────────────────────────────────────── */
async function getById(id) {
  const [rows] = await db.query(
    `${BASE_SELECT} WHERE ts.id = ? AND ts.deleted_at IS NULL`, [id]
  );
  if (!rows[0]) return null;
  const sub = rows[0];

  /* attach documents */
  const [docs] = await db.query(
    `SELECT sd.id, sd.doc_type, sd.file_name, sd.file_size, sd.mime_type,
            sd.version, sd.is_current, sd.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM submission_documents sd
     JOIN users u ON sd.uploaded_by = u.id
     WHERE sd.submission_id = ?
     ORDER BY sd.created_at DESC`,
    [id]
  );
  sub.documents = docs;

  /* attach status history */
  const [history] = await db.query(
    `SELECT sh.old_status, sh.new_status, sh.remarks, sh.changed_at,
            CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
     FROM submission_history sh
     JOIN users u ON sh.changed_by = u.id
     WHERE sh.submission_id = ?
     ORDER BY sh.changed_at DESC`,
    [id]
  );
  sub.history = history;

  return sub;
}

/* ─── create (student) ────────────────────────────────────────────── */
async function createSubmission({ student_id, title, abstract, keywords, type, school_year, semester, department_id }) {
  /* enforce group leader-only submission */
  const groupRole = await groupService.getStudentGroupRole(student_id);
  if (groupRole.inGroup && !groupRole.isLeader) {
    throw Object.assign(
      new Error('Only the group leader can submit a title on behalf of the group.'),
      { statusCode: 403 }
    );
  }

  /* check student doesn't already have a non-rejected active submission for same period */
  const [[dup]] = await db.query(
    `SELECT id FROM thesis_submissions
     WHERE student_id = ? AND school_year = ? AND semester = ?
       AND status NOT IN ('rejected') AND deleted_at IS NULL`,
    [student_id, school_year, semester]
  );
  if (dup) throw Object.assign(new Error('You already have an active submission for this school year and semester.'), { statusCode: 409 });

  /* if the student is a group leader, also check that the group has no active submission yet */
  if (groupRole.inGroup && groupRole.isLeader) {
    const [[groupDup]] = await db.query(
      `SELECT id FROM thesis_submissions
       WHERE group_id = ? AND school_year = ? AND semester = ?
         AND status NOT IN ('rejected') AND deleted_at IS NULL`,
      [groupRole.groupId, school_year, semester]
    );
    if (groupDup) throw Object.assign(new Error('Your group already has an active submission for this period.'), { statusCode: 409 });
  }

  const groupId = groupRole.isLeader ? groupRole.groupId : null;

  const [result] = await db.query(
    `INSERT INTO thesis_submissions
       (student_id, group_id, department_id, title, abstract, keywords, type, school_year, semester, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [student_id, groupId, department_id, title, abstract || null, keywords || null, type, school_year, semester]
  );
  return getById(result.insertId);
}

/* ─── update (student edits draft / admin edits) ─────────────────── */
async function updateSubmission(id, fields, actorId) {
  const sub = await getById(id);
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

  const updates = {};
  const { title, abstract, keywords, type, school_year, semester } = fields;
  if (title       !== undefined) updates.title       = title;
  if (abstract    !== undefined) updates.abstract    = abstract || null;
  if (keywords    !== undefined) updates.keywords    = keywords || null;
  if (type        !== undefined) updates.type        = type;
  if (school_year !== undefined) updates.school_year = school_year;
  if (semester    !== undefined) updates.semester    = semester;

  if (!Object.keys(updates).length) return sub;
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE thesis_submissions SET ${set} WHERE id = ?`, [...Object.values(updates), id]);
  return getById(id);
}

/* ─── submit (draft → submitted) ─────────────────────────────────── */
async function submitForReview(id, studentId) {
  const sub = await getById(id);
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

  /* group submission: only the leader can submit */
  if (sub.group_id) {
    const groupRole = await groupService.getStudentGroupRole(studentId);
    if (!groupRole.isLeader || groupRole.groupId !== sub.group_id)
      throw Object.assign(new Error('Only the group leader can submit this group\'s title.'), { statusCode: 403 });
  } else if (sub.student_id !== studentId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  if (sub.status !== 'draft' && sub.status !== 'revision_required')
    throw Object.assign(new Error('Only draft or revision-required submissions can be submitted.'), { statusCode: 400 });

  await db.query(
    `UPDATE thesis_submissions SET status = 'submitted', submitted_at = NOW() WHERE id = ?`, [id]
  );
  await recordHistory(id, studentId, sub.status, 'submitted', null);
  return getById(id);
}

/* ─── update status (admin) ───────────────────────────────────────── */
async function updateStatus(id, newStatus, adminId, remarks) {
  const sub = await getById(id);
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

  const allowed = {
    submitted:    ['under_review', 'rejected'],
    under_review: ['approved', 'rejected', 'revision_required'],
  };
  if (!allowed[sub.status]?.includes(newStatus))
    throw Object.assign(
      new Error(`Cannot transition from "${sub.status}" to "${newStatus}".`),
      { statusCode: 400 }
    );

  const extra = newStatus === 'approved' ? ', approved_at = NOW()' : '';
  await db.query(
    `UPDATE thesis_submissions SET status = ? ${extra} WHERE id = ?`, [newStatus, id]
  );
  await recordHistory(id, adminId, sub.status, newStatus, remarks || null);
  return getById(id);
}

/* ─── soft delete ─────────────────────────────────────────────────── */
async function deleteSubmission(id, userId, role) {
  const sub = await getById(id);
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

  if (role === 'student') {
    if (sub.student_id !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (sub.status !== 'draft')   throw Object.assign(new Error('Only draft submissions can be deleted.'), { statusCode: 400 });
  }

  await db.query('UPDATE thesis_submissions SET deleted_at = NOW() WHERE id = ?', [id]);
}

/* ─── upload document ─────────────────────────────────────────────── */
async function addDocument({ submission_id, uploaded_by, doc_type, file_name, file_path, file_size, mime_type }) {
  const sub = await getById(submission_id);
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

  /* increment version for same doc_type */
  const [[{ maxVer }]] = await db.query(
    'SELECT COALESCE(MAX(version), 0) AS maxVer FROM submission_documents WHERE submission_id = ? AND doc_type = ?',
    [submission_id, doc_type]
  );
  const version = maxVer + 1;

  /* mark previous as not current */
  await db.query(
    'UPDATE submission_documents SET is_current = 0 WHERE submission_id = ? AND doc_type = ?',
    [submission_id, doc_type]
  );

  const [result] = await db.query(
    `INSERT INTO submission_documents
       (submission_id, uploaded_by, version, doc_type, file_name, file_path, file_size, mime_type, is_current)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [submission_id, uploaded_by, version, doc_type, file_name, file_path, file_size, mime_type]
  );
  return result.insertId;
}

/* ─── get document file info (for view/download) ─────────────────── */
async function getDocumentFile(docId, submissionId) {
  const [[doc]] = await db.query(
    `SELECT id, submission_id, file_path, file_name, mime_type
     FROM submission_documents
     WHERE id = ? AND submission_id = ?`,
    [docId, submissionId]
  );
  return doc || null;
}

/* ─── stats (admin) ───────────────────────────────────────────────── */
async function getStats() {
  const [[counts]] = await db.query(
    `SELECT
       COUNT(*)                                        AS total,
       SUM(status = 'draft')                          AS draft,
       SUM(status = 'submitted')                      AS submitted,
       SUM(status = 'under_review')                   AS under_review,
       SUM(status = 'approved')                       AS approved,
       SUM(status = 'rejected')                       AS rejected,
       SUM(status = 'revision_required')              AS revision_required
     FROM thesis_submissions WHERE deleted_at IS NULL`
  );
  return counts;
}

/* ─── internal helper ─────────────────────────────────────────────── */
async function recordHistory(submission_id, changed_by, old_status, new_status, remarks) {
  await db.query(
    `INSERT INTO submission_history (submission_id, changed_by, old_status, new_status, remarks)
     VALUES (?, ?, ?, ?, ?)`,
    [submission_id, changed_by, old_status, new_status, remarks]
  );
}

module.exports = { listSubmissions, getById, createSubmission, updateSubmission, submitForReview, updateStatus, deleteSubmission, addDocument, getDocumentFile, getStats };
