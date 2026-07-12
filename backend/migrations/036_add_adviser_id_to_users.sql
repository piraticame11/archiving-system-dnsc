-- Track which instructor created/handles a given student account
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'adviser_id') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN adviser_id INT UNSIGNED NULL AFTER department_id'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_adviser') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD CONSTRAINT fk_users_adviser FOREIGN KEY (adviser_id) REFERENCES users(id)'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_adviser') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD INDEX idx_adviser (adviser_id)'
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;
