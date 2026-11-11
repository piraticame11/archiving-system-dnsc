const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../config/database');
const jwtConfig = require('../../config/jwt');
const { sendMail, otpHtml, tempPasswordHtml, studentRegistrationOtpHtml } = require('../../config/mailer');

const OTP_VALIDITY_MS  = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const TEMP_PASSWORD_VALIDITY_MINUTES = 30;
const STUDENT_REG_OTP_EXPIRY_MS = 5 * 60 * 1000;   // 5 minutes
const STUDENT_REG_OTP_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

let hasRevokedAtColumnCache = null;
let ensureRevokedAtPromise = null;

/**
 * Ensure `refresh_tokens.revoked_at` exists for older schemas; falls back to
 * non-revoked_at queries when DDL permissions are unavailable.
 */
async function ensureRevokedAtColumn() {
  if (hasRevokedAtColumnCache !== null) return hasRevokedAtColumnCache;
  if (ensureRevokedAtPromise) return ensureRevokedAtPromise;

  ensureRevokedAtPromise = (async () => {
    try {
      const [cols] = await db.query(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'revoked_at'
         LIMIT 1`
      );
      if (cols.length > 0) {
        hasRevokedAtColumnCache = true;
        return true;
      }
      await db.query(`ALTER TABLE refresh_tokens ADD COLUMN revoked_at DATETIME NULL AFTER revoked`);
      hasRevokedAtColumnCache = true;
      return true;
    } catch {
      hasRevokedAtColumnCache = false;
      return false;
    } finally {
      ensureRevokedAtPromise = null;
    }
  })();

  return ensureRevokedAtPromise;
}

async function queryRefreshTokens(userId, withRevokedAt) {
  const revokedPredicate = withRevokedAt
    ? '(revoked = 0 OR (revoked = 1 AND revoked_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND)))'
    : 'revoked = 0';
  const [rows] = await db.query(
    `SELECT * FROM refresh_tokens
     WHERE user_id = ?
       AND ${revokedPredicate}
       AND expires_at > UTC_TIMESTAMP()`,
    [userId]
  );
  return rows;
}

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
  const user = rows[0] || null;
  if (user && user.role === 'student' && user.is_email_verified && !user.personal_email_verified_at) {
    await db.query(
      `UPDATE users SET personal_email = COALESCE(personal_email, email), personal_email_verified_at = NOW() WHERE id = ?`,
      [user.id]
    );
    user.personal_email = user.personal_email || user.email;
    user.personal_email_verified_at = new Date();
  }
  return user;
}

function signAccessToken(user) {
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      department_id: user.department_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: fullName,
    },
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

  if (user.role === 'student' && user.is_email_verified && !user.personal_email_verified_at) {
    await db.query(
      `UPDATE users SET personal_email = COALESCE(personal_email, email), personal_email_verified_at = NOW() WHERE id = ?`,
      [user.id]
    );
    user.personal_email = user.personal_email || user.email;
    user.personal_email_verified_at = new Date();
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

  let hasRevokedAt = await ensureRevokedAtColumn();
  let tokenRows;
  try {
    tokenRows = await queryRefreshTokens(payload.id, hasRevokedAt);
  } catch (err) {
    if (hasRevokedAt && /revoked_at/i.test(err.message || '')) {
      hasRevokedAt = false;
      hasRevokedAtColumnCache = false;
      tokenRows = await queryRefreshTokens(payload.id, false);
    } else {
      throw err;
    }
  }

  let matched = null;
  for (const row of tokenRows) {
    if (await bcrypt.compare(token, row.token_hash)) { matched = row; break; }
  }
  if (!matched) throw Object.assign(new Error('Refresh token not found or expired.'), { status: 401 });

  if (!matched.revoked) {
    const updateSql = hasRevokedAt
      ? `UPDATE refresh_tokens SET revoked = 1, revoked_at = UTC_TIMESTAMP() WHERE id = ?`
      : `UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`;
    await db.query(updateSql, [matched.id]);
  }

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

  const targetEmail = (user.personal_email && identifier.toLowerCase() === user.personal_email.toLowerCase())
    ? user.personal_email
    : user.email;

  await sendMail({
    to:      targetEmail,
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


async function initiateStudentRegistration({ first_name, last_name, email, password, department_id, student_number }) {
  const normEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normEmail);
  if (existingUser) {
    throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
  }

  const [rows] = await db.query(
    'SELECT * FROM student_registration_otps WHERE email = ? LIMIT 1',
    [normEmail]
  );
  const pending = rows[0];

  if (pending && pending.last_sent_at) {
    const elapsed = Date.now() - new Date(pending.last_sent_at).getTime();
    if (elapsed < STUDENT_REG_OTP_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((STUDENT_REG_OTP_COOLDOWN_MS - elapsed) / 1000);
      throw Object.assign(
        new Error(`Please wait ${remainingSeconds}s before requesting a new code.`),
        { status: 429, retryAfter: remainingSeconds }
      );
    }
  }

  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, 10);
  const passwordHash = await bcrypt.hash(password, 12);
  const expiresAt = new Date(Date.now() + STUDENT_REG_OTP_EXPIRY_MS);
  const lastSentAt = new Date();

  if (pending) {
    await db.query(
      `UPDATE student_registration_otps
       SET first_name = ?, last_name = ?, student_number = ?, department_id = ?,
           password_hash = ?, otp_hash = ?, expires_at = ?, last_sent_at = ?, attempts = 0
       WHERE email = ?`,
      [
        first_name.trim(),
        last_name.trim(),
        student_number ? student_number.trim() : null,
        department_id ? Number(department_id) : null,
        passwordHash,
        otpHash,
        expiresAt,
        lastSentAt,
        normEmail,
      ]
    );
  } else {
    await db.query(
      `INSERT INTO student_registration_otps
       (email, first_name, last_name, student_number, department_id, password_hash, otp_hash, expires_at, last_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normEmail,
        first_name.trim(),
        last_name.trim(),
        student_number ? student_number.trim() : null,
        department_id ? Number(department_id) : null,
        passwordHash,
        otpHash,
        expiresAt,
        lastSentAt,
      ]
    );
  }

  await sendMail({
    to: normEmail,
    subject: 'Your Verification Code — ACES Research System',
    html: studentRegistrationOtpHtml(`${first_name} ${last_name}`, code, 5),
  });

  return {
    email: normEmail,
    expiresInSeconds: 300,
    cooldownSeconds: 120,
  };
}

async function resendStudentRegistrationOtp(email) {
  const normEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normEmail);
  if (existingUser) {
    throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
  }

  const [rows] = await db.query(
    'SELECT * FROM student_registration_otps WHERE email = ? LIMIT 1',
    [normEmail]
  );
  const pending = rows[0];
  if (!pending) {
    throw Object.assign(new Error('No pending registration found for this email. Please fill out the registration form.'), { status: 404 });
  }

  const elapsed = Date.now() - new Date(pending.last_sent_at).getTime();
  if (elapsed < STUDENT_REG_OTP_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((STUDENT_REG_OTP_COOLDOWN_MS - elapsed) / 1000);
    throw Object.assign(
      new Error(`Please wait ${remainingSeconds}s before requesting a new code.`),
      { status: 429, retryAfter: remainingSeconds }
    );
  }

  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + STUDENT_REG_OTP_EXPIRY_MS);
  const lastSentAt = new Date();

  await db.query(
    `UPDATE student_registration_otps
     SET otp_hash = ?, expires_at = ?, last_sent_at = ?, attempts = 0
     WHERE email = ?`,
    [otpHash, expiresAt, lastSentAt, normEmail]
  );

  await sendMail({
    to: normEmail,
    subject: 'Your New Verification Code — ACES Research System',
    html: studentRegistrationOtpHtml(`${pending.first_name} ${pending.last_name}`, code, 5),
  });

  return {
    email: normEmail,
    expiresInSeconds: 300,
    cooldownSeconds: 120,
  };
}

