CREATE TABLE IF NOT EXISTS schedule_panelists (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  FOREIGN KEY (schedule_id) REFERENCES defense_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id),
  UNIQUE KEY uq_schedule_panelist (schedule_id, user_id)
);
