const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../config/database');
const jwtConfig = require('../../config/jwt');
const { sendMail, passwordResetHtml } = require('../../config/mailer');

async function findUserByEmail(email) {
  const [rows] = await db.query(
    `SELECT u.*, r.name AS role FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ? AND u.deleted_at IS NULL LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.role_id, u.department_id, u.student_number,
            u.first_name, u.last_name, u.email, u.is_active,
            u.is_email_verified, u.profile_photo, u.created_at,
            r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, department_id: user.department_id },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ id: user.id }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
}

async function storeRefreshToken(userId, token) {
  const hash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + jwtConfig.refreshExpiresMs);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [userId, hash, expiresAt]
  );
}

async function register({ first_name, last_name, email, password, role, department_id, student_number }) {
  const existing = await findUserByEmail(email);
  if (existing) throw Object.assign(new Error('Email already registered.'), { status: 409 });

  const [roleRows] = await db.query(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [role]);
  if (!roleRows.length) throw Object.assign(new Error('Invalid role.'), { status: 400 });

  const hash = await bcrypt.hash(password, 12);
  const [result] = await db.query(
    `INSERT INTO users (role_id, department_id, student_number, first_name, last_name, email, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [roleRows[0].id, department_id || null, student_number || null, first_name, last_name, email, hash]
  );

  return result.insertId;
}

async function login(email, password) {
  const user = await findUserByEmail(email);
  if (!user) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });
  if (!user.is_active) throw Object.assign(new Error('Account not yet activated. Contact the Research Office.'), { status: 403 });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });

  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken);

  const { password_hash, ...safeUser } = user;
  return { accessToken, refreshToken, user: safeUser };
}

async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.refreshSecret);
  } catch {
    throw Object.assign(new Error('Invalid refresh token.'), { status: 401 });
  }

  const [tokenRows] = await db.query(
    `SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked = 0 AND expires_at > NOW()`,
    [payload.id]
  );

  let matched = null;
  for (const row of tokenRows) {
    if (await bcrypt.compare(token, row.token_hash)) { matched = row; break; }
  }
  if (!matched) throw Object.assign(new Error('Refresh token not found or expired.'), { status: 401 });

  await db.query(`UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`, [matched.id]);

  const user = await findUserById(payload.id);
  if (!user || !user.is_active) throw Object.assign(new Error('User not found or inactive.'), { status: 401 });

  const newAccess  = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  await storeRefreshToken(user.id, newRefresh);

  return { accessToken: newAccess, refreshToken: newRefresh };
}

async function logout(token) {
  let payload;
  try { payload = jwt.verify(token, jwtConfig.refreshSecret); } catch { return; }

  const [tokenRows] = await db.query(
    `SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked = 0`,
    [payload.id]
  );

  for (const row of tokenRows) {
    if (await bcrypt.compare(token, row.token_hash)) {
      await db.query(`UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`, [row.id]);
      break;
    }
  }
}

async function forgotPassword(email) {
  const user = await findUserByEmail(email);
  if (!user) return; // silent — don't reveal whether email exists

  const token     = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
    [user.id, token, expiresAt]
  );

  const link = `${process.env.FRONTEND_URL}/pages/reset-password.html?token=${token}`;
  await sendMail({
    to:      user.email,
    subject: 'Password Reset — DNSC Research System',
    html:    passwordResetHtml(`${user.first_name} ${user.last_name}`, link),
  });
}

async function resetPassword(token, newPassword) {
  const [rows] = await db.query(
    `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
    [token]
  );
  if (!rows.length) throw Object.assign(new Error('Invalid or expired reset token.'), { status: 400 });

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, rows[0].user_id]);
  await db.query(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`, [rows[0].id]);
  // revoke all refresh tokens for this user
  await db.query(`UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`, [rows[0].user_id]);
}

async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await db.query(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`, [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found.'), { status: 404 });

  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) throw Object.assign(new Error('Current password is incorrect.'), { status: 400 });

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, userId]);
}

async function updateProfile(userId, { first_name, last_name, profile_photo }) {
  const fields = [];
  const vals   = [];
  if (first_name)    { fields.push('first_name = ?');    vals.push(first_name); }
  if (last_name)     { fields.push('last_name = ?');     vals.push(last_name); }
  if (profile_photo) { fields.push('profile_photo = ?'); vals.push(profile_photo); }
  if (!fields.length) return;

  vals.push(userId);
  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, changePassword, updateProfile, findUserById };
