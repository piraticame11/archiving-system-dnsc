-- Records whether a panel was placed at full size (4) or reduced (3) when
-- department capacity couldn't fill a full panel. Defaults 4 for existing rows.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'panel_size') > 0,
  'SELECT 1',
  'ALTER TABLE defense_schedules ADD COLUMN panel_size TINYINT UNSIGNED NOT NULL DEFAULT 4 AFTER defense_type'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
