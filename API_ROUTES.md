# API Routes

Base URL: `/api/v1`  
All protected routes require `Authorization: Bearer <token>` header, unless marked `Public` or `Cookie`.

---

## 1. Auth — `/api/v1/auth`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `POST` | `/auth/register` | Public | Register a new user account |
| `POST` | `/auth/login` | Public | Login and receive access token + refresh token cookie |
| `POST` | `/auth/refresh` | Cookie | Refresh access token via httpOnly cookie |
| `POST` | `/auth/logout` | Cookie | Revoke refresh token and clear cookie |
| `POST` | `/auth/forgot-password` | Public | Request temporary password reset link / email |
| `POST` | `/auth/reset-password` | Public | Complete password reset with token |
| `GET`  | `/auth/me` | Bearer | Get the authenticated user's profile |
| `PATCH`| `/auth/me` | Bearer | Update own profile (first_name, last_name, personal_email, photo upload) |
| `PATCH`| `/auth/me/password` | Bearer | Change own password |

---

## 2. Users — `/api/v1/users`

> Role required: `superadmin`

| Method | Path | What it does |
|--------|------|--------------|
| `GET`    | `/users` | List all users — supports `?search`, `?role`, `?status`, `?page`, `?limit` |
| `POST`   | `/users` | Create a new user account |
| `GET`    | `/users/:id` | Get single user details by ID |
| `PATCH`  | `/users/:id` | Update user fields (leave password blank to keep current) |
| `DELETE` | `/users/:id` | Soft-delete a user |
| `PATCH`  | `/users/:id/toggle-active` | Toggle user's active status |
| `POST`   | `/users/:id/reset-password` | Set a new password for the user |

---

## 3. Departments — `/api/v1/departments`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET` | `/departments` | Public | List all academic departments (id, code, name) |

---

## 4. Archive — `/api/v1/archive`

> Browse: Any authenticated user. Manage/Promote/Delete: `admin` or `superadmin`.

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/archive` | Bearer | Search/browse archive with Google Scholar-style ranking — supports `?search`, `?department_id`, `?school_year`, `?semester`, `?type`, `?sort`, `?page`, `?limit` |
| `GET`    | `/archive/stats` | Bearer | Aggregate metrics: total archived, thesis vs capstone, total downloads, by dept, by year |
| `GET`    | `/archive/eligible` | admin, superadmin | List approved submissions eligible for archiving |
| `GET`    | `/archive/:id` | Bearer | Get archive entry details including abstract and file metadata |
| `GET`    | `/archive/:id/download` | Bearer | Stream PDF file download and increment counter |
| `POST`   | `/archive` | admin, superadmin | Promote approved submission to the public archive |
| `DELETE` | `/archive/:id` | admin, superadmin | Remove entry from archive (submission record preserved) |

---

## 5. Thesis Submissions — `/api/v1/submissions`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`   | `/submissions/stats` | admin, superadmin | Submissions summary metrics by status and department |
| `GET`   | `/submissions` | Bearer | List submissions (scoped to user role: student sees own, admin sees all) |
| `GET`   | `/submissions/my-group-submission` | student | Get or initialize submission for student's group |
| `GET`   | `/submissions/:id` | Bearer | Get submission details and document revisions |
| `DELETE`| `/submissions/:id` | Bearer | Delete submission (admin or group owner) |
| `PATCH` | `/submissions/:id/status` | admin, superadmin | Update review/workflow status of submission |
| `PATCH` | `/submissions/:id/title` | Bearer | Group leader updates submission research title |
| `POST`  | `/submissions/:id/documents` | Bearer | Upload manuscript / revision document (multipart: `file`) |
| `GET`   | `/submissions/:id/documents/:docId/view` | Bearer | Stream submission manuscript PDF for preview/download |

---

