CREATE TABLE IF NOT EXISTS departments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(20) NOT NULL UNIQUE,
  name       VARCHAR(150) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO departments (code, name) VALUES
  ('BSIT',  'Bachelor of Science in Information Technology'),
  ('BSCS',  'Bachelor of Science in Computer Science'),
  ('BSIS',  'Bachelor of Science in Information Systems'),
  ('BSED',  'Bachelor of Secondary Education'),
  ('BSBA',  'Bachelor of Science in Business Administration');
