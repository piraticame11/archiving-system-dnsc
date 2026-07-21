-- Panelists record an overall decision alongside their score. The chairperson's
-- decision is treated as the official outcome shown to the instructor/student
-- (scores stay panel-only; students only ever see the decision + comments).
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'decision') > 0,
  'SELECT 1',
  "ALTER TABLE evaluations ADD COLUMN decision ENUM('approved','major_revisions','minor_revisions') NULL AFTER score"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
