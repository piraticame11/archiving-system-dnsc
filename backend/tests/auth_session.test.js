const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

describe('Auth Session Refresh & Cross-Laptop Compatibility', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  function loadTestApp({ queryImpl, nodeEnv = 'production', frontendUrl = 'http://localhost:3000' }) {
    process.env = {
      ...originalEnv,
      NODE_ENV: nodeEnv,
      FRONTEND_URL: frontendUrl,
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    };

    jest.doMock('../src/config/database', () => ({
      query: jest.fn(queryImpl),
      getConnection: jest.fn(),
    }));

    return {
      app: require('../src/app'),
      db: require('../src/config/database'),
    };
  }

  test('sets non-Secure SameSite=Lax cookie over HTTP even in production mode and refreshes cleanly', async () => {
    const passwordHash = await bcrypt.hash('secret123', 4);
    const storedHashes = [];
    const userRow = {
      id: 7,
      role_id: 5,
      department_id: 1,
      student_number: '2024-0001',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      email: 'student@dnsc.edu.ph',
      password_hash: passwordHash,
      is_active: 1,
      is_email_verified: 1,
      personal_email: 'student@dnsc.edu.ph',
      personal_email_verified_at: new Date(),
      must_change_password: 0,
      role: 'student',
    };

    const { app } = loadTestApp({
      nodeEnv: 'production',
      queryImpl: async (sql, params = []) => {
        if (sql.includes('WHERE u.email = ?')) return [[userRow]];
        if (sql.includes('INSERT INTO refresh_tokens')) {
          storedHashes.push({ id: storedHashes.length + 1, user_id: params[0], token_hash: params[1], revoked: 0 });
          return [{ insertId: storedHashes.length }];
        }
        if (sql.includes('information_schema.COLUMNS')) return [[{ 1: 1 }]];
        if (sql.includes('FROM refresh_tokens')) {
          expect(sql).toContain('revoked_at');
          return [storedHashes];
        }
        if (sql.includes('UPDATE refresh_tokens SET revoked = 1')) return [{ affectedRows: 1 }];
        if (sql.includes('WHERE u.id = ?')) return [[userRow]];
        return [[]];
      },
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://192.168.1.50:3000')
      .set('Host', '192.168.1.50:3000')
      .send({ email: 'student@dnsc.edu.ph', password: 'secret123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['access-control-allow-origin']).toBe('http://192.168.1.50:3000');

    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/refresh_token=/);
    expect(cookies[0]).toMatch(/Path=\//);
    expect(cookies[0]).toMatch(/HttpOnly/);
    expect(cookies[0]).toMatch(/SameSite=Lax/);
    expect(cookies[0]).not.toMatch(/;\s*Secure\b/);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://192.168.1.50:3000')
      .set('Host', '192.168.1.50:3000')
      .set('Cookie', cookies[0]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();

    const httpsRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-Proto', 'https')
      .set('Cookie', refreshRes.headers['set-cookie'][0]);

    expect(httpsRefreshRes.status).toBe(200);
    expect(httpsRefreshRes.headers['set-cookie'][0]).toMatch(/;\s*Secure\b/);
  });

  test('falls back cleanly on refresh when revoked_at is missing and ALTER fails', async () => {
    const refreshSecret = 'test-refresh-secret';
    const token = jwt.sign({ id: 9 }, refreshSecret, { expiresIn: '7d' });
    const tokenHash = await bcrypt.hash(token, 4);
    const userRow = {
      id: 9,
      role_id: 5,
      department_id: 1,
      student_number: '2024-0002',
      first_name: 'Maria',
      last_name: 'Santos',
      email: 'maria@dnsc.edu.ph',
      is_active: 1,
      is_email_verified: 1,
      personal_email: 'maria@dnsc.edu.ph',
      personal_email_verified_at: new Date(),
      must_change_password: 0,
      role: 'student',
    };

    const { app } = loadTestApp({
      nodeEnv: 'development',
      queryImpl: async (sql) => {
        if (sql.includes('information_schema.COLUMNS')) return [[]];
        if (sql.startsWith('ALTER TABLE refresh_tokens')) throw new Error('ALTER command denied');
        if (sql.includes('FROM refresh_tokens')) {
          expect(sql).not.toContain('revoked_at');
          return [[{ id: 1, user_id: 9, token_hash: tokenHash, revoked: 0 }]];
        }
        if (sql.includes('UPDATE refresh_tokens SET revoked = 1')) {
          expect(sql).not.toContain('revoked_at');
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('WHERE u.id = ?')) return [[userRow]];
        if (sql.includes('INSERT INTO refresh_tokens')) return [{ insertId: 2 }];
        return [[]];
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${encodeURIComponent(token)}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  test('allows configured/same-host/dev-LAN origins and denies untrusted external CORS origins', async () => {
    const { app } = loadTestApp({
      nodeEnv: 'production',
      frontendUrl: 'http://localhost:3000, https://aces.dnsc.edu.ph',
      queryImpl: async () => [[1]],
    });

    const allowedConfigured = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://aces.dnsc.edu.ph')
      .set('Host', 'api.dnsc.edu.ph');
    expect(allowedConfigured.headers['access-control-allow-origin']).toBe('https://aces.dnsc.edu.ph');

    const deniedExternal = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com')
      .set('Host', 'localhost:3000');
    expect(deniedExternal.headers['access-control-allow-origin']).toBeUndefined();
  });
});

