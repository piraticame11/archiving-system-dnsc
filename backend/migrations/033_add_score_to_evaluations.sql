-- Add score column to evaluations if it was created without it (idempotent)
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'score') > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD COLUMN score DECIMAL(5,2) NULL AFTER submission_id'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Add remarks column if missing (same situation)
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'remarks') > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD COLUMN remarks TEXT NULL AFTER score'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Add submitted_at column if missing
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'submitted_at') > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD COLUMN submitted_at DATETIME NULL AFTER status'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
