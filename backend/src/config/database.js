const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST || 'localhost',
  port:            Number(process.env.DB_PORT) || 3306,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  database:        process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:      0,
  timezone:        '+00:00',
});

pool.getConnection()
  .then(conn => { conn.release(); console.log('MySQL connected.'); })
  .catch(err => { console.error('MySQL connection error:', err.message); process.exit(1); });

module.exports = pool;
