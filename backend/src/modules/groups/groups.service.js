const db = require('../../config/database');
const { sendMail, adviserRequestHtml, adviserDecisionHtml } = require('../../config/mailer');

const JOIN_CODE_VALIDITY_DAYS = 7;

/* ─── titles helpers ──────────────────────────────────────────────── */
async function getGroupTitles(groupId) {
  const [rows] = await db.query(
    'SELECT id, title, display_order FROM group_titles WHERE group_id = ? ORDER BY display_order ASC',
    [groupId]
  );
  return rows;
}

async function setGroupTitles(groupId, titles) {
  const clean = (titles || []).map(t => (t || '').trim()).filter(Boolean).slice(0, 3);
  await db.query('DELETE FROM group_titles WHERE group_id = ?', [groupId]);
  if (!clean.length) return;
  const values = clean.map((title, i) => [groupId, title, i + 1]);
  await db.query('INSERT INTO group_titles (group_id, title, display_order) VALUES ?', [values]);
  await db.query('UPDATE thesis_groups SET title = ? WHERE id = ?', [clean[0], groupId]);
}

/* ─── adviser capacity check ─────────────────────────────────────── */
async function assertAdviserHasCapacity(adviserId) {
  const [[adv]] = await db.query('SELECT max_advisee_groups FROM users WHERE id = ?', [adviserId]);
  if (!adv || adv.max_advisee_groups == null) return;

  const [[{ count }]] = await db.query(
    `SELECT COUNT(*) AS count FROM thesis_groups
     WHERE adviser_id = ? AND adviser_status = 'approved' AND deleted_at IS NULL`,
    [adviserId]
  );
  if (count >= adv.max_advisee_groups) {
    throw Object.assign(
      new Error('This adviser has reached their maximum number of advisee groups.'),
      { statusCode: 409 }
    );
  }
}

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
    `SELECT tg.id, tg.name, tg.join_code, tg.join_code_expires_at, tg.title, tg.school_year, tg.max_members,
            tg.leader_id, tg.adviser_id, tg.department_id, tg.created_at,
            tg.adviser_status, tg.adviser_status_reason, tg.adviser_responded_at,
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
  group.titles = await getGroupTitles(id);
  return group;
}

/* ─── validate adviser + notify of a pending request ─────────────── */
async function validateAdviserAndNotify(adviserId, groupName, leaderId) {
  const [[adv]] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = ? AND r.name = 'instructor' AND u.is_active = 1 AND u.deleted_at IS NULL`,
    [adviserId]
  );
  if (!adv) throw Object.assign(new Error('Adviser not found or is not an instructor.'), { statusCode: 404 });

  await assertAdviserHasCapacity(adviserId);

  const [[leader]] = await db.query('SELECT first_name, last_name FROM users WHERE id = ?', [leaderId]);
  await sendMail({
    to:      adv.email,
    subject: 'Adviser Request — ACES Research System',
    html:    adviserRequestHtml(`${adv.first_name} ${adv.last_name}`, groupName, `${leader.first_name} ${leader.last_name}`),
  }).catch(() => {});
}

/* ─── create group ────────────────────────────────────────────────── */
async function createGroup({ leader_id, name, adviser_id, titles, school_year, max_members }) {
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

  if (adviser_id) await validateAdviserAndNotify(adviser_id, name, leader_id);

  const join_code = await uniqueJoinCode();
  const cap = Math.min(Math.max(parseInt(max_members) || 5, 4), 6);

  const [result] = await db.query(
    `INSERT INTO thesis_groups (name, join_code, join_code_expires_at, leader_id, adviser_id, adviser_status, department_id, school_year, max_members)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${JOIN_CODE_VALIDITY_DAYS} DAY), ?, ?, ?, ?, ?, ?)`,
    [name, join_code, leader_id, adviser_id || null, adviser_id ? 'pending' : null, user.department_id, school_year, cap]
  );
  const groupId = result.insertId;

  /* add leader as first member */
  await db.query('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)', [groupId, leader_id]);

  await setGroupTitles(groupId, titles);

  return getGroupById(groupId);
}

