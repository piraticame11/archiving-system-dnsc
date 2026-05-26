ALTER TABLE thesis_submissions
  ADD COLUMN group_id INT UNSIGNED NULL AFTER student_id,
  ADD CONSTRAINT fk_ts_group FOREIGN KEY (group_id) REFERENCES thesis_groups(id);
