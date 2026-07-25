-- Persists each rubric's computed weighted total (0-100) alongside the
-- panelist's explicit decision, so the rubric breakdown survives independent
-- of the scores table (and is cheap to read back on the evaluations list).
SET @s1 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'research_output_score') > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD COLUMN research_output_score DECIMAL(5,2) NULL AFTER score'
);
PREPARE _s1 FROM @s1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

SET @s2 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluations' AND COLUMN_NAME = 'oral_presentation_score') > 0,
  'SELECT 1',
  'ALTER TABLE evaluations ADD COLUMN oral_presentation_score DECIMAL(5,2) NULL AFTER research_output_score'
);
PREPARE _s2 FROM @s2; EXECUTE _s2; DEALLOCATE PREPARE _s2;
