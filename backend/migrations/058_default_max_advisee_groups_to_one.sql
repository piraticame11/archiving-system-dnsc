-- New instructors previously defaulted to an uncapped advisee-group limit
-- (NULL). Default this to 1 instead, and backfill any existing instructor
-- rows that never set a limit.
ALTER TABLE users MODIFY COLUMN max_advisee_groups INT UNSIGNED NULL DEFAULT 1;

UPDATE users u
JOIN roles r ON u.role_id = r.id
SET u.max_advisee_groups = 1
WHERE r.name = 'instructor' AND u.max_advisee_groups IS NULL;
