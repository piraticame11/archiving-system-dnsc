-- Proposal defenses run 30 minutes; outline-to-final defenses run 1h30.
-- This column drives which timeslot vocabulary a schedule must use.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'defense_schedules' AND COLUMN_NAME = 'defense_type') > 0,
  'SELECT 1',
  "ALTER TABLE defense_schedules ADD COLUMN defense_type ENUM('proposal','final') NOT NULL DEFAULT 'proposal' AFTER venue_id"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
