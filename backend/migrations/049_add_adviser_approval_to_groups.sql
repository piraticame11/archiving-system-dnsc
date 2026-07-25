-- Adviser must accept the assignment before it's official. Existing
-- assignments are grandfathered in as approved so nobody loses their adviser.
SET @s1 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_groups' AND COLUMN_NAME = 'adviser_status') > 0,
  'SELECT 1',
  "ALTER TABLE thesis_groups ADD COLUMN adviser_status ENUM('pending','approved','rejected') NULL AFTER adviser_id"
);
PREPARE _s1 FROM @s1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

SET @s2 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_groups' AND COLUMN_NAME = 'adviser_status_reason') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_groups ADD COLUMN adviser_status_reason VARCHAR(255) NULL AFTER adviser_status'
);
PREPARE _s2 FROM @s2; EXECUTE _s2; DEALLOCATE PREPARE _s2;

SET @s3 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_groups' AND COLUMN_NAME = 'adviser_responded_at') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_groups ADD COLUMN adviser_responded_at DATETIME NULL AFTER adviser_status_reason'
);
PREPARE _s3 FROM @s3; EXECUTE _s3; DEALLOCATE PREPARE _s3;

UPDATE thesis_groups
   SET adviser_status = 'approved', adviser_responded_at = created_at
 WHERE adviser_id IS NOT NULL AND adviser_status IS NULL AND deleted_at IS NULL;
