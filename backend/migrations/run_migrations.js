require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log('Connected to MySQL. Running migrations...\n');

  // Ensure tracking table exists
  await conn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Which files have already been applied?
  const [appliedRows] = await conn.query('SELECT filename FROM _migrations');
  const applied = new Set(appliedRows.map(r => r.filename));

  const dir   = path.join(__dirname);
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  - ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await conn.query(sql);
      await conn.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  const bcrypt = require('bcryptjs');

  const [roleRows] = await conn.query(`SELECT id, name FROM roles`);
  const roleMap = {};
  roleRows.forEach(r => { roleMap[r.name] = r.id; });

  const [[dept]] = await conn.query(`SELECT id FROM departments LIMIT 1`);
  const deptId = dept ? dept.id : null;

  const pw = await bcrypt.hash('password', 12);

  const seedUsers = [
    {
      role:           'superadmin',
      first_name:     'Super',
      last_name:      'Admin',
      email:          process.env.SUPERADMIN_EMAIL || 'superadmin@aces.edu.ph',
      password_hash:  await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'Admin@1234', 12),
      department_id:  null,
      student_number: null,
    },
    {
      role:           'admin',
      first_name:     'Research',
      last_name:      'Office',
      email:          'admin@aces.edu.ph',
      password_hash:  pw,
      department_id:  deptId,
      student_number: null,
    },
    {
      role:           'instructor',
      first_name:     'Maria',
      last_name:      'Santos',
      email:          'instructor@aces.edu.ph',
      password_hash:  pw,
      department_id:  deptId,
      student_number: null,
    },
    {
      role:           'panelist',
      first_name:     'Juan',
      last_name:      'dela Cruz',
      email:          'panelist@aces.edu.ph',
      password_hash:  pw,
      department_id:  deptId,
      student_number: null,
    },
    {
      role:           'student',
      first_name:     'Ana',
      last_name:      'Reyes',
      email:          'student@aces.edu.ph',
      password_hash:  pw,
      department_id:  deptId,
      student_number: '2021-00001',
    },
  ];

  console.log('\n  Seeding users...');
  for (const u of seedUsers) {
    const [existing] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [u.email]);
    if (existing.length > 0) {
      console.log(`    - skipped (exists): ${u.email}`);
      continue;
    }
    await conn.query(
      `INSERT INTO users (role_id, department_id, student_number, first_name, last_name, email, password_hash, is_active, is_email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [roleMap[u.role], u.department_id, u.student_number, u.first_name, u.last_name, u.email, u.password_hash]
    );
    console.log(`    ✓ seeded: ${u.email} (${u.role})`);
  }

  console.log('\nAll migrations completed successfully.');
  await conn.end();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
