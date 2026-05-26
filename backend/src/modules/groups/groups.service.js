const db = require('../../config/database');

function generateJoinCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function uniqueJoinCode() {
  let code;
  let attempts = 0;
  do {
    code = generateJoinCode();
    const [[row]] = await db.query(
      'SELECT id FROM thesis_groups WHERE join_code = ? AND deleted_at IS NULL', [code]
    );
    if (!row) return code;
    attempts++;
  } while (attempts < 10);
  throw new Error('Could not generate a unique join code. Please try again.');
}

/* ─── get my group (student) ──────────────────────────────────────── */
async function getMyGroup(studentId) {
  const [[membership]] = await db.query(
    `SELECT group_id FROM group_members WHERE student_id = ?`, [studentId]
  );
  if (!membership) return null;
  return getGroupById(membership.group_id);
}

/* ─── get group by id ─────────────────────────────────────────────── */
async function getGroupById(id) {
  const [[group]] = await db.query(
    `SELECT tg.id, tg.name, tg.join_code, tg.title, tg.school_year, tg.max_members,
            tg.leader_id, tg.adviser_id, tg.department_id, tg.created_at,
            CONCAT(l.first_name, ' ', l.last_name) AS leader_name,
            CONCAT(a.first_name, ' ', a.last_name) AS adviser_name,
            d.name AS department_name, d.code AS department_code
     FROM thesis_groups tg
     JOIN users l        ON tg.leader_id     = l.id
     LEFT JOIN users a   ON tg.adviser_id    = a.id
     JOIN departments d  ON tg.department_id = d.id
     WHERE tg.id = ? AND tg.deleted_at IS NULL`,
    [id]
  );
  if (!group) return null;

  const [members] = await db.query(
    `SELECT gm.student_id, gm.joined_at,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            u.student_number, u.email
     FROM group_members gm
     JOIN users u ON gm.student_id = u.id
     WHERE gm.group_id = ?
     ORDER BY gm.joined_at ASC`,
    [id]
  );
  group.members = members;
  group.member_count = members.length;
  return group;
}

/* ─── create group ────────────────────────────────────────────────── */
async function createGroup({ leader_id, name, adviser_id, title, school_year, max_members }) {
  /* leader must not already be in a group */
  const [[existing]] = await db.query(
    'SELECT group_id FROM group_members WHERE student_id = ?', [leader_id]
  );
  if (existing) throw Object.assign(
    new Error('You are already in a group. Leave your current group first.'), { statusCode: 409 }
  );

  /* get leader's department */
  const [[user]] = await db.query('SELECT department_id FROM users WHERE id = ?', [leader_id]);
  if (!user?.department_id) throw Object.assign(
    new Error('Your account does not have a department assigned.'), { statusCode: 400 }
  );

  /* validate adviser is an instructor */
  if (adviser_id) {
    const [[adv]] = await db.query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND r.name = 'instructor' AND u.is_active = 1 AND u.deleted_at IS NULL`,
      [adviser_id]
    );
    if (!adv) throw Object.assign(new Error('Adviser not found or is not an instructor.'), { statusCode: 404 });
  }

  const join_code = await uniqueJoinCode();
  const cap = Math.min(Math.max(parseInt(max_members) || 5, 2), 10);

  const [result] = await db.query(
    `INSERT INTO thesis_groups (name, join_code, leader_id, adviser_id, department_id, title, school_year, max_members)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, join_code, leader_id, adviser_id || null, user.department_id, title || null, school_year, cap]
  );
  const groupId = result.insertId;

  /* add leader as first member */
  await db.query('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)', [groupId, leader_id]);

  return getGroupById(groupId);
}

/* ─── update group info (leader only) ────────────────────────────── */
async function updateGroup(groupId, leaderId, { name, adviser_id, title, school_year, max_members }) {
  const group = await getGroupById(groupId);
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can update group info.'), { statusCode: 403 });

  if (adviser_id !== undefined && adviser_id !== null) {
    const [[adv]] = await db.query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND r.name = 'instructor' AND u.is_active = 1 AND u.deleted_at IS NULL`,
      [adviser_id]
    );
    if (!adv) throw Object.assign(new Error('Adviser not found or is not an instructor.'), { statusCode: 404 });
  }

  const fields = {};
  if (name        !== undefined) fields.name        = name;
  if (title       !== undefined) fields.title       = title || null;
  if (school_year !== undefined) fields.school_year = school_year;
  if (adviser_id  !== undefined) fields.adviser_id  = adviser_id || null;
  if (max_members !== undefined) fields.max_members = Math.min(Math.max(parseInt(max_members) || 5, 2), 10);

  if (!Object.keys(fields).length) return group;
  const set = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE thesis_groups SET ${set} WHERE id = ?`, [...Object.values(fields), groupId]);
  return getGroupById(groupId);
}

