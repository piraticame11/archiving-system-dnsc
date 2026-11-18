CREATE TABLE IF NOT EXISTS departments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(20) NOT NULL UNIQUE,
  name       VARCHAR(150) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO departments (code, name) VALUES
  ('BSIT',  'Bachelor of Science in Information Technology'),
  ('BSHM',  'Bachelor of Science in Hospitality Management'),
  ('BSBA',  'Bachelor of Science in Business Administration'),
  ('BSAB',  'Bachelor of Science in Agriculture Business'),
  ('BS Crim',  'Bachelor of Science in Criminology');
