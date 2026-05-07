CREATE TABLE IF NOT EXISTS schedule_panelists (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT UNSIGNED NOT NULL,
  panelist_id INT UNSIGNED NOT NULL,
  role_label  VARCHAR(80) NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES defense_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (panelist_id) REFERENCES users(id),
  UNIQUE KEY uq_schedule_panelist (schedule_id, panelist_id),
  INDEX idx_panelist (panelist_id)
);
