const { errorHandler } = require('../src/middleware/errorHandler');
const { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } = require('../src/config/constants');
const db = require('../src/config/database');
const activitiesService = require('../src/modules/activities/activities.service');

describe('Activities & Uploads Resilience Suite', () => {
  describe('API Error Handler', () => {
    test('returns JSON response for API routes mounted under sub-routers (req.originalUrl)', () => {
      const err = new Error('Only PDF and DOCX files are allowed.');
      const req = {
        path: '/1/documents',
        originalUrl: '/api/v1/submissions/1/documents',
        headers: {},
      };
      const res = {
        statusCode: null,
        jsonData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.jsonData = data;
          return this;
        },
        redirect: jest.fn(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData).toEqual({
        success: false,
        message: 'Only PDF and DOCX files are allowed.',
      });
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test('returns JSON 413 for file size limit on API routes', () => {
      const err = { code: 'LIMIT_FILE_SIZE' };
      const req = {
        path: '/1/documents',
        originalUrl: '/api/v1/submissions/1/documents',
        headers: {},
      };
      const res = {
        statusCode: null,
        jsonData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.jsonData = data;
          return this;
        },
        redirect: jest.fn(),
      };
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(413);
      expect(res.jsonData).toEqual({
        success: false,
        message: 'File too large.',
      });
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('Allowed MIME Types & Extensions for Mobile Uploads', () => {
    test('includes mobile PDF and Word MIME types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('application/x-pdf');
      expect(ALLOWED_MIME_TYPES).toContain('application/octet-stream');
      expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(ALLOWED_EXTENSIONS).toEqual(['pdf', 'docx']);
    });
  });

  describe('Student Activities Listing Service', () => {
    let originalQuery;

    beforeAll(() => {
      originalQuery = db.query;
    });

    afterAll(() => {
      db.query = originalQuery;
    });

    test('listActivitiesForStudent executes without ReferenceError and returns proper payload', async () => {
      const mockMembership = {
        group_id: 10,
        department_id: 2,
        set_name: 'Set A',
        instructor_id: 5,
      };

      const mockActivities = [
        {
          id: 1,
          instructor_id: 5,
          department_id: 2,
          set_name: 'Set A',
          group_id: null,
          title: 'Chapter 1 Draft',
          description: 'Submit chapter 1',
          deadline: '2026-12-01T23:59:00.000Z',
          created_at: '2026-11-01T00:00:00.000Z',
          instructor_name: 'Prof. Davis',
          department_code: 'BSIT',
          submission_id: null,
          file_name: null,
          submitted_at: null,
          is_submitted: 0,
          is_late: 0,
        },
      ];

      db.query = jest.fn().mockImplementation((sql) => {
        if (sql.includes('FROM group_members gm')) {
          return Promise.resolve([[mockMembership]]);
        }
        if (sql.includes('FROM activities a')) {
          return Promise.resolve([mockActivities]);
        }
        return Promise.resolve([[]]);
      });

      const result = await activitiesService.listActivitiesForStudent(101);

      expect(result).toBeDefined();
      expect(result.has_group).toBe(true);
      expect(result.group_id).toBe(10);
      expect(result.set_name).toBe('Set A');
      expect(Array.isArray(result.activities)).toBe(true);
      expect(result.activities.length).toBe(1);
      expect(result.activities[0].title).toBe('Chapter 1 Draft');
    });

    test('listActivitiesForStudent handles students without a group gracefully', async () => {
      db.query = jest.fn().mockImplementation((sql) => {
        if (sql.includes('FROM group_members gm')) {
          return Promise.resolve([[]]); // no membership
        }
        if (sql.includes('FROM users WHERE id = ?')) {
          return Promise.resolve([[{ department_id: 2 }]]);
        }
        if (sql.includes('FROM activities a')) {
          return Promise.resolve([[]]);
        }
        return Promise.resolve([[]]);
      });

      const result = await activitiesService.listActivitiesForStudent(999);

      expect(result).toBeDefined();
      expect(result.has_group).toBe(false);
      expect(result.activities).toEqual([]);
    });
  });
});
