const db = require('../../config/database');

/* ─── list ──────────────────────────────────────────────────────────── */
async function listTemplates() {
  const [rows] = await db.query(
    `SELECT it.id, it.title, it.description, it.file_name, it.file_path,
            it.file_size, it.mime_type, it.uploaded_by,
            it.created_at, it.updated_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM imrad_templates it
     JOIN users u ON it.uploaded_by = u.id
     WHERE it.deleted_at IS NULL
     ORDER BY it.created_at DESC`
  );
  return rows;
}

/* ─── single ────────────────────────────────────────────────────────── */
async function getById(id) {
  const [[row]] = await db.query(
    `SELECT it.id, it.title, it.description, it.file_name, it.file_path,
            it.file_size, it.mime_type, it.uploaded_by,
            it.created_at, it.updated_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
     FROM imrad_templates it
     JOIN users u ON it.uploaded_by = u.id
     WHERE it.id = ? AND it.deleted_at IS NULL`,
    [id]
  );
  return row || null;
}

/* ─── create ────────────────────────────────────────────────────────── */
async function createTemplate({ title, description, file_name, file_path, file_size, mime_type, uploaded_by }) {
  const [result] = await db.query(
    `INSERT INTO imrad_templates (title, description, file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, file_name, file_path, file_size, mime_type, uploaded_by]
  );
  return getById(result.insertId);
}

/* ─── soft delete ───────────────────────────────────────────────────── */
async function deleteTemplate(id) {
  await db.query(
    `UPDATE imrad_templates SET deleted_at = NOW() WHERE id = ?`,
    [id]
  );
}

module.exports = { listTemplates, getById, createTemplate, deleteTemplate };
