const db = require('../../config/database');
const fs = require('fs');
const usersService = require('../users/users.service');

/* ─── Parse CSV (simple: one student_number per line, optional header) ── */
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const numbers = [];
  for (const line of lines) {
    /* skip header rows that contain non-data text */
    if (/^student.?number/i.test(line) || /^#/.test(line)) continue;
    numbers.push(line);
  }
  return numbers;
}

/* ─── Bulk assign adviser to students' active submissions ──────────────── */
async function bulkAssign(filePath, adviserId) {
  const studentNumbers = parseCsv(filePath);

  if (!studentNumbers.length)
    throw Object.assign(new Error('CSV file contains no student numbers.'), { statusCode: 400 });

  const results = { assigned: 0, already_assigned: 0, not_found: [], total: studentNumbers.length };

  for (const num of studentNumbers) {
    /* find student by student_number */
    const [[student]] = await db.query(
      `SELECT id FROM users WHERE student_number = ? AND deleted_at IS NULL`,
      [num]
    );

    if (!student) {
      results.not_found.push(num);
      continue;
    }

    /* find their active (non-deleted) submissions */
    const [subs] = await db.query(
      `SELECT id, adviser_id FROM thesis_submissions
       WHERE student_id = ? AND deleted_at IS NULL`,
      [student.id]
    );

    if (!subs.length) {
      results.not_found.push(`${num} (no submissions)`);
      continue;
    }

    let anyChanged = false;
    for (const sub of subs) {
      if (sub.adviser_id === adviserId) {
        results.already_assigned++;
      } else {
        await db.query(
          `UPDATE thesis_submissions SET adviser_id = ? WHERE id = ?`,
          [adviserId, sub.id]
        );
        anyChanged = true;
      }
    }
    if (anyChanged) results.assigned++;
  }

  return results;
}

/* ─── My advisees: distinct students with submission summary ───────────── */
async function getMyAdvisees(adviserId, { search, status, page, limit }) {
  const offset     = (page - 1) * limit;
  const conditions = ['ts.adviser_id = ? AND ts.deleted_at IS NULL'];
  const params     = [adviserId];

  if (search) {
    conditions.push(
      '(u.first_name LIKE ? OR u.last_name LIKE ? OR u.student_number LIKE ? OR ts.title LIKE ?)'
    );
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (status) { conditions.push('ts.status = ?'); params.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const from  = `FROM thesis_submissions ts
    JOIN users u       ON ts.student_id    = u.id
    JOIN departments d ON ts.department_id = d.id
    ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);
  const [rows] = await db.query(
    `SELECT ts.id, ts.title, ts.type, ts.school_year, ts.semester, ts.status,
            ts.submitted_at, ts.approved_at, ts.created_at, ts.updated_at,
            ts.student_id,
            u.first_name, u.last_name, u.student_number, u.email AS student_email,
            d.name AS department_name, d.code AS department_code,
            (SELECT sh.remarks FROM submission_history sh
             WHERE sh.submission_id = ts.id ORDER BY sh.changed_at DESC LIMIT 1) AS latest_remarks,
            (SELECT COUNT(*) FROM submission_documents sd WHERE sd.submission_id = ts.id) AS documents_count
     ${from}
     ORDER BY ts.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { paginatedResponse } = require('../../utils/pagination');
  return paginatedResponse(rows, total, page, limit);
}

/* ─── All submitted titles (for similarity checking) ──────────────── */
async function getAllSubmittedTitles(instructorId) {
  const [rows] = await db.query(
    `SELECT ts.id, ts.title, ts.type, ts.school_year, ts.semester, ts.status,
            ts.submitted_at, ts.adviser_id, ts.group_id,
            CONCAT(st.first_name, ' ', st.last_name) AS student_name,
            st.student_number,
            COALESCE(
              CONCAT(adv.first_name, ' ', adv.last_name),
              CONCAT(gadv.first_name, ' ', gadv.last_name)
            ) AS adviser_name,
            d.name AS department_name,
            (ts.adviser_id = ? OR tg.adviser_id = ?) AS is_mine
     FROM thesis_submissions ts
     JOIN users st            ON ts.student_id    = st.id
     JOIN departments d       ON ts.department_id = d.id
     LEFT JOIN users adv      ON ts.adviser_id    = adv.id
     LEFT JOIN thesis_groups tg  ON ts.group_id   = tg.id
     LEFT JOIN users gadv     ON tg.adviser_id    = gadv.id
     WHERE ts.status IN ('submitted', 'under_review') AND ts.deleted_at IS NULL
     ORDER BY ts.submitted_at DESC`,
    [instructorId, instructorId]
  );
  return rows;
}

/* ─── Instructor approves their advisee's title ───────────────────── */
async function approveTitle(submissionId, instructorId, remarks) {
  const [[sub]] = await db.query(
    `SELECT id, status, adviser_id, group_id FROM thesis_submissions WHERE id = ? AND deleted_at IS NULL`,
    [submissionId]
  );
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });

  let isAdviser = sub.adviser_id === instructorId;
  if (!isAdviser && sub.group_id) {
    const [[grp]] = await db.query(
      'SELECT adviser_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL',
      [sub.group_id]
    );
    isAdviser = grp?.adviser_id === instructorId;
  }
  if (!isAdviser)
    throw Object.assign(new Error('You are not the adviser for this submission.'), { statusCode: 403 });

  if (!['submitted', 'under_review'].includes(sub.status))
    throw Object.assign(new Error('Only submitted or under-review titles can be approved.'), { statusCode: 400 });

  await db.query(
    `UPDATE thesis_submissions SET status = 'approved', approved_at = NOW() WHERE id = ?`,
    [submissionId]
  );
  await db.query(
    `INSERT INTO submission_history (submission_id, changed_by, old_status, new_status, remarks)
     VALUES (?, ?, ?, 'approved', ?)`,
    [submissionId, instructorId, sub.status, remarks || null]
  );
}

