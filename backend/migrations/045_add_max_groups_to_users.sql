-- Caps how many groups a panelist can be assigned to at once. NULL = uncapped.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'max_groups') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN max_groups INT UNSIGNED NULL AFTER panelist_type'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
