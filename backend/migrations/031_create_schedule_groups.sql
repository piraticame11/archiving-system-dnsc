-- Links presenting groups to a defense schedule.
-- A single schedule slot can have multiple groups presenting.
CREATE TABLE IF NOT EXISTS schedule_groups (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_id INT UNSIGNED NOT NULL,
  group_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_group (schedule_id, group_id),
  CONSTRAINT fk_sg_schedule FOREIGN KEY (schedule_id) REFERENCES defense_schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_sg_group    FOREIGN KEY (group_id)    REFERENCES thesis_groups(id)
);
