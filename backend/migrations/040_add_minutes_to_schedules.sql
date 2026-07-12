-- A photo of the panel's written minutes is what the system's record of the
-- defense outcome is based on; store a reference to it on the schedule.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'minutes_photo') > 0,
  'SELECT 1',
  'ALTER TABLE defense_schedules ADD COLUMN minutes_photo VARCHAR(255) NULL AFTER notes'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'minutes_uploaded_at') > 0,
  'SELECT 1',
  'ALTER TABLE defense_schedules ADD COLUMN minutes_uploaded_at DATETIME NULL AFTER minutes_photo'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
