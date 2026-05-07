CREATE TABLE IF NOT EXISTS scores (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  evaluation_id INT UNSIGNED NOT NULL,
  criteria_id   INT UNSIGNED NOT NULL,
  raw_score     DECIMAL(6,2) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  FOREIGN KEY (criteria_id)   REFERENCES evaluation_criteria(id),
  UNIQUE KEY uq_score (evaluation_id, criteria_id)
);
