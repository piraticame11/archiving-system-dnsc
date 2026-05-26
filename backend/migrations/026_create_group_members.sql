CREATE TABLE IF NOT EXISTS group_members (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  group_id   INT UNSIGNED  NOT NULL,
  student_id INT UNSIGNED  NOT NULL,
  joined_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_group_student (group_id, student_id),
  CONSTRAINT fk_gm_group   FOREIGN KEY (group_id)   REFERENCES thesis_groups(id),
  CONSTRAINT fk_gm_student FOREIGN KEY (student_id) REFERENCES users(id)
);
