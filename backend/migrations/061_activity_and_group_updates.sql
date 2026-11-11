-- Migration 061: Add activities, group updates (set_name, instructor_id, non-account members), and elaborated defense types

SET @s1 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_groups' AND COLUMN_NAME = 'set_name') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_groups ADD COLUMN set_name VARCHAR(50) NULL AFTER department_id'
);
PREPARE _s1 FROM @s1; EXECUTE _s1; DEALLOCATE PREPARE _s1;

SET @s2 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thesis_groups' AND COLUMN_NAME = 'instructor_id') > 0,
  'SELECT 1',
  'ALTER TABLE thesis_groups ADD COLUMN instructor_id INT UNSIGNED NULL AFTER adviser_id'
);
PREPARE _s2 FROM @s2; EXECUTE _s2; DEALLOCATE PREPARE _s2;

SET @s3 = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_members' AND COLUMN_NAME = 'name') > 0,
  'SELECT 1',
  'ALTER TABLE group_members ADD COLUMN name VARCHAR(255) NULL AFTER student_id'
);
PREPARE _s3 FROM @s3; EXECUTE _s3; DEALLOCATE PREPARE _s3;

ALTER TABLE group_members MODIFY COLUMN student_id INT UNSIGNED NULL;

ALTER TABLE defense_schedules MODIFY COLUMN defense_type ENUM('proposal', 'outline', 'pre-final', 'final') NOT NULL DEFAULT 'proposal';

ALTER TABLE evaluation_criteria MODIFY COLUMN defense_type ENUM('proposal', 'outline', 'pre-final', 'final') NOT NULL DEFAULT 'proposal';

CREATE TABLE IF NOT EXISTS activities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NULL,
  set_name VARCHAR(50) NULL,
  group_id INT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  deadline DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_act_instructor FOREIGN KEY (instructor_id) REFERENCES users(id),
  CONSTRAINT fk_act_dept FOREIGN KEY (department_id) REFERENCES departments(id),
  CONSTRAINT fk_act_group FOREIGN KEY (group_id) REFERENCES thesis_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  activity_id INT UNSIGNED NOT NULL,
  group_id INT UNSIGNED NOT NULL,
  submitted_by INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_size INT UNSIGNED NULL,
  mime_type VARCHAR(100) NULL,
  comments TEXT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_as_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_group FOREIGN KEY (group_id) REFERENCES thesis_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_user FOREIGN KEY (submitted_by) REFERENCES users(id)
);

