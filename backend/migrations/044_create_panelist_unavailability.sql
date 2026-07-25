-- Dates a panelist is unavailable to be assigned to a defense schedule.
CREATE TABLE IF NOT EXISTS panelist_unavailability (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  panelist_id  INT UNSIGNED NOT NULL,
  date         DATE NOT NULL,
  reason       VARCHAR(255) NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (panelist_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_panelist_date (panelist_id, date)
);
