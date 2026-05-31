-- Add scheduled_date (idempotent)
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'scheduled_date') > 0,
  'SELECT 1',
  'ALTER TABLE defense_schedules ADD COLUMN scheduled_date DATE NULL AFTER venue_id'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Add time_slot ENUM (idempotent)
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'time_slot') > 0,
  'SELECT 1',
  "ALTER TABLE defense_schedules ADD COLUMN time_slot ENUM('8:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00') NULL AFTER scheduled_date"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Backfill from scheduled_at where both new columns are null
UPDATE defense_schedules
SET
  scheduled_date = COALESCE(scheduled_date, DATE(scheduled_at)),
  time_slot = COALESCE(time_slot, CASE
    WHEN HOUR(scheduled_at) < 10 THEN '8:00-10:00'
    WHEN HOUR(scheduled_at) < 12 THEN '10:00-12:00'
    WHEN HOUR(scheduled_at) < 15 THEN '13:00-15:00'
    ELSE '15:00-17:00'
  END)
WHERE scheduled_at IS NOT NULL AND (scheduled_date IS NULL OR time_slot IS NULL);

-- Default any remaining NULLs
UPDATE defense_schedules
SET scheduled_date = CURDATE(), time_slot = '8:00-10:00'
WHERE scheduled_date IS NULL OR time_slot IS NULL;

-- Make NOT NULL (safe to re-run; MODIFY COLUMN is idempotent)
ALTER TABLE defense_schedules
  MODIFY COLUMN scheduled_date DATE NOT NULL,
  MODIFY COLUMN time_slot ENUM('8:00-10:00','10:00-12:00','13:00-15:00','15:00-17:00') NOT NULL;

-- Unique constraint (idempotent)
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND INDEX_NAME = 'uidx_venue_date_slot') > 0,
  'SELECT 1',
  'ALTER TABLE defense_schedules ADD UNIQUE INDEX uidx_venue_date_slot (venue_id, scheduled_date, time_slot)'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Drop idx_scheduled if it exists
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND INDEX_NAME = 'idx_scheduled') > 0,
  'DROP INDEX idx_scheduled ON defense_schedules',
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Drop scheduled_at if it exists
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'scheduled_at') > 0,
  'ALTER TABLE defense_schedules DROP COLUMN scheduled_at',
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Drop duration_minutes if it exists
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'duration_minutes') > 0,
  'ALTER TABLE defense_schedules DROP COLUMN duration_minutes',
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
