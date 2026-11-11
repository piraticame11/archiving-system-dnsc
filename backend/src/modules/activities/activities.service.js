const db = require('../../config/database');
const path = require('path');
const fs = require('fs');

/* ─── Create Activity (Instructor) ───────────────────────────────── */
async function createActivity({ instructor_id, department_id, set_name, group_id, title, description, deadline }) {
  if (!title || !title.trim()) {
    throw Object.assign(new Error('Activity title is required.'), { statusCode: 400 });
  }
  if (!deadline) {
    throw Object.assign(new Error('Submission deadline is required.'), { statusCode: 400 });
  }

  const cleanSet = set_name && set_name.trim() ? set_name.trim() : null;
  const deptId = department_id ? parseInt(department_id) : null;
  const grpId = group_id ? parseInt(group_id) : null;

  const [result] = await db.query(
    `INSERT INTO activities (instructor_id, department_id, set_name, group_id, title, description, deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [instructor_id, deptId, cleanSet, grpId, title.trim(), description ? description.trim() : null, new Date(deadline)]
  );

  return getActivityById(result.insertId);
}

/* ─── List Activities for Instructor ─────────────────────────────── */
async function listActivitiesForInstructor(instructor_id) {
  const [rows] = await db.query(
    `SELECT a.id, a.instructor_id, a.department_id, a.set_name, a.group_id, a.title, a.description, a.deadline,
            a.created_at, a.updated_at,
            d.name AS department_name, d.code AS department_code,
            tg.name AS group_name,
            COUNT(DISTINCT asub.id) AS submission_count
     FROM activities a
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN thesis_groups tg ON a.group_id = tg.id
     LEFT JOIN activity_submissions asub ON asub.activity_id = a.id
     WHERE a.instructor_id = ?
     GROUP BY a.id
     ORDER BY a.deadline DESC, a.created_at DESC`,
    [instructor_id]
  );
  return rows;
}

/* ─── List Activities for Student ────────────────────────────────── */
async function listActivitiesForStudent(student_id) {
  // Find student's group
  const [[membership]] = await db.query(
    `SELECT gm.group_id, tg.department_id, tg.set_name, tg.instructor_id
     FROM group_members gm
     JOIN thesis_groups tg ON gm.group_id = tg.id
     WHERE gm.student_id = ? AND tg.deleted_at IS NULL`,
    [student_id]
  );

  if (!membership) {
    return { has_group: false, activities: [] };
  }

  const groupId = membership.group_id;
  const deptId = membership.department_id;
  const setName = membership.set_name;
  const instructorId = membership.instructor_id;

  // Query activities matching the student's group:
  // 1. Specifically assigned to this group (a.group_id = groupId)
  // 2. Or assigned by their instructor to their set/section (or all sets if set_name is null)
  const [rows] = await db.query(
    `SELECT a.id, a.instructor_id, a.department_id, a.set_name, a.group_id, a.title, a.description, a.deadline,
            a.created_at,
            CONCAT(inst.first_name, ' ', inst.last_name) AS instructor_name,
            d.code AS department_code,
            asub.id AS submission_id,
            asub.file_name,
            asub.submitted_at,
            CASE WHEN asub.id IS NOT NULL THEN 1 ELSE 0 END AS is_submitted,
            CASE WHEN asub.submitted_at > a.deadline THEN 1 ELSE 0 END AS is_late
     FROM activities a
     JOIN users inst ON a.instructor_id = inst.id
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN activity_submissions asub ON asub.activity_id = a.id AND asub.group_id = ?
     WHERE a.group_id = ?
        OR (
          (a.instructor_id = ? OR a.instructor_id IS NULL)
          AND (a.set_name IS NULL OR a.set_name = ? OR LOWER(a.set_name) = LOWER(?))
          AND (a.department_id IS NULL OR a.department_id = ?)
        )
     ORDER BY a.deadline ASC`,
    [groupId, groupId, instructorId, setName, setName, deptId]
  );

  return { has_group: true, group_id: groupId, set_name: setName, activities: rows };
}

/* ─── Get Activity by ID ─────────────────────────────────────────── */
async function getActivityById(id) {
  const [[row]] = await db.query(
    `SELECT a.id, a.instructor_id, a.department_id, a.set_name, a.group_id, a.title, a.description, a.deadline,
            a.created_at, a.updated_at,
            CONCAT(u.first_name, ' ', u.last_name) AS instructor_name,
            d.name AS department_name, d.code AS department_code,
            tg.name AS group_name
     FROM activities a
     JOIN users u ON a.instructor_id = u.id
     LEFT JOIN departments d ON a.department_id = d.id
     LEFT JOIN thesis_groups tg ON a.group_id = tg.id
     WHERE a.id = ?`,
    [id]
  );
  return row || null;
}

/* ─── Delete Activity (Instructor) ───────────────────────────────── */
async function deleteActivity(id, instructor_id) {
  const [[act]] = await db.query(
    'SELECT id, instructor_id FROM activities WHERE id = ?', [id]
  );
  if (!act) throw Object.assign(new Error('Activity not found.'), { statusCode: 404 });
  if (act.instructor_id !== instructor_id) {
    throw Object.assign(new Error('Only the creator can delete this activity.'), { statusCode: 403 });
  }

  await db.query('DELETE FROM activities WHERE id = ?', [id]);
  return { message: 'Activity deleted successfully.' };
}

/* ─── Submit Activity (Student) ──────────────────────────────────── */
async function submitActivity({ activity_id, student_id, file, comments }) {
  if (!file) throw Object.assign(new Error('A submission file (PDF or DOCX) is required.'), { statusCode: 400 });

  // Get student's group
  const [[membership]] = await db.query(
    `SELECT gm.group_id, tg.name AS group_name
     FROM group_members gm
     JOIN thesis_groups tg ON gm.group_id = tg.id
     WHERE gm.student_id = ? AND tg.deleted_at IS NULL`,
    [student_id]
  );
  if (!membership) {
    throw Object.assign(new Error('You must belong to a group to submit an activity.'), { statusCode: 400 });
  }

  const groupId = membership.group_id;

  const [[act]] = await db.query('SELECT id, title, deadline FROM activities WHERE id = ?', [activity_id]);
  if (!act) throw Object.assign(new Error('Activity not found.'), { statusCode: 404 });

  // Check if group already submitted; if so, replace/update
  const [[existing]] = await db.query(
    'SELECT id, file_path FROM activity_submissions WHERE activity_id = ? AND group_id = ?',
    [activity_id, groupId]
  );

  if (existing) {
    // Delete old file if exists
    try {
      if (existing.file_path && fs.existsSync(existing.file_path)) {
        fs.unlinkSync(existing.file_path);
      }
    } catch (_) {}

    await db.query(
      `UPDATE activity_submissions
       SET submitted_by = ?, file_name = ?, file_path = ?, file_size = ?, mime_type = ?, comments = ?, submitted_at = NOW()
       WHERE id = ?`,
      [student_id, file.originalname, file.path, file.size, file.mimetype, comments ? comments.trim() : null, existing.id]
    );

    return { id: existing.id, message: 'Submission updated successfully.' };
  } else {
    const [result] = await db.query(
      `INSERT INTO activity_submissions (activity_id, group_id, submitted_by, file_name, file_path, file_size, mime_type, comments, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [activity_id, groupId, student_id, file.originalname, file.path, file.size, file.mimetype, comments ? comments.trim() : null]
    );

    return { id: result.insertId, message: 'Activity submitted successfully.' };
  }
}

