CREATE TABLE IF NOT EXISTS submission_documents (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id INT UNSIGNED NOT NULL,
  uploaded_by   INT UNSIGNED NOT NULL,
  version       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  doc_type      ENUM('title_proposal','full_document','imrad','presentation','other') NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(512) NOT NULL,
  file_size     INT UNSIGNED NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  is_current    TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES thesis_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by)   REFERENCES users(id),
  INDEX idx_submission_ver (submission_id, version)
);
