-- Make evaluations.submission_id nullable to support group-based schedules
-- that have no direct thesis_submission linked to the defense_schedule.
ALTER TABLE evaluations MODIFY COLUMN submission_id INT UNSIGNED NULL;