## 6. Defense Schedules — `/api/v1/schedules`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`   | `/schedules/calendar` | admin, superadmin, panelist | Defense calendar expanded view by date and time slot |
| `GET`   | `/schedules/my-group-schedule` | student | Get defense schedule assigned to student's group |
| `GET`   | `/schedules/auto-schedule/status` | admin, superadmin | Check if automatic scheduling engine is enabled |
| `PATCH` | `/schedules/auto-schedule/status` | admin, superadmin | Enable or disable automatic scheduling engine |
| `GET`   | `/schedules/auto-schedule/eligible-groups` | admin, superadmin | List unscheduled groups eligible for auto-scheduling |
| `POST`  | `/schedules/auto-schedule` | admin, superadmin | Run constraint-based auto-scheduling algorithm |
| `GET`   | `/schedules` | admin, superadmin, panelist | List schedules with filters (`?search`, `?status`, `?from_date`, `?to_date`) |
| `GET`   | `/schedules/:id` | Bearer | Get defense schedule details, venue, panel, and groups |
| `POST`  | `/schedules` | admin, superadmin | Create schedule with panelists and groups (atomic transaction) |
| `PATCH` | `/schedules/:id` | admin, superadmin | Update schedule, venue, slots, panelists, or groups (atomic transaction) |
| `PATCH` | `/schedules/:id/status` | admin, superadmin | Update schedule status (`scheduled`, `completed`, `cancelled`) |
| `DELETE`| `/schedules/:id` | admin, superadmin | Delete defense schedule |
| `POST`  | `/schedules/:id/minutes` | admin, superadmin | Upload digitized defense minutes photo (multipart: `file`) |
| `GET`   | `/schedules/:id/minutes` | admin, superadmin, panelist | View or download defense minutes photo |

---

## 7. Defense Venues — `/api/v1/venues`

> Role required: `admin`, `superadmin`

| Method | Path | What it does |
|--------|------|--------------|
| `GET`    | `/venues` | List defense venues — supports `?search`, `?is_active`, `?page`, `?limit` |
| `POST`   | `/venues` | Create a new defense venue / room |
| `PATCH`  | `/venues/:id` | Update venue details (name, capacity, location) |
| `PATCH`  | `/venues/:id/toggle-active` | Toggle venue active availability |
| `DELETE` | `/venues/:id` | Delete a venue |

---

## 8. Defense Evaluations — `/api/v1/evaluations`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`  | `/evaluations` | admin, superadmin, panelist | List evaluations (panelist sees own, admin sees all) |
| `GET`  | `/evaluations/my-scores` | student | View panel evaluation scores for student's group defense |
| `GET`  | `/evaluations/criteria` | admin, superadmin, panelist | List active rubric criteria for Research Output and Oral Presentation |
| `GET`  | `/evaluations/schedule/:scheduleId` | panelist | Get evaluation records for assigned schedule |
| `GET`  | `/evaluations/:id` | admin, superadmin, panelist | Get single evaluation with detailed rubric score breakdown |
| `POST` | `/evaluations` | panelist | Save draft or submit completed evaluation (atomic transaction) |

---

## 9. Thesis Groups — `/api/v1/groups`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/groups` | admin, superadmin | List all thesis groups with member and schedule counts |
| `GET`    | `/groups/instructors` | Bearer | List eligible instructors for adviser selection |
| `GET`    | `/groups/my` | student | Get student's current group, members, join code, and adviser status |
| `POST`   | `/groups` | student | Create a new thesis group and assign leader (atomic transaction) |
| `POST`   | `/groups/request-join` | student | Request to join a group using 6-digit join code |
| `PATCH`  | `/groups/:id` | student (leader) | Update group name, type, school year, max members, or adviser |
| `POST`   | `/groups/:id/regenerate-code` | student (leader) | Generate a new 7-day join code |
| `DELETE` | `/groups/:id` | student (leader) | Disband group, remove memberships, and reject pending requests (atomic) |
| `POST`   | `/groups/:id/leave` | student (member) | Leave group (non-leader member only) |
| `GET`    | `/groups/:id/requests` | student (leader) | List pending join requests for leader review |
| `POST`   | `/groups/:id/requests/:requestId/accept` | student (leader) | Accept member join request (atomic transaction) |
| `POST`   | `/groups/:id/requests/:requestId/reject` | student (leader) | Reject member join request |
| `DELETE` | `/groups/:id/members/:studentId` | student (leader) | Remove member from group |

