-- Add group_id to evaluations so a schedule with multiple groups can have
-- one evaluation per group per panelist instead of one per schedule.

-- Add group_id column (nullable; NULL means legacy submission-based schedule)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'group_id'
);
SET @s = IF(@col_exists > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD COLUMN group_id INT UNSIGNED NULL AFTER schedule_id'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Add FK to thesis_groups if not already there
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations'
    AND CONSTRAINT_NAME = 'fk_eval_group'
);
SET @s = IF(@fk_exists > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD CONSTRAINT fk_eval_group FOREIGN KEY (group_id) REFERENCES thesis_groups(id)'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Add a plain index on schedule_id first so the FK can still use it
-- after we drop uq_eval (MySQL requires an index on FK columns).
SET @plain_idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations'
    AND INDEX_NAME = 'idx_eval_schedule'
);
SET @s = IF(@plain_idx > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD INDEX idx_eval_schedule (schedule_id)'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Now drop the old unique key (schedule_id, panelist_id).
-- Per-group uniqueness is enforced at the application layer as
-- (schedule_id, panelist_id, group_id) using NULL-safe equality.
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND INDEX_NAME = 'uq_eval'
);
SET @s = IF(@idx_exists > 0,
  'ALTER TABLE evaluations DROP INDEX uq_eval',
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
