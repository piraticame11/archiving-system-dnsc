CREATE TABLE IF NOT EXISTS defense_schedules (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id INT UNSIGNED NOT NULL,
  venue_id      INT UNSIGNED NULL,
  defense_type  ENUM('proposal','final') NOT NULL DEFAULT 'proposal',
  scheduled_at  DATETIME NOT NULL,
  duration_min  SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  status        ENUM('scheduled','completed','cancelled','rescheduled') NOT NULL DEFAULT 'scheduled',
  notes         TEXT NULL,
  created_by    INT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES thesis_submissions(id),
  FOREIGN KEY (venue_id)      REFERENCES venues(id),
  FOREIGN KEY (created_by)    REFERENCES users(id),
  INDEX idx_scheduled_at (scheduled_at),
  INDEX idx_venue_time   (venue_id, scheduled_at)
);
