-- Optional middle initial, mainly populated via the student import template.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'middle_initial') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN middle_initial VARCHAR(5) NULL AFTER last_name'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
