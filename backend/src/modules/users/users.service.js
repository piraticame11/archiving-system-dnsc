const db       = require('../../config/database');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');
const XLSX     = require('xlsx');
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

function parseBirthdate(val) {
  const s = String(val || '').trim();

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { year: m[1], month: m[2], day: m[3] };

  // MM/DD/YYYY or M/D/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { year: m[3], month: m[1].padStart(2, '0'), day: m[2].padStart(2, '0') };

  // MM-DD-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return { year: m[3], month: m[1].padStart(2, '0'), day: m[2].padStart(2, '0') };

  // Excel serial date (number)
  const n = Number(s);
  if (!isNaN(n) && n > 1000) {
    const d = XLSX.SSF.parse_date_code(n);
    if (d) return {
      year: String(d.y),
      month: String(d.m).padStart(2, '0'),
      day:   String(d.d).padStart(2, '0'),
    };
  }

  return null;
}

async function importStudents(filePath, department_id) {
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));

  const [[studentRole]] = await db.query('SELECT id FROM roles WHERE name = ?', ['student']);
  if (!studentRole) throw Object.assign(new Error('Student role not found'), { statusCode: 500 });

  if (department_id) {
    const [[dept]] = await db.query('SELECT id FROM departments WHERE id = ?', [department_id]);
    if (!dept) throw Object.assign(new Error('Selected department does not exist'), { statusCode: 400 });
  }

  const results = { created: 0, skipped: [], errors: [], credentials: [] };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    const first_name  = String(row[0] || '').trim();
    const last_name   = String(row[1] || '').trim();
    const birthdateRaw = String(row[2] || '').trim();
    const id_number   = String(row[3] || '').trim();

    if (!first_name || !last_name || !birthdateRaw || !id_number) {
      results.errors.push({ row: rowNum, reason: 'Missing required fields (first_name, last_name, birthdate, id_number)' });
      continue;
    }

    const bd = parseBirthdate(birthdateRaw);
    if (!bd) {
      results.errors.push({ row: rowNum, reason: `Invalid birthdate format: "${birthdateRaw}". Use MM/DD/YYYY or YYYY-MM-DD.` });
      continue;
    }

    const initials  = first_name.split(/\s+/).map(w => w[0]).join('').toLowerCase();
    const emailBase = last_name.toLowerCase().replace(/\s+/g, '');
    const email     = `${initials}${emailBase}${id_number}@aces.edu.ph`;
    const password  = `welcome@${bd.month}${bd.day}${bd.year}`;

    const [[existing]] = await db.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]
    );
    if (existing) {
      results.skipped.push({ row: rowNum, email, reason: 'Account already exists' });
      continue;
    }

    try {
      const password_hash = await bcrypt.hash(password, 10);
      await db.query(
        `INSERT INTO users (role_id, department_id, student_number, first_name, last_name, email,
                            password_hash, is_active, is_email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [studentRole.id, department_id || null, id_number, first_name, last_name, email, password_hash]
      );
      results.created++;
      results.credentials.push({ first_name, last_name, email, password });
    } catch (err) {
      results.errors.push({ row: rowNum, reason: err.message });
    }
  }

  return results;
}

function generateCredentialsExport(credentials) {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ['First Name', 'Last Name', 'Email (Username)', 'Default Password'],
    ...credentials.map(c => [c.first_name, c.last_name, c.email, c.password]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 40 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function generateStudentImportTemplate() {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ['first_name', 'last_name', 'birthdate', 'id_number'],
    ['Howard Glen', 'Gloria',   '02/11/2003', '2021-00163'],
    ['Maria Clara', 'Santos',   '07/04/2002', '2022-00045'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser, toggleActive, resetPassword, importStudents, generateStudentImportTemplate, generateCredentialsExport };