/* ─── Instructor rejects their advisee's title ───────────────────── */
async function rejectTitle(submissionId, instructorId, remarks) {
  if (!remarks || !remarks.trim())
    throw Object.assign(new Error('A reason is required when rejecting a title.'), { statusCode: 400 });

  const [[sub]] = await db.query(
    `SELECT id, status, adviser_id, group_id FROM thesis_submissions WHERE id = ? AND deleted_at IS NULL`,
    [submissionId]
  );
  if (!sub) throw Object.assign(new Error('Submission not found.'), { statusCode: 404 });

  let isAdviser = sub.adviser_id === instructorId;
  if (!isAdviser && sub.group_id) {
    const [[grp]] = await db.query(
      'SELECT adviser_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL',
      [sub.group_id]
    );
    isAdviser = grp?.adviser_id === instructorId;
  }
  if (!isAdviser)
    throw Object.assign(new Error('You are not the adviser for this submission.'), { statusCode: 403 });

  if (!['submitted', 'under_review'].includes(sub.status))
    throw Object.assign(new Error('Only submitted or under-review titles can be rejected.'), { statusCode: 400 });

  await db.query(
    `UPDATE thesis_submissions SET status = 'rejected' WHERE id = ?`,
    [submissionId]
  );
  await db.query(
    `INSERT INTO submission_history (submission_id, changed_by, old_status, new_status, remarks)
     VALUES (?, ?, ?, 'rejected', ?)`,
    [submissionId, instructorId, sub.status, remarks.trim()]
  );
}

/* ─── Remove adviser from a group ─────────────────────────────────── */
async function removeFromGroup(groupId, adviserId) {
  const [[group]] = await db.query(
    'SELECT id, adviser_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL',
    [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.adviser_id !== adviserId)
    throw Object.assign(new Error('You are not the adviser of this group.'), { statusCode: 403 });

  await db.query('UPDATE thesis_groups SET adviser_id = NULL WHERE id = ?', [groupId]);
}

/* ─── My groups: groups where instructor is set as adviser ─────────── */
async function getMyGroups(adviserId) {
  const [groups] = await db.query(
    `SELECT tg.id, tg.name, tg.join_code, tg.title, tg.school_year, tg.max_members, tg.created_at,
            tg.leader_id,
            CONCAT(l.first_name, ' ', l.last_name) AS leader_name,
            d.name AS department_name, d.code AS department_code
     FROM thesis_groups tg
     JOIN users l       ON tg.leader_id     = l.id
     JOIN departments d ON tg.department_id = d.id
     WHERE tg.adviser_id = ? AND tg.deleted_at IS NULL
     ORDER BY tg.created_at DESC`,
    [adviserId]
  );

  for (const group of groups) {
    const [members] = await db.query(
      `SELECT gm.student_id, gm.joined_at,
              CONCAT(u.first_name, ' ', u.last_name) AS name,
              u.student_number, u.email
       FROM group_members gm
       JOIN users u ON gm.student_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`,
      [group.id]
    );
    group.members = members;
    group.member_count = members.length;
  }

  return groups;
}

/* ─── Instructor creates accounts for the students they handle ─────── */
async function importStudents(filePath, instructor) {
  if (!instructor.department_id) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    throw Object.assign(
      new Error('Your account does not have a department assigned. Contact an admin.'),
      { statusCode: 400 }
    );
  }
  return usersService.importStudents(filePath, instructor.department_id, instructor.id);
}

function downloadImportTemplate() {
  return usersService.generateStudentImportTemplate();
}

function exportCredentials(credentials) {
  return usersService.generateCredentialsExport(credentials);
}

/* ─── Students created/handled directly by this instructor ─────────── */
async function getMyStudents(adviserId) {
  const [rows] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.student_number,
            u.is_active, u.created_at
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'student' AND u.adviser_id = ? AND u.deleted_at IS NULL
     ORDER BY u.last_name ASC, u.first_name ASC`,
    [adviserId]
  );
  return rows;
}

/* ─── List all active instructors (for student adviser selection) ──── */
async function listAdvisers() {
  const [rows] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email,
            d.name AS department_name, d.code AS department_code
     FROM users u
     JOIN roles r        ON u.role_id       = r.id
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE r.name = 'instructor' AND u.is_active = 1 AND u.deleted_at IS NULL
     ORDER BY u.last_name ASC, u.first_name ASC`
  );
  return rows;
}

module.exports = {
  bulkAssign, getMyAdvisees, getAllSubmittedTitles, approveTitle, rejectTitle,
  getMyGroups, removeFromGroup, listAdvisers,
  importStudents, downloadImportTemplate, exportCredentials, getMyStudents,
};
