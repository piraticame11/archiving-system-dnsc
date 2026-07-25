-- Personal email students bind + OTP-verify on first login. Used as an
-- alternate forgot-password identifier alongside the school email.
SET @s1 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'personal_email') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN personal_email VARCHAR(150) NULL AFTER email'
);
PREPARE _s1 FROM @s1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

SET @s2 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'personal_email_verified_at') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN personal_email_verified_at DATETIME NULL AFTER personal_email'
);
PREPARE _s2 FROM @s2; EXECUTE _s2; DEALLOCATE PREPARE _s2;

SET @s3 = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_personal_email') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD UNIQUE INDEX uq_personal_email (personal_email)'
);
PREPARE _s3 FROM @s3; EXECUTE _s3; DEALLOCATE PREPARE _s3;
