const db       = require('../../config/database');
const bcrypt   = require('bcryptjs');
const { paginatedResponse } = require('../../utils/pagination');

async function listUsers({ search, role, status, page, limit }) {
  const offset = (page - 1) * limit;
  const conditions = ['u.deleted_at IS NULL'];
  const params = [];

  if (search) {
    conditions.push(
      '(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.student_number LIKE ?)'
    );
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (role)              { conditions.push('r.name = ?');      params.push(role); }
  if (status === 'active')   conditions.push('u.is_active = 1');
  if (status === 'inactive') conditions.push('u.is_active = 0');

  const where = conditions.join(' AND ');
  const base  = `FROM users u JOIN roles r ON u.role_id = r.id LEFT JOIN departments d ON u.department_id = d.id WHERE ${where}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, params);
  const [rows] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.student_number,
            u.is_active, u.is_email_verified, u.created_at, u.department_id,
            r.id AS role_id, r.name AS role,
            d.name AS department_name, d.code AS department_code
     ${base}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function getUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.student_number,
            u.is_active, u.is_email_verified, u.created_at, u.updated_at, u.department_id,
            r.id AS role_id, r.name AS role,
            d.name AS department_name, d.code AS department_code
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

async function createUser({ first_name, last_name, email, password, role, department_id, student_number, is_active }) {
  const [[roleRow]] = await db.query('SELECT id FROM roles WHERE name = ?', [role]);
  if (!roleRow) throw Object.assign(new Error('Invalid role'), { statusCode: 400 });

  const [[existing]] = await db.query(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]
  );
  if (existing) throw Object.assign(new Error('Email is already in use'), { statusCode: 409 });

  const password_hash = await bcrypt.hash(password, 12);
  const [result] = await db.query(
    `INSERT INTO users (role_id, department_id, student_number, first_name, last_name, email,
                        password_hash, is_active, is_email_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [roleRow.id, department_id || null, student_number || null,
     first_name, last_name, email, password_hash, is_active ? 1 : 0]
  );
  return getUserById(result.insertId);
}

async function updateUser(id, fields) {
  const user = await getUserById(id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const updates = {};
  const { first_name, last_name, email, role, department_id, student_number, is_active, password } = fields;

  if (first_name    !== undefined) updates.first_name    = first_name;
  if (last_name     !== undefined) updates.last_name     = last_name;
  if (student_number !== undefined) updates.student_number = student_number || null;
  if (department_id  !== undefined) updates.department_id  = department_id  || null;
  if (is_active      !== undefined) updates.is_active      = is_active ? 1 : 0;

  if (email !== undefined) {
    const [[dup]] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL', [email, id]
    );
    if (dup) throw Object.assign(new Error('Email is already in use'), { statusCode: 409 });
    updates.email = email;
  }

  if (role !== undefined) {
    const [[roleRow]] = await db.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roleRow) throw Object.assign(new Error('Invalid role'), { statusCode: 400 });
    updates.role_id = roleRow.id;
  }

  if (password) updates.password_hash = await bcrypt.hash(password, 12);

  if (!Object.keys(updates).length) return user;

  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE users SET ${set} WHERE id = ?`, [...Object.values(updates), id]);
  return getUserById(id);
}

async function deleteUser(id) {
  const user = await getUserById(id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  await db.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);
}

async function toggleActive(id) {
  const user = await getUserById(id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const next = user.is_active ? 0 : 1;
  await db.query('UPDATE users SET is_active = ? WHERE id = ?', [next, id]);
  return getUserById(id);
}

async function resetPassword(id, newPassword) {
  const user = await getUserById(id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser, toggleActive, resetPassword };
