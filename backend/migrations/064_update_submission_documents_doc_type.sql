-- Migration 064: Add ch1_2 to submission_documents doc_type enum
ALTER TABLE submission_documents
  MODIFY COLUMN doc_type ENUM('title_proposal','ch1_2','full_document','imrad','presentation','other') NOT NULL;
