-- Migration 067: Fix promoted archive documents, submissions, and groups for non-IT departments
-- Only BSIT is capstone; all other departments are thesis.

UPDATE archive a
JOIN departments d ON a.department_id = d.id
SET a.type = 'thesis'
WHERE d.code != 'BSIT' AND a.type = 'capstone';

UPDATE thesis_submissions ts
JOIN departments d ON ts.department_id = d.id
SET ts.type = 'thesis'
WHERE d.code != 'BSIT' AND ts.type = 'capstone';

UPDATE thesis_groups tg
JOIN departments d ON tg.department_id = d.id
SET tg.type = 'thesis'
WHERE d.code != 'BSIT' AND tg.type = 'capstone';