async function verifyStudentRegistrationOtp({ email, otp }) {
  const normEmail = email.toLowerCase().trim();
  const [rows] = await db.query(
    'SELECT * FROM student_registration_otps WHERE email = ? LIMIT 1',
    [normEmail]
  );
  const pending = rows[0];
  if (!pending) {
    throw Object.assign(new Error('No pending registration found for this email.'), { status: 404 });
  }

  if (new Date(pending.expires_at) < new Date()) {
    throw Object.assign(new Error('Verification code has expired. Please request a new code.'), { status: 400 });
  }

  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    throw Object.assign(new Error('Too many failed attempts. Please request a new code.'), { status: 429 });
  }

  const match = await bcrypt.compare(String(otp).trim(), pending.otp_hash);
  if (!match) {
    await db.query('UPDATE student_registration_otps SET attempts = attempts + 1 WHERE id = ?', [pending.id]);
    throw Object.assign(new Error('Incorrect verification code.'), { status: 400 });
  }

  const existingUser = await findUserByEmail(normEmail);
  if (existingUser) {
    await db.query('DELETE FROM student_registration_otps WHERE email = ?', [normEmail]);
    throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
  }

  const [roleRows] = await db.query("SELECT id FROM roles WHERE name = 'student' LIMIT 1");
  if (!roleRows.length) {
    throw Object.assign(new Error('Student role definition not found.'), { status: 500 });
  }
  const roleId = roleRows[0].id;

  const [insertRes] = await db.query(
    `INSERT INTO users (role_id, department_id, student_number, first_name, last_name, email, personal_email, personal_email_verified_at, password_hash, is_active, is_email_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1, 1)`,
    [
      roleId,
      pending.department_id || null,
      pending.student_number || null,
      pending.first_name,
      pending.last_name,
      pending.email,
      pending.email,
      pending.password_hash,
    ]
  );

  await db.query('DELETE FROM student_registration_otps WHERE email = ?', [normEmail]);

  const newUser = await findUserById(insertRes.insertId);
  const accessToken = signAccessToken(newUser);
  const refreshToken = signRefreshToken(newUser);
  await storeRefreshToken(newUser.id, refreshToken);

  const { password_hash, ...safeUser } = newUser;
  return { accessToken, refreshToken, user: safeUser };
}

module.exports = {
  register, login, refresh, logout, forgotPassword, changePassword, updateProfile, findUserById,
  bindPersonalEmail, resendPersonalEmailOtp, verifyPersonalEmailOtp,
  initiateStudentRegistration, resendStudentRegistrationOtp, verifyStudentRegistrationOtp,
};
