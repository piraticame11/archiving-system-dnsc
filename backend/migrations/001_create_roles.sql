CREATE TABLE IF NOT EXISTS roles (
  id    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL
);

INSERT IGNORE INTO roles (name, label) VALUES
  ('student',    'Student'),
  ('instructor', 'Instructor / Adviser'),
  ('admin',      'Research Office Admin'),
  ('panelist',   'Panelist'),
  ('superadmin', 'Super Administrator');
