CREATE TABLE IF NOT EXISTS instructor_guidelines (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200)    NOT NULL,
  description  TEXT            NULL,
  category     VARCHAR(100)    NOT NULL DEFAULT 'General',
  file_name    VARCHAR(255)    NOT NULL,
  file_path    VARCHAR(500)    NOT NULL,
  file_size    INT UNSIGNED    NOT NULL,
  mime_type    VARCHAR(100)    NOT NULL,
  uploaded_by  INT UNSIGNED    NOT NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at   DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_uploaded_by (uploaded_by),
  KEY idx_deleted_at  (deleted_at),
  CONSTRAINT fk_ig_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
