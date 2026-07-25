-- Forgot-password now issues a short-lived temp password instead of a reset
-- link. must_change_password forces the user to settings.html on next login.
SET @s1 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'temp_password_expires_at') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN temp_password_expires_at DATETIME NULL'
);
PREPARE _s1 FROM @s1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

SET @s2 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'must_change_password') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE _s2 FROM @s2; EXECUTE _s2; DEALLOCATE PREPARE _s2;
