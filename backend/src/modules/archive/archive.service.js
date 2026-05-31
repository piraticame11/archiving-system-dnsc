const path = require('path');
const fs   = require('fs');
const db   = require('../../config/database');
const { getPagination, paginatedResponse } = require('../../utils/pagination');

/* ── helpers ─────────────────────────────────────────────────────── */
const BASE_SELECT = `
  SELECT a.id, a.title, a.authors, a.adviser, a.school_year, a.semester,
         a.type, a.keywords, a.archived_at, a.download_count, a.submission_id,
         d.name  AS department_name, d.code AS department_code,
         CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
         sd.file_name, sd.file_size, sd.mime_type
  FROM archive a
  JOIN departments d          ON a.department_id = d.id
  JOIN users u                ON a.archived_by   = u.id
  JOIN submission_documents sd ON a.document_id   = sd.id`;

const FULL_SELECT = `
  SELECT a.*, a.abstract,
         d.name  AS department_name, d.code AS department_code,
         CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
         sd.file_name, sd.file_size, sd.mime_type, sd.file_path
  FROM archive a
  JOIN departments d          ON a.department_id = d.id
  JOIN users u                ON a.archived_by   = u.id
  JOIN submission_documents sd ON a.document_id   = sd.id`;

/* ── list (browse) ───────────────────────────────────────────────── */
async function listArchive({ search, department_id, school_year, semester, type, page, limit }) {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push('(a.title LIKE ? OR a.authors LIKE ? OR a.keywords LIKE ? OR a.abstract LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (department_id) { conditions.push('a.department_id = ?'); params.push(department_id); }
  if (school_year)   { conditions.push('a.school_year = ?');   params.push(school_year); }
  if (semester)      { conditions.push('a.semester = ?');      params.push(semester); }
  if (type)          { conditions.push('a.type = ?');          params.push(type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const from  = `FROM archive a
    JOIN departments d ON a.department_id = d.id
    JOIN users u ON a.archived_by = u.id
    JOIN submission_documents sd ON a.document_id = sd.id
    ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from}`, params);
  const [rows] = await db.query(
    `SELECT a.id, a.title, a.abstract, a.authors, a.adviser, a.school_year, a.semester,
            a.type, a.keywords, a.archived_at, a.download_count, a.submission_id,
            d.name AS department_name, d.code AS department_code,
            CONCAT(u.first_name, ' ', u.last_name) AS archived_by_name,
            sd.file_name, sd.file_size, sd.mime_type
     ${from}
     ORDER BY a.archived_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

/* ── single entry ────────────────────────────────────────────────── */
async function getArchiveById(id) {
  const [rows] = await db.query(
    `${FULL_SELECT} WHERE a.id = ?`, [id]
  );
  return rows[0] || null;
}

/* ── eligible submissions (approved, not yet archived) ───────────── */
async function getEligible({ page, limit }) {
  const offset = (page - 1) * limit;

  const base = `FROM thesis_submissions ts
    JOIN users u       ON ts.student_id    = u.id
    JOIN departments d ON ts.department_id = d.id
    WHERE ts.status = 'approved'
      AND ts.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM archive a WHERE a.submission_id = ts.id)`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`);
  const [rows] = await db.query(
    `SELECT ts.id, ts.title, ts.type, ts.school_year, ts.semester,
            ts.abstract, ts.keywords, ts.approved_at,
            CONCAT(u.first_name, ' ', u.last_name) AS student_name,
            u.student_number,
            d.name AS department_name, d.code AS department_code,
            ts.adviser_id,
            (SELECT CONCAT(a2.first_name, ' ', a2.last_name)
             FROM users a2 WHERE a2.id = ts.adviser_id) AS adviser_name
     ${base}
     ORDER BY ts.approved_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  /* attach full_document files only — those are the only promotable documents */
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const [docs] = await db.query(
      `SELECT id, submission_id, doc_type, file_name, file_size, is_current
       FROM submission_documents
       WHERE submission_id IN (${ids.map(() => '?').join(',')})
         AND doc_type = 'full_document'
       ORDER BY version DESC`,
      ids
    );
    const docMap = {};
    docs.forEach(d => {
      if (!docMap[d.submission_id]) docMap[d.submission_id] = [];
      docMap[d.submission_id].push(d);
    });
    rows.forEach(r => { r.documents = docMap[r.id] || []; });
  }

  return paginatedResponse(rows, total, page, limit);
}

/* ── promote a submission to the archive ─────────────────────────── */
async function promoteToArchive({ submission_id, document_id, authors, adviser, keywords, archived_by }) {
  /* validate submission */
  const [[sub]] = await db.query(
    `SELECT ts.*, d.id AS dept_id
     FROM thesis_submissions ts
     JOIN departments d ON ts.department_id = d.id
     WHERE ts.id = ? AND ts.deleted_at IS NULL`,
    [submission_id]
  );
  if (!sub) throw Object.assign(new Error('Submission not found'), { statusCode: 404 });
  if (sub.status !== 'approved')
    throw Object.assign(new Error('Only approved submissions can be archived'), { statusCode: 400 });

  /* check not already archived */
  const [[existing]] = await db.query('SELECT id FROM archive WHERE submission_id = ?', [submission_id]);
  if (existing) throw Object.assign(new Error('Submission is already archived'), { statusCode: 409 });

  /* validate document belongs to submission and is a full document */
  const [[doc]] = await db.query(
    `SELECT id FROM submission_documents
     WHERE id = ? AND submission_id = ? AND doc_type = 'full_document'`,
    [document_id, submission_id]
  );
  if (!doc) throw Object.assign(new Error('Only full documents can be archived'), { statusCode: 400 });

  const [result] = await db.query(
    `INSERT INTO archive
       (submission_id, document_id, title, abstract, authors, adviser,
        department_id, school_year, semester, keywords, type, archived_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      submission_id, document_id,
      sub.title, sub.abstract || null,
      authors, adviser || null,
      sub.dept_id, sub.school_year, sub.semester,
      keywords || sub.keywords || null,
      sub.type,
      archived_by,
    ]
  );

  return getArchiveById(result.insertId);
}

/* ── download (increment count + return file info) ───────────────── */
async function getDownloadInfo(id) {
  const [rows] = await db.query(
    `SELECT a.id, a.title,
            sd.file_path, sd.file_name, sd.mime_type
     FROM archive a
     JOIN submission_documents sd ON a.document_id = sd.id
     WHERE a.id = ?`,
    [id]
  );
  const entry = rows[0];
  if (!entry) throw Object.assign(new Error('Archive entry not found'), { statusCode: 404 });

  /* resolve absolute path — multer stores full absolute path */
  const absPath = path.isAbsolute(entry.file_path)
    ? entry.file_path
    : path.resolve(process.cwd(), entry.file_path);

  if (!fs.existsSync(absPath))
    throw Object.assign(new Error('File not found on disk'), { statusCode: 404 });

  await db.query('UPDATE archive SET download_count = download_count + 1 WHERE id = ?', [id]);

  return { absPath, fileName: entry.file_name, mimeType: entry.mime_type };
}

/* ── remove from archive ─────────────────────────────────────────── */
async function removeFromArchive(id) {
  const entry = await getArchiveById(id);
  if (!entry) throw Object.assign(new Error('Archive entry not found'), { statusCode: 404 });
  await db.query('DELETE FROM archive WHERE id = ?', [id]);
}

/* ── stats ───────────────────────────────────────────────────────── */
async function getStats() {
  const [[counts]] = await db.query(
    `SELECT
       COUNT(*)                                    AS total,
       SUM(type = 'thesis')                        AS thesis_count,
       SUM(type = 'capstone')                      AS capstone_count,
       COALESCE(SUM(download_count), 0)            AS total_downloads
     FROM archive`
  );
  const [byDept] = await db.query(
    `SELECT d.code, d.name, COUNT(*) AS count
     FROM archive a JOIN departments d ON a.department_id = d.id
     GROUP BY d.id ORDER BY count DESC`
  );
  const [byYear] = await db.query(
    `SELECT school_year, COUNT(*) AS count
     FROM archive GROUP BY school_year ORDER BY school_year DESC LIMIT 5`
  );
  return { ...counts, by_department: byDept, by_year: byYear };
}

module.exports = { listArchive, getArchiveById, getEligible, promoteToArchive, getDownloadInfo, removeFromArchive, getStats };
