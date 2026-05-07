CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  defense_type ENUM('proposal','final') NOT NULL,
  name         VARCHAR(200) NOT NULL,
  description  TEXT NULL,
  max_score    DECIMAL(6,2) NOT NULL DEFAULT 10.00,
  weight       DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  sort_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO evaluation_criteria (defense_type, name, description, max_score, weight, sort_order) VALUES
  ('proposal', 'Significance of the Study',    'Relevance and impact of the research topic', 10.00, 1.00, 1),
  ('proposal', 'Clarity of Problem Statement', 'How clearly the problem is defined',          10.00, 1.00, 2),
  ('proposal', 'Review of Related Literature', 'Quality and relevance of literature review',  10.00, 1.00, 3),
  ('proposal', 'Research Methodology',         'Appropriateness of research design',           10.00, 1.00, 4),
  ('proposal', 'Presentation and Defense',     'Clarity of presentation and answers',          10.00, 1.00, 5),
  ('final',    'Completeness of the Study',    'All chapters fully developed',                10.00, 1.00, 1),
  ('final',    'Findings and Analysis',        'Quality of data analysis and interpretation',  10.00, 1.00, 2),
  ('final',    'Conclusions and Recommendations', 'Validity of conclusions',                  10.00, 1.00, 3),
  ('final',    'Documentation Quality',        'Formatting, grammar, citations',               10.00, 1.00, 4),
  ('final',    'Oral Defense',                 'Confidence and clarity in defense',            10.00, 1.00, 5);