/* ─── request to join via code ────────────────────────────────────── */
async function requestJoin(studentId, joinCode) {
  const [[group]] = await db.query(
    'SELECT id, max_members, leader_id FROM thesis_groups WHERE join_code = ? AND deleted_at IS NULL',
    [joinCode]
  );
  if (!group) throw Object.assign(new Error('Invalid join code. No group found.'), { statusCode: 404 });

  /* check if student is already in THIS group */
  const [[alreadyMember]] = await db.query(
    'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
    [group.id, studentId]
  );
  if (alreadyMember) throw Object.assign(new Error('You are already a member of this group.'), { statusCode: 409 });

  /* check for existing pending request to this group */
  const [[existingReq]] = await db.query(
    `SELECT id, status FROM group_join_requests WHERE group_id = ? AND student_id = ?`,
    [group.id, studentId]
  );
  if (existingReq) {
    if (existingReq.status === 'pending') throw Object.assign(new Error('You already have a pending request for this group.'), { statusCode: 409 });
    /* if rejected before, allow re-request by deleting old record */
    await db.query('DELETE FROM group_join_requests WHERE id = ?', [existingReq.id]);
  }

  /* check group capacity */
  const [[{ memberCount }]] = await db.query(
    'SELECT COUNT(*) AS memberCount FROM group_members WHERE group_id = ?', [group.id]
  );
  if (memberCount >= group.max_members) throw Object.assign(new Error('This group is already full.'), { statusCode: 409 });

  await db.query(
    'INSERT INTO group_join_requests (group_id, student_id) VALUES (?, ?)',
    [group.id, studentId]
  );

  const [[req]] = await db.query(
    `SELECT gjr.id, gjr.group_id, gjr.student_id, gjr.status, gjr.requested_at,
            tg.name AS group_name,
            CONCAT(u.first_name, ' ', u.last_name) AS student_name
     FROM group_join_requests gjr
     JOIN thesis_groups tg ON gjr.group_id   = tg.id
     JOIN users u          ON gjr.student_id = u.id
     WHERE gjr.group_id = ? AND gjr.student_id = ?`,
    [group.id, studentId]
  );
  return req;
}

