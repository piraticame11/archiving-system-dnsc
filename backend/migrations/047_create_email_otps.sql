-- OTPs for verifying a bound personal email (and reusable for future purposes).
CREATE TABLE IF NOT EXISTS email_otps (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  otp_hash   VARCHAR(255) NOT NULL,
  purpose    ENUM('personal_email_verify') NOT NULL DEFAULT 'personal_email_verify',
  expires_at DATETIME NOT NULL,
  used       TINYINT(1) NOT NULL DEFAULT 0,
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_purpose (user_id, purpose)
);
