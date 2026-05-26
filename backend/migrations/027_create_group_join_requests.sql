CREATE TABLE IF NOT EXISTS group_join_requests (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  group_id     INT UNSIGNED  NOT NULL,
  student_id   INT UNSIGNED  NOT NULL,
  status       ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_active_request (group_id, student_id),
  CONSTRAINT fk_gjr_group   FOREIGN KEY (group_id)   REFERENCES thesis_groups(id),
  CONSTRAINT fk_gjr_student FOREIGN KEY (student_id) REFERENCES users(id)
);