/* ─── list pending requests (leader) ─────────────────────────────── */
async function getPendingRequests(groupId, leaderId) {
  const [[group]] = await db.query(
    'SELECT id, leader_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL', [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can view join requests.'), { statusCode: 403 });

  const [rows] = await db.query(
    `SELECT gjr.id, gjr.student_id, gjr.status, gjr.requested_at,
            CONCAT(u.first_name, ' ', u.last_name) AS student_name,
            u.student_number, u.email
     FROM group_join_requests gjr
     JOIN users u ON gjr.student_id = u.id
     WHERE gjr.group_id = ? AND gjr.status = 'pending'
     ORDER BY gjr.requested_at ASC`,
    [groupId]
  );
  return rows;
}

/* ─── accept join request (leader) ───────────────────────────────── */
async function acceptRequest(requestId, groupId, leaderId) {
  const [[group]] = await db.query(
    'SELECT id, leader_id, max_members FROM thesis_groups WHERE id = ? AND deleted_at IS NULL', [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can accept requests.'), { statusCode: 403 });

  const [[req]] = await db.query(
    `SELECT id, student_id, status FROM group_join_requests WHERE id = ? AND group_id = ?`,
    [requestId, groupId]
  );
  if (!req) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });
  if (req.status !== 'pending') throw Object.assign(new Error('This request has already been processed.'), { statusCode: 400 });

  /* check capacity */
  const [[{ memberCount }]] = await db.query(
    'SELECT COUNT(*) AS memberCount FROM group_members WHERE group_id = ?', [groupId]
  );
  if (memberCount >= group.max_members) throw Object.assign(new Error('Group is already full.'), { statusCode: 409 });

  /* remove student from any other group they may belong to */
  await db.query(
    'DELETE FROM group_members WHERE student_id = ? AND group_id != ?',
    [req.student_id, groupId]
  );

  /* also cancel their pending requests to other groups */
  await db.query(
    `UPDATE group_join_requests SET status = 'rejected', processed_at = NOW()
     WHERE student_id = ? AND group_id != ? AND status = 'pending'`,
    [req.student_id, groupId]
  );

  /* add to group */
  await db.query(
    'INSERT IGNORE INTO group_members (group_id, student_id) VALUES (?, ?)',
    [groupId, req.student_id]
  );

  /* mark request as accepted */
  await db.query(
    `UPDATE group_join_requests SET status = 'accepted', processed_at = NOW() WHERE id = ?`,
    [requestId]
  );

  return getGroupById(groupId);
}

/* ─── reject join request (leader) ───────────────────────────────── */
async function rejectRequest(requestId, groupId, leaderId) {
  const [[group]] = await db.query(
    'SELECT id, leader_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL', [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can reject requests.'), { statusCode: 403 });

  const [[req]] = await db.query(
    `SELECT id, status FROM group_join_requests WHERE id = ? AND group_id = ?`,
    [requestId, groupId]
  );
  if (!req) throw Object.assign(new Error('Request not found.'), { statusCode: 404 });
  if (req.status !== 'pending') throw Object.assign(new Error('This request has already been processed.'), { statusCode: 400 });

  await db.query(
    `UPDATE group_join_requests SET status = 'rejected', processed_at = NOW() WHERE id = ?`,
    [requestId]
  );
  return { message: 'Request rejected.' };
}

/* ─── remove member (leader) ──────────────────────────────────────── */
async function removeMember(groupId, targetStudentId, leaderId) {
  const [[group]] = await db.query(
    'SELECT id, leader_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL', [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can remove members.'), { statusCode: 403 });
  if (targetStudentId === leaderId) throw Object.assign(new Error('The leader cannot remove themselves. Disband the group instead.'), { statusCode: 400 });

  const [[member]] = await db.query(
    'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
    [groupId, targetStudentId]
  );
  if (!member) throw Object.assign(new Error('This student is not a member of your group.'), { statusCode: 404 });

  await db.query('DELETE FROM group_members WHERE group_id = ? AND student_id = ?', [groupId, targetStudentId]);
}

/* ─── leave group (non-leader member) ────────────────────────────── */
async function leaveGroup(groupId, studentId) {
  const [[group]] = await db.query(
    'SELECT id, leader_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL', [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id === studentId) throw Object.assign(new Error('The leader cannot leave the group. Disband it instead.'), { statusCode: 400 });

  const [[member]] = await db.query(
    'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
    [groupId, studentId]
  );
  if (!member) throw Object.assign(new Error('You are not a member of this group.'), { statusCode: 404 });

  await db.query('DELETE FROM group_members WHERE group_id = ? AND student_id = ?', [groupId, studentId]);
}

/* ─── disband group (leader only) ────────────────────────────────── */
async function disbandGroup(groupId, leaderId) {
  const [[group]] = await db.query(
    'SELECT id, leader_id FROM thesis_groups WHERE id = ? AND deleted_at IS NULL', [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can disband the group.'), { statusCode: 403 });

  await db.query('DELETE FROM group_members WHERE group_id = ?', [groupId]);
  await db.query(
    `UPDATE group_join_requests SET status = 'rejected', processed_at = NOW()
     WHERE group_id = ? AND status = 'pending'`,
    [groupId]
  );
  await db.query('UPDATE thesis_groups SET deleted_at = NOW() WHERE id = ?', [groupId]);
}

/* ─── check if student is a group leader (used by submissions) ────── */
async function getStudentGroupRole(studentId) {
  try {
    const [[membership]] = await db.query(
      `SELECT gm.group_id, tg.leader_id
       FROM group_members gm
       JOIN thesis_groups tg ON gm.group_id = tg.id
       WHERE gm.student_id = ? AND tg.deleted_at IS NULL`,
      [studentId]
    );
    if (!membership) return { inGroup: false, isLeader: false, groupId: null };
    return {
      inGroup:  true,
      isLeader: membership.leader_id === studentId,
      groupId:  membership.group_id,
    };
  } catch (_) {
    return { inGroup: false, isLeader: false, groupId: null };
  }
}

module.exports = {
  getMyGroup,
  getGroupById,
  createGroup,
  updateGroup,
  requestJoin,
  getPendingRequests,
  acceptRequest,
  rejectRequest,
  removeMember,
  leaveGroup,
  disbandGroup,
  getStudentGroupRole,
};
