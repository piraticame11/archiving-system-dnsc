const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../config/database');
const jwtConfig = require('../../config/jwt');
const { sendMail, otpHtml, tempPasswordHtml } = require('../../config/mailer');

const OTP_VALIDITY_MS  = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const TEMP_PASSWORD_VALIDITY_MINUTES = 30;

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
            u.personal_email, u.personal_email_verified_at,
            u.must_change_password,
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

  if (user.must_change_password) {
    const expired = !user.temp_password_expires_at || new Date(user.temp_password_expires_at) < new Date();
    if (expired) {
      throw Object.assign(new Error('Your temporary password has expired. Request a new one.'), { status: 401 });
    }
  }

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
    `SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked = 0 AND expires_at > UTC_TIMESTAMP()`,
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

function generateTempPassword() {
  // 10 random alphanumeric characters, unambiguous set
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}

async function forgotPassword(identifier) {
  const [rows] = await db.query(
    `SELECT u.*, r.name AS role FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE (u.email = ? OR u.personal_email = ?) AND u.deleted_at IS NULL LIMIT 1`,
    [identifier, identifier]
  );
  const user = rows[0];
  if (!user) return; // silent — don't reveal whether the identifier exists

  const tempPassword = generateTempPassword();
  const hash          = await bcrypt.hash(tempPassword, 12);
  const expiresAt      = new Date(Date.now() + TEMP_PASSWORD_VALIDITY_MINUTES * 60 * 1000);

  await db.query(
    `UPDATE users SET password_hash = ?, temp_password_expires_at = ?, must_change_password = 1 WHERE id = ?`,
    [hash, expiresAt, user.id]
  );
  await db.query(`UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`, [user.id]);

  await sendMail({
    to:      user.email,
    subject: 'Temporary Password — ACES Research System',
    html:    tempPasswordHtml(`${user.first_name} ${user.last_name}`, tempPassword, TEMP_PASSWORD_VALIDITY_MINUTES),
  });
}

async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await db.query(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`, [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found.'), { status: 404 });

  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) throw Object.assign(new Error('Current password is incorrect.'), { status: 400 });

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password_hash = ?, must_change_password = 0, temp_password_expires_at = NULL WHERE id = ?`,
    [hash, userId]
  );
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function issueOtp(userId, email, name) {
  await db.query(
    `UPDATE email_otps SET used = 1 WHERE user_id = ? AND purpose = 'personal_email_verify' AND used = 0`,
    [userId]
  );

  const code      = generateOtpCode();
  const otpHash   = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS);

  await db.query(
    `INSERT INTO email_otps (user_id, otp_hash, purpose, expires_at) VALUES (?, ?, 'personal_email_verify', ?)`,
    [userId, otpHash, expiresAt]
  );

  await sendMail({
    to:      email,
    subject: 'Verify your personal email — ACES Research System',
    html:    otpHtml(name, code),
  });
}

async function bindPersonalEmail(userId, personalEmail) {
  const [[dup]] = await db.query(
    `SELECT id FROM users WHERE (email = ? OR personal_email = ?) AND id != ? AND deleted_at IS NULL`,
    [personalEmail, personalEmail, userId]
  );
  if (dup) throw Object.assign(new Error('That email is already in use.'), { status: 409 });

  const user = await findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  await db.query(
    `UPDATE users SET personal_email = ?, personal_email_verified_at = NULL WHERE id = ?`,
    [personalEmail, userId]
  );

  await issueOtp(userId, personalEmail, `${user.first_name} ${user.last_name}`);
}

async function resendPersonalEmailOtp(userId) {
  const user = await findUserById(userId);
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });
  if (!user.personal_email) throw Object.assign(new Error('No personal email on file yet.'), { status: 400 });
  if (user.personal_email_verified_at) throw Object.assign(new Error('Personal email is already verified.'), { status: 400 });

  await issueOtp(userId, user.personal_email, `${user.first_name} ${user.last_name}`);
}

async function verifyPersonalEmailOtp(userId, code) {
  const [rows] = await db.query(
    `SELECT * FROM email_otps
     WHERE user_id = ? AND purpose = 'personal_email_verify' AND used = 0 AND expires_at > UTC_TIMESTAMP()
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const otp = rows[0];
  if (!otp) throw Object.assign(new Error('No active code found. Request a new one.'), { status: 400 });
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw Object.assign(new Error('Too many incorrect attempts. Request a new code.'), { status: 429 });
  }

  const match = await bcrypt.compare(code, otp.otp_hash);
  if (!match) {
    await db.query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', [otp.id]);
    throw Object.assign(new Error('Incorrect code.'), { status: 400 });
  }

  await db.query('UPDATE email_otps SET used = 1 WHERE id = ?', [otp.id]);
  await db.query('UPDATE users SET personal_email_verified_at = NOW() WHERE id = ?', [userId]);
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

module.exports = {
  register, login, refresh, logout, forgotPassword, changePassword, updateProfile, findUserById,
  bindPersonalEmail, resendPersonalEmailOtp, verifyPersonalEmailOtp,
};