/* ─── Get Submissions for Activity (Instructor) ──────────────────── */
async function getSubmissions(activity_id, instructor_id) {
  const [[act]] = await db.query('SELECT id, instructor_id, deadline FROM activities WHERE id = ?', [activity_id]);
  if (!act) throw Object.assign(new Error('Activity not found.'), { statusCode: 404 });
  if (act.instructor_id !== instructor_id) {
    throw Object.assign(new Error('You do not have access to view submissions for this activity.'), { statusCode: 403 });
  }

  const [rows] = await db.query(
    `SELECT asub.id, asub.activity_id, asub.group_id, asub.submitted_by,
            asub.file_name, asub.file_path, asub.file_size, asub.mime_type, asub.comments, asub.submitted_at,
            tg.name AS group_name, tg.set_name,
            d.code AS department_code,
            CONCAT(u.first_name, ' ', u.last_name) AS submitter_name,
            u.email AS submitter_email,
            CASE WHEN asub.submitted_at > ? THEN 1 ELSE 0 END AS is_late
     FROM activity_submissions asub
     JOIN thesis_groups tg ON asub.group_id = tg.id
     LEFT JOIN departments d ON tg.department_id = d.id
     JOIN users u ON asub.submitted_by = u.id
     WHERE asub.activity_id = ?
     ORDER BY asub.submitted_at DESC`,
    [act.deadline, activity_id]
  );

  return rows;
}

/* ─── Get Submission File (for download/viewing) ──────────────────── */
async function getSubmissionFile(submission_id, user) {
  const [[sub]] = await db.query(
    `SELECT asub.id, asub.activity_id, asub.group_id, asub.file_name, asub.file_path, asub.file_size, asub.mime_type,
            a.instructor_id
     FROM activity_submissions asub
     JOIN activities a ON asub.activity_id = a.id
     WHERE asub.id = ?`,
    [submission_id]
  );
  if (!sub) return null;

  // Authorization: instructor who created the activity, student belonging to the group, or admin
  if (user.role === 'instructor' && sub.instructor_id !== user.id) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
  if (user.role === 'student') {
    const [[membership]] = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?',
      [sub.group_id, user.id]
    );
    if (!membership) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  return sub;
}

/* ─── Get Distinct Sets & Groups for Instructor ──────────────────── */
async function getInstructorSets(instructor_id) {
  // Get sets and groups associated with this instructor
  const [sets] = await db.query(
    `SELECT DISTINCT tg.set_name, tg.department_id, d.code AS department_code, d.name AS department_name
     FROM thesis_groups tg
     LEFT JOIN departments d ON tg.department_id = d.id
     WHERE (tg.instructor_id = ? OR tg.adviser_id = ?)
       AND tg.set_name IS NOT NULL
       AND tg.deleted_at IS NULL
     ORDER BY tg.set_name ASC`,
    [instructor_id, instructor_id]
  );

  const [groups] = await db.query(
    `SELECT tg.id, tg.name, tg.set_name, tg.department_id, d.code AS department_code
     FROM thesis_groups tg
     LEFT JOIN departments d ON tg.department_id = d.id
     WHERE (tg.instructor_id = ? OR tg.adviser_id = ?)
       AND tg.deleted_at IS NULL
     ORDER BY tg.name ASC`,
    [instructor_id, instructor_id]
  );

  return { sets, groups };
}

module.exports = {
  createActivity,
  listActivitiesForInstructor,
  listActivitiesForStudent,
  getActivityById,
  deleteActivity,
  submitActivity,
  getSubmissions,
  getSubmissionFile,
  getInstructorSets,
};

