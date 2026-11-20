-- Create compatibility view thesis_group_members
-- Allows any legacy query referring to thesis_group_members to work seamlessly with group_members and thesis_groups.

CREATE OR REPLACE VIEW thesis_group_members AS
SELECT
  gm.id,
  gm.group_id,
  gm.student_id AS user_id,
  COALESCE(CONCAT(u.first_name, ' ', u.last_name), gm.name) AS member_name,
  CASE WHEN gm.student_id = tg.leader_id THEN 'leader' ELSE 'member' END AS role,
  gm.joined_at
FROM group_members gm
JOIN thesis_groups tg ON gm.group_id = tg.id
LEFT JOIN users u ON gm.student_id = u.id;