/* ─── update group info (leader only) ────────────────────────────── */
async function updateGroup(groupId, leaderId, { name, adviser_id, titles, school_year, max_members }) {
  const group = await getGroupById(groupId);
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can update group info.'), { statusCode: 403 });

  const adviserChanged = adviser_id !== undefined && adviser_id !== group.adviser_id;
  if (adviserChanged && adviser_id !== null) {
    await validateAdviserAndNotify(adviser_id, group.name, leaderId);
  }

  const fields = {};
  if (name        !== undefined) fields.name        = name;
  if (school_year !== undefined) fields.school_year = school_year;
  if (max_members !== undefined) fields.max_members = Math.min(Math.max(parseInt(max_members) || 5, 4), 6);
  if (adviserChanged) {
    fields.adviser_id            = adviser_id || null;
    fields.adviser_status        = adviser_id ? 'pending' : null;
    fields.adviser_status_reason = null;
    fields.adviser_responded_at  = null;
  }

  if (Object.keys(fields).length) {
    const set = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE thesis_groups SET ${set} WHERE id = ?`, [...Object.values(fields), groupId]);
  }
  if (titles !== undefined) await setGroupTitles(groupId, titles);

  return getGroupById(groupId);
}

/* ─── regenerate join code (leader only) ─────────────────────────── */
async function regenerateJoinCode(groupId, leaderId) {
  const group = await getGroupById(groupId);
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.leader_id !== leaderId) throw Object.assign(new Error('Only the group leader can regenerate the join code.'), { statusCode: 403 });

  const join_code = await uniqueJoinCode();
  await db.query(
    `UPDATE thesis_groups
     SET join_code = ?, join_code_expires_at = DATE_ADD(NOW(), INTERVAL ${JOIN_CODE_VALIDITY_DAYS} DAY)
     WHERE id = ?`,
    [join_code, groupId]
  );
  return getGroupById(groupId);
}

/* ─── request to join via code ────────────────────────────────────── */
async function requestJoin(studentId, joinCode) {
  const [[group]] = await db.query(
    'SELECT id, max_members, leader_id, join_code_expires_at FROM thesis_groups WHERE join_code = ? AND deleted_at IS NULL',
    [joinCode]
  );
  if (!group) throw Object.assign(new Error('Invalid join code. No group found.'), { statusCode: 404 });

  if (group.join_code_expires_at && new Date(group.join_code_expires_at) < new Date()) {
    throw Object.assign(
      new Error('This join code has expired. Ask the group leader for a new one.'),
      { statusCode: 410 }
    );
  }

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

/* ─── adviser: list pending group requests ───────────────────────── */
async function getAdviserRequests(adviserId) {
  const [rows] = await db.query(
    `SELECT tg.id, tg.name, tg.title, tg.school_year, tg.max_members, tg.created_at,
            CONCAT(l.first_name, ' ', l.last_name) AS leader_name,
            d.name AS department_name, d.code AS department_code,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = tg.id) AS member_count
     FROM thesis_groups tg
     JOIN users l        ON tg.leader_id     = l.id
     JOIN departments d  ON tg.department_id = d.id
     WHERE tg.adviser_id = ? AND tg.adviser_status = 'pending' AND tg.deleted_at IS NULL
     ORDER BY tg.created_at ASC`,
    [adviserId]
  );
  for (const g of rows) g.titles = await getGroupTitles(g.id);
  return rows;
}

/* ─── adviser: approve/reject a pending group request ────────────── */
async function respondToAdviserRequest(groupId, adviserId, decision, reason) {
  if (!['approved', 'rejected'].includes(decision)) {
    throw Object.assign(new Error('Decision must be "approved" or "rejected".'), { statusCode: 400 });
  }
  if (decision === 'rejected' && !(reason || '').trim()) {
    throw Object.assign(new Error('A reason is required when declining a request.'), { statusCode: 400 });
  }

  const [[group]] = await db.query(
    `SELECT id, name, leader_id, adviser_id, adviser_status FROM thesis_groups WHERE id = ? AND deleted_at IS NULL`,
    [groupId]
  );
  if (!group) throw Object.assign(new Error('Group not found.'), { statusCode: 404 });
  if (group.adviser_id !== adviserId) throw Object.assign(new Error('You are not the requested adviser for this group.'), { statusCode: 403 });
  if (group.adviser_status !== 'pending') throw Object.assign(new Error('This request has already been processed.'), { statusCode: 400 });

  if (decision === 'approved') await assertAdviserHasCapacity(adviserId);

  const fields = { adviser_status: decision, adviser_status_reason: reason || null, adviser_responded_at: new Date() };
  if (decision === 'rejected') fields.adviser_id = null;

  const set = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE thesis_groups SET ${set} WHERE id = ?`, [...Object.values(fields), groupId]);

  const [[leader]] = await db.query('SELECT first_name, last_name, email FROM users WHERE id = ?', [group.leader_id]);
  await sendMail({
    to:      leader.email,
    subject: 'Adviser Request Update — ACES Research System',
    html:    adviserDecisionHtml(`${leader.first_name} ${leader.last_name}`, group.name, decision, reason),
  }).catch(() => {});

  return getGroupById(groupId);
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
  regenerateJoinCode,
  requestJoin,
  getPendingRequests,
  acceptRequest,
  rejectRequest,
  removeMember,
  leaveGroup,
  disbandGroup,
  getStudentGroupRole,
  getAdviserRequests,
  respondToAdviserRequest,
};
