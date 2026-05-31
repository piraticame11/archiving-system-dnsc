-- Drop unique venue+date+slot constraint if it exists
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND INDEX_NAME = 'uidx_venue_date_slot') > 0,
  'ALTER TABLE defense_schedules DROP INDEX uidx_venue_date_slot',
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Make submission_id nullable (MODIFY COLUMN is idempotent)
ALTER TABLE defense_schedules
  MODIFY COLUMN submission_id INT UNSIGNED NULL;

-- Add time_slots TEXT column if not exists
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'time_slots') > 0,
  'SELECT 1',
  "ALTER TABLE defense_schedules ADD COLUMN time_slots TEXT NOT NULL DEFAULT '[]' AFTER scheduled_date"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Backfill time_slots from time_slot ENUM if time_slot column still exists
SET @hasSrc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'time_slot');

SET @s = IF(@hasSrc > 0,
  "UPDATE defense_schedules SET time_slots = CONCAT('[\"', time_slot, '\"]') WHERE time_slot IS NOT NULL AND (time_slots = '[]' OR time_slots IS NULL)",
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Drop old time_slot ENUM column if it still exists
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'time_slot') > 0,
  'ALTER TABLE defense_schedules DROP COLUMN time_slot',
  'SELECT 1'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
