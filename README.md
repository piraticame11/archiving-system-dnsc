# Archiving System — DNSC

Thesis and Capstone Archiving and Scheduling Management System.

## Tech Stack

- **Backend** — Node.js, Express.js, MySQL
- **Frontend** — Static HTML/CSS/JS, Tailwind CSS
- **Auth** — JWT (access + refresh tokens)
- **Email** — Nodemailer (Gmail SMTP)
- **File Uploads** — Multer (up to 50 MB)

---

## Prerequisites

Make sure you have the following installed before proceeding:

- [Node.js](https://nodejs.org/) v18 or higher
- [MySQL](https://dev.mysql.com/downloads/) 8.0 or higher
- npm (comes with Node.js)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/piraticame11/archiving-system-dnsc.git
cd archiving-system-dnsc
```

### 2. Install dependencies

Install all dependencies for the root, backend, and frontend in one command:

```bash
npm run install:all
```

### 3. Set up the database

Open your MySQL client and create the database:

```sql
CREATE DATABASE archiving_system;
```

### 4. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp backend/.env.example .env
```

Open `.env` and update the following fields:

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host (default: `localhost`) |
| `DB_PORT` | MySQL port (default: `3306`) |
| `DB_NAME` | Database name (default: `archiving_system`) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `JWT_SECRET` | Random string, 64+ characters |
| `JWT_REFRESH_SECRET` | Another random string, 64+ characters |
| `MAIL_USER` | Gmail address used to send emails |
| `MAIL_PASS` | Gmail App Password (not your regular Gmail password) |
| `SUPERADMIN_EMAIL` | Email for the seeded superadmin account |
| `SUPERADMIN_PASSWORD` | Password for the seeded superadmin account |

> **Gmail App Password**: Go to your Google Account → Security → 2-Step Verification → App passwords. Generate one for "Mail".

### 5. Run database migrations

This creates all tables and seeds the superadmin account:

```bash
npm run migrate
```

### 6. Start the development server

```bash
npm run dev
```

This starts:
- **Backend API** at `http://localhost:3000`
- **Tailwind CSS** watcher for the frontend

Open `http://localhost:3000` in your browser.

---

## Default Login

After running migrations, a superadmin account is seeded using the values in your `.env`:

| Field | Default Value |
|---|---|
| Email | `superadmin@aces.edu.ph` |
| Password | `Admin@1234` |

Change these in your `.env` before running migrations, or update the account after first login.

---

## User Roles

| Role | Access |
|---|---|
| **Superadmin** | Full system access, manage admins |
| **Admin** | Manage users, schedules, submissions, archive |
| **Instructor** | View advisees, manage uploads |
| **Panelist** | View assigned schedules, submit evaluations |
| **Student** | Submit thesis/capstone titles and documents |

---

## Project Structure

```
archiving-system-dnsc/
├── backend/
│   ├── migrations/          # SQL migration files (run in order)
│   ├── src/
│   │   ├── config/          # DB, JWT, email, upload config
│   │   ├── middleware/      # Auth, RBAC, validation, error handling
│   │   ├── modules/         # Feature modules (auth, users, submissions, etc.)
│   │   └── app.js           # Express app setup
│   └── server.js            # Entry point
├── frontend/
│   └── public/
│       ├── index.html       # Entry point (redirects by role)
│       ├── pages/           # HTML pages grouped by role
│       └── assets/          # CSS, JS, images
├── .env                     # Your local environment config (not committed)
└── package.json             # Root scripts
```

---

## Available Scripts

Run these from the project root:

| Command | Description |
|---|---|
| `npm run install:all` | Install all dependencies (root + backend + frontend) |
| `npm run dev` | Start backend (nodemon) + Tailwind CSS watcher |
| `npm run build` | Build Tailwind CSS (minified, for production) |
| `npm run migrate` | Run all SQL migrations and seed superadmin |

---

## API

The REST API is served at `http://localhost:3000/api/v1`.

See [API_ROUTES.md](API_ROUTES.md) for the full list of endpoints.

**Health check:**

```
GET http://localhost:3000/api/v1/health
```

---

## Troubleshooting

**`Error: ER_ACCESS_DENIED_ERROR`**
— Check `DB_USER` and `DB_PASSWORD` in your `.env`.

**`Error: connect ECONNREFUSED`**
— MySQL is not running. Start your MySQL service.

**Emails not sending**
— Make sure `MAIL_USER` and `MAIL_PASS` are set correctly. Use a Gmail App Password, not your regular Gmail password. Also ensure 2-Step Verification is enabled on your Google account.

**Tailwind CSS not updating**
— Run `npm run dev` from the project root so the CSS watcher starts alongside the backend.
