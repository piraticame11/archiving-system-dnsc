# API Routes

Base URL: `/api/v1`  
All protected routes require `Authorization: Bearer <token>` header.

---

## Auth — `/api/v1/auth`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `POST` | `/auth/register` | Public | Register a new user account |
| `POST` | `/auth/login` | Public | Login and receive access + refresh tokens |
| `POST` | `/auth/refresh` | Cookie | Refresh the access token via httpOnly cookie |
| `POST` | `/auth/logout` | Cookie | Revoke refresh token and clear cookie |
| `POST` | `/auth/forgot-password` | Public | Send password reset email |
| `POST` | `/auth/reset-password` | Public | Complete password reset with token |
| `GET`  | `/auth/me` | Bearer | Get the authenticated user's profile |
| `PATCH`| `/auth/me` | Bearer | Update own first name, last name, photo |
| `PATCH`| `/auth/me/password` | Bearer | Change own password |

---

## Users — `/api/v1/users`

> Role required: `superadmin`

| Method | Path | What it does |
|--------|------|--------------|
| `GET`    | `/users` | List all users — supports `?search`, `?role`, `?status`, `?page`, `?limit` |
| `POST`   | `/users` | Create a new user |
| `GET`    | `/users/:id` | Get a single user by ID |
| `PATCH`  | `/users/:id` | Update user fields (leave `password` blank to keep current) |
| `DELETE` | `/users/:id` | Soft-delete a user |
| `PATCH`  | `/users/:id/toggle-active` | Toggle the user's `is_active` status |
| `POST`   | `/users/:id/reset-password` | Set a new password for the user |

---

## Departments — `/api/v1/departments`

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET` | `/departments` | Public | List all departments (id, code, name) |

---

## Archive — `/api/v1/archive`

> Browse: any authenticated user. Promote/Delete: `admin` or `superadmin` only.

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET`    | `/archive` | Bearer | Browse archive — supports `?search`, `?department_id`, `?school_year`, `?semester`, `?type`, `?page`, `?limit` |
| `GET`    | `/archive/stats` | Bearer | Aggregate counts: total, thesis, capstone, total downloads, by dept, by year |
| `GET`    | `/archive/eligible` | admin/superadmin | List approved submissions not yet archived |
| `GET`    | `/archive/:id` | Bearer | Get single archive entry (includes abstract, file info) |
| `GET`    | `/archive/:id/download` | Bearer | Stream file download + increment download count |
| `POST`   | `/archive` | admin/superadmin | Promote approved submission to archive |
| `DELETE` | `/archive/:id` | admin/superadmin | Remove entry from archive (submission + file untouched) |

---

## System

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| `GET` | `/health` | Public | Health check — returns uptime and DB status |
