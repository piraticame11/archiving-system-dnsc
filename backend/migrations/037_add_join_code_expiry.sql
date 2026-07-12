SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_groups' AND COLUMN_NAME = 'join_code_expires_at') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_groups ADD COLUMN join_code_expires_at DATETIME NULL AFTER join_code'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Give existing groups a fresh 7-day window so current codes don't die instantly on deploy
UPDATE thesis_groups SET join_code_expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY)
WHERE join_code_expires_at IS NULL AND deleted_at IS NULL;
