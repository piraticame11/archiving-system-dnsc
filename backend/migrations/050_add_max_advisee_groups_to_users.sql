-- Caps how many groups an instructor is willing to advise at once. NULL = uncapped.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'max_advisee_groups') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN max_advisee_groups INT UNSIGNED NULL AFTER adviser_id'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
