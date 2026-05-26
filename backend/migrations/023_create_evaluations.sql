CREATE TABLE IF NOT EXISTS evaluations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id   INT UNSIGNED NOT NULL,
  panelist_id   INT UNSIGNED NOT NULL,
  submission_id INT UNSIGNED NOT NULL,
  score         DECIMAL(5,2) NULL,
  remarks       TEXT NULL,
  status        ENUM('pending','submitted') NOT NULL DEFAULT 'pending',
  submitted_at  DATETIME NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id)   REFERENCES defense_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (panelist_id)   REFERENCES users(id),
  FOREIGN KEY (submission_id) REFERENCES thesis_submissions(id),
  UNIQUE KEY uq_eval (schedule_id, panelist_id)
);
