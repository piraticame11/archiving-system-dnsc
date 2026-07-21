-- Distinguishes industry panelists from regular (internal) panelists so the
-- auto-scheduler can pick a composition-valid panel (1 industry panelist required).
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'panelist_type') > 0,
  'SELECT 1',
  "ALTER TABLE users ADD COLUMN panelist_type ENUM('regular','industry') NOT NULL DEFAULT 'regular' AFTER role_id"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
