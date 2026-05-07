CREATE TABLE IF NOT EXISTS notifications (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  type           VARCHAR(80) NOT NULL,
  title          VARCHAR(255) NOT NULL,
  body           TEXT NULL,
  is_read        TINYINT(1) NOT NULL DEFAULT 0,
  reference_type VARCHAR(50) NULL,
  reference_id   INT UNSIGNED NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_read (user_id, is_read)
);
