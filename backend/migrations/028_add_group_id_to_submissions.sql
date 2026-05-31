-- Add group_id to thesis_submissions (idempotent)
SET @addCol = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_submissions' AND COLUMN_NAME = 'group_id') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_submissions ADD COLUMN group_id INT UNSIGNED NULL AFTER student_id'
);
PREPARE _s FROM @addCol; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @addFk = IF(
  (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_submissions' AND CONSTRAINT_NAME = 'fk_ts_group') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_submissions ADD CONSTRAINT fk_ts_group FOREIGN KEY (group_id) REFERENCES thesis_groups(id)'
);
PREPARE _s FROM @addFk; EXECUTE _s; DEALLOCATE PREPARE _s;
