-- Real lookup table for school years, replacing free-text validation.
CREATE TABLE IF NOT EXISTS school_years (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label      VARCHAR(9) NOT NULL UNIQUE,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO school_years (label)
SELECT DISTINCT school_year FROM thesis_groups WHERE school_year IS NOT NULL AND deleted_at IS NULL;

INSERT IGNORE INTO school_years (label)
SELECT DISTINCT school_year FROM thesis_submissions WHERE school_year IS NOT NULL AND deleted_at IS NULL;

INSERT IGNORE INTO school_years (label)
SELECT value FROM system_settings WHERE key_name = 'school_year' AND value IS NOT NULL;
