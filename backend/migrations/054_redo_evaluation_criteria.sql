-- The old evaluation_criteria/scores tables were never wired up to any code
-- (dead schema, duplicated seed rows from repeated runs). Replacing the
-- criteria set with the two rubrics from the panelist's physical evaluation
-- sheet (ORAL-EVAL): Research Output and Oral Presentation, each weighted to
-- 100%. max_score is set equal to each criterion's weight, so a panelist's
-- raw scores for a rubric sum directly to that rubric's 0-100 total.
SET @s = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluation_criteria' AND COLUMN_NAME = 'rubric_group') > 0,
  'SELECT 1',
  "ALTER TABLE evaluation_criteria ADD COLUMN rubric_group ENUM('research_output','oral_presentation') NOT NULL DEFAULT 'oral_presentation' AFTER defense_type"
);
PREPARE _s FROM @s; EXECUTE _s; DEALLOCATE PREPARE _s;

DELETE FROM scores;
DELETE FROM evaluation_criteria;

INSERT INTO evaluation_criteria (defense_type, rubric_group, name, description, max_score, weight, sort_order, is_active) VALUES
  ('proposal', 'research_output', 'Professional Appearance',
   'The output conveys an appealing format, expresses well written prose with a logical progression of thoughts, and displays excellent editing.', 45, 45, 1, 1),
  ('proposal', 'research_output', 'Organization',
   'The output has an organized structure consistently following the standard format.', 15, 15, 2, 1),
  ('proposal', 'research_output', 'Originality',
   'At least 95% of the contents are the researcher''s original work.', 15, 15, 3, 1),
  ('proposal', 'research_output', 'Depth of Coverage',
   'The output demonstrates mastery of all chapter outcomes in a balanced manner.', 15, 15, 4, 1),
  ('proposal', 'research_output', 'Printing Excellence',
   'The output has the highest level of printing quality.', 10, 10, 5, 1),

  ('proposal', 'oral_presentation', 'Content Mastery',
   'The presenter discussed his/her research with enough information, provides supporting details and cites relevant facts with accuracy.', 30, 30, 1, 1),
  ('proposal', 'oral_presentation', 'Organization and Delivery',
   'The presenter established rapport, eye contact with the panel and displays most appropriate gestures and expressions to convey ideas. They are knowledgeable of the content, which is focused, logical, and well-organized.', 25, 25, 2, 1),
  ('proposal', 'oral_presentation', 'Correctness and Manner of Answering Questions',
   'The presenter answered all questions about their research study with correctness and mastery. They can explain their topic thoroughly.', 25, 25, 3, 1),
  ('proposal', 'oral_presentation', 'Professional Appearance/Grooming',
   'The presenter wears formal attire and appears professional, well-groomed, and decent.', 10, 10, 4, 1),
  ('proposal', 'oral_presentation', 'Presentation',
   'The presentation shows considerable originality and substance. All graphics and fonts are appropriate and effective. Communication of facts is organized in a comprehensive and logical way.', 10, 10, 5, 1);
