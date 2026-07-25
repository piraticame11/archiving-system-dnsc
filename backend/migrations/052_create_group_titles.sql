-- Up to 3 candidate titles per group. No approval workflow — these go
-- straight to the panel once the group is scheduled for defense.
CREATE TABLE IF NOT EXISTS group_titles (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id      INT UNSIGNED NOT NULL,
  title         VARCHAR(500) NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES thesis_groups(id) ON DELETE CASCADE,
  UNIQUE KEY uq_group_order (group_id, display_order)
);

INSERT IGNORE INTO group_titles (group_id, title, display_order)
SELECT id, title, 1 FROM thesis_groups WHERE title IS NOT NULL AND deleted_at IS NULL;
