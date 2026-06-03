const db = require('../../config/database');

async function listAll() {
  const [rows] = await db.query(
    `SELECT ig.id, ig.title, ig.description, ig.category,
            ig.file_name, ig.file_size, ig.mime_type,
            ig.uploaded_by, ig.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM instructor_guidelines ig
     JOIN users u ON ig.uploaded_by = u.id
     WHERE ig.deleted_at IS NULL
     ORDER BY ig.created_at DESC`
  );
  return rows;
}

async function listByInstructor(instructorId) {
  const [rows] = await db.query(
    `SELECT ig.id, ig.title, ig.description, ig.category,
            ig.file_name, ig.file_size, ig.mime_type,
            ig.uploaded_by, ig.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM instructor_guidelines ig
     JOIN users u ON ig.uploaded_by = u.id
     WHERE ig.deleted_at IS NULL AND ig.uploaded_by = ?
     ORDER BY ig.created_at DESC`,
    [instructorId]
  );
  return rows;
}

async function getById(id) {
  const [[row]] = await db.query(
    `SELECT ig.id, ig.title, ig.description, ig.category,
            ig.file_name, ig.file_path, ig.file_size, ig.mime_type,
            ig.uploaded_by, ig.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM instructor_guidelines ig
     JOIN users u ON ig.uploaded_by = u.id
     WHERE ig.id = ? AND ig.deleted_at IS NULL`,
    [id]
  );
  return row || null;
}

async function create({ title, description, category, file_name, file_path, file_size, mime_type, uploaded_by }) {
  const [result] = await db.query(
    `INSERT INTO instructor_guidelines
       (title, description, category, file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, category || 'General', file_name, file_path, file_size, mime_type, uploaded_by]
  );
  return getById(result.insertId);
}

async function softDelete(id) {
  await db.query(
    `UPDATE instructor_guidelines SET deleted_at = NOW() WHERE id = ?`,
    [id]
  );
}

module.exports = { listAll, listByInstructor, getById, create, softDelete };
