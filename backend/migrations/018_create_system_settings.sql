CREATE TABLE IF NOT EXISTS system_settings (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name    VARCHAR(100) NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description VARCHAR(255) NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO system_settings (key_name, value, description) VALUES
  ('pass_score_threshold', '75',    'Minimum weighted score % to pass a defense'),
  ('max_file_size_mb',     '50',    'Maximum upload file size in MB'),
  ('allowed_file_types',   'pdf,docx', 'Comma-separated allowed file extensions'),
  ('maintenance_mode',     'false', 'Put system in read-only maintenance mode'),
  ('school_year',          '2025-2026', 'Current school year'),
  ('current_semester',     '1st',   'Current semester');
