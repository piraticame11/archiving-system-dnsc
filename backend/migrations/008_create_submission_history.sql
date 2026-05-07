CREATE TABLE IF NOT EXISTS submission_history (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id INT UNSIGNED NOT NULL,
  changed_by    INT UNSIGNED NOT NULL,
  old_status    VARCHAR(50) NULL,
  new_status    VARCHAR(50) NOT NULL,
  remarks       TEXT NULL,
  changed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES thesis_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by)    REFERENCES users(id)
);