---

## 10. Panelists — `/api/v1/panelists`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/panelists` | admin, superadmin | List panelists with department, status, and workload counts |
| `POST`   | `/panelists` | superadmin | Create panelist user account |
| `GET`    | `/panelists/:id` | admin, superadmin | Get panelist profile and assigned schedule history |
| `PATCH`  | `/panelists/:id` | superadmin | Update panelist profile information |
| `DELETE` | `/panelists/:id` | superadmin | Soft-delete panelist account |
| `PATCH`  | `/panelists/:id/toggle-active` | admin, superadmin | Toggle panelist active status |
| `POST`   | `/panelists/:id/reset-password` | admin, superadmin | Reset password for panelist account |
| `GET`    | `/panelists/:id/unavailability` | admin, superadmin | List unavailable defense dates for panelist |
| `POST`   | `/panelists/:id/unavailability` | admin, superadmin | Add unavailable date for panelist |
| `DELETE` | `/panelists/:id/unavailability/:unavailId` | admin, superadmin | Remove unavailable date for panelist |

---

## 11. Adviser Portal — `/api/v1/adviser`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/adviser/list` | Bearer | Public list of faculty advisers with advisee load count |
| `GET`    | `/adviser/my-advisees` | instructor | List groups currently advised with defense progress |
| `GET`    | `/adviser/my-students` | instructor | List individual advisee students across groups |
| `GET`    | `/adviser/my-groups` | instructor | List all groups handled |
| `DELETE` | `/adviser/my-groups/:id` | instructor | Remove association from advisee group |
| `POST`   | `/adviser/upload-list` | instructor | Upload class roster CSV |
| `GET`    | `/adviser/import-template` | instructor | Download Excel import template for bulk student registration |
| `POST`   | `/adviser/import-students` | instructor | Bulk-import students from Excel (forces password reset on first login) |
| `POST`   | `/adviser/export-credentials` | instructor | Download generated credentials for newly imported students |
| `GET`    | `/adviser/group-requests` | instructor | List pending advisorship requests from student groups |
| `POST`   | `/adviser/group-requests/:groupId/approve` | instructor | Accept group advisorship request |
| `POST`   | `/adviser/group-requests/:groupId/reject` | instructor | Decline group advisorship request with reason |
| `PATCH`  | `/adviser/settings` | instructor | Update adviser capacity (max advisee groups) |

---

## 12. IMRaD Templates — `/api/v1/imrad-templates`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/imrad-templates` | Bearer | List available IMRaD thesis format templates |
| `POST`   | `/imrad-templates` | admin, superadmin | Upload new IMRaD template document (multipart: `file`) |
| `GET`    | `/imrad-templates/:id/download` | Bearer | Download IMRaD template file |
| `DELETE` | `/imrad-templates/:id` | admin, superadmin | Delete an IMRaD template |

---

## 13. Instructor Guidelines — `/api/v1/instructor-guidelines`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/instructor-guidelines` | Bearer | List institutional guidelines, rubrics, and policy files |
| `POST`   | `/instructor-guidelines` | admin, superadmin, instructor | Upload guideline document (multipart: `file`) |
| `GET`    | `/instructor-guidelines/:id/download` | Bearer | Download guideline document |
| `DELETE` | `/instructor-guidelines/:id` | admin, superadmin, instructor owner | Delete uploaded guideline document |

---

## 14. School Years — `/api/v1/school-years`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`   | `/school-years` | Bearer | List configured academic school years |
| `POST`  | `/school-years` | admin, superadmin | Create a new academic school year (e.g., `2025-2026`) |
| `PATCH` | `/school-years/:id/toggle-active` | admin, superadmin | Set active school year |

---

## 15. System / Health

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET` | `/health` | Public | Health check — returns uptime and MySQL connection status |
