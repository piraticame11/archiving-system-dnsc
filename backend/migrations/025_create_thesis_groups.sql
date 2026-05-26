CREATE TABLE IF NOT EXISTS thesis_groups (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name          VARCHAR(255)  NOT NULL,
  join_code     CHAR(6)       NOT NULL,
  leader_id     INT UNSIGNED  NOT NULL,
  adviser_id    INT UNSIGNED  NULL,
  department_id INT UNSIGNED  NOT NULL,
  title         VARCHAR(500)  NULL,
  school_year   VARCHAR(9)    NOT NULL,
  max_members   INT           NOT NULL DEFAULT 5,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_join_code (join_code),
  CONSTRAINT fk_tg_leader     FOREIGN KEY (leader_id)     REFERENCES users(id),
  CONSTRAINT fk_tg_adviser    FOREIGN KEY (adviser_id)    REFERENCES users(id),
  CONSTRAINT fk_tg_department FOREIGN KEY (department_id) REFERENCES departments(id)
);
