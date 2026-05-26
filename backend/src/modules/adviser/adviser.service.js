const db = require('../../config/database');
const fs = require('fs');

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

module.exports = { bulkAssign, getMyAdvisees };
