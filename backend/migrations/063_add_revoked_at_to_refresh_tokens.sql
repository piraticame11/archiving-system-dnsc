-- Idempotently ensure refresh_tokens.revoked_at exists (missed in 004_create_refresh_tokens.sql)
SET @s1 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'revoked_at') > 0,
  'SELECT 1',
  'ALTER TABLE refresh_tokens ADD COLUMN revoked_at DATETIME NULL AFTER revoked'
);
PREPARE _s1 FROM @s1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

