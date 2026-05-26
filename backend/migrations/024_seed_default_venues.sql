INSERT INTO venues (name, is_active)
SELECT 'Research Lounge', 1
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Research Lounge');

INSERT INTO venues (name, is_active)
SELECT 'Conference Lounge', 1
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Conference Lounge');
