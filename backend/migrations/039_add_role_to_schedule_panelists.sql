-- Every defense panel must have exactly 1 chairperson, 1 industry panelist, and 2 members.
-- Backfill any existing rows to 'member' before tightening the column to an ENUM.
UPDATE schedule_panelists
SET role_label = 'member'
WHERE role_label IS NULL OR role_label NOT IN ('chairperson', 'industry_panelist', 'member');

SET @s = IF(
  (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_panelists' AND COLUMN_NAME = 'role_label')
   = "enum('chairperson','industry_panelist','member')",
  'SELECT 1',
  "ALTER TABLE schedule_panelists MODIFY COLUMN role_label ENUM('chairperson','industry_panelist','member') NOT NULL DEFAULT 'member'"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
