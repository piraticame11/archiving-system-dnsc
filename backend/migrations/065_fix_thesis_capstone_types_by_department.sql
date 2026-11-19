-- Migration 065: Align thesis vs capstone type based on department code.
-- Only BSIT is capstone; all other departments are thesis.
UPDATE thesis_groups tg
JOIN departments d ON tg.department_id = d.id
SET tg.type = IF(d.code = 'BSIT', 'capstone', 'thesis');

UPDATE thesis_submissions ts
JOIN departments d ON ts.department_id = d.id
SET ts.type = IF(d.code = 'BSIT', 'capstone', 'thesis');

UPDATE archive a
JOIN departments d ON a.department_id = d.id
SET a.type = IF(d.code = 'BSIT', 'capstone', 'thesis');
