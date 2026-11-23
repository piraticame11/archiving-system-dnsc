-- Migration 068: Add chapters to submission_documents doc_type enum and migrate ch1_2 data
ALTER TABLE submission_documents
  MODIFY COLUMN doc_type ENUM('title_proposal','chapters','ch1_2','full_document','imrad','presentation','other') NOT NULL;

UPDATE submission_documents
  SET doc_type = 'chapters'
  WHERE doc_type = 'ch1_2';
