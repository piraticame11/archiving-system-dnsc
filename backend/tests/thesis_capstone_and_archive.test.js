const groupsService = require('../src/modules/groups/groups.service');
const submissionsService = require('../src/modules/submissions/submissions.service');
const archiveService = require('../src/modules/archive/archive.service');
const db = require('../src/config/database');

describe('Thesis vs Capstone by Department and Archive Promotion Suite', () => {
  let originalQuery;
  let originalGetConnection;

  beforeAll(() => {
    originalQuery = db.query;
    originalGetConnection = db.getConnection;
  });

  afterAll(() => {
    db.query = originalQuery;
    db.getConnection = originalGetConnection;
  });

  describe('Group & Submission Type by Department', () => {
    test('createGroup assigns "capstone" when department is BSIT', async () => {
      let insertedType = null;
      const mockConn = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('INSERT INTO thesis_groups')) {
            // params: [groupName, join_code, leader_id, adviser_id, instructor_id, adviser_status, deptId, cleanSet, sy, cap, groupType]
            insertedType = params[10];
            return Promise.resolve([{ insertId: 101 }]);
          }
          if (sql.includes('INSERT INTO group_members')) {
            return Promise.resolve([{ insertId: 1 }]);
          }
          return Promise.resolve([[]]);
        }),
      };

      db.getConnection = jest.fn().mockResolvedValue(mockConn);
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('FROM group_members WHERE student_id = ?')) {
          return Promise.resolve([[]]); // leader not in group
        }
        if (sql.includes('FROM users WHERE id = ?')) {
          return Promise.resolve([[{ first_name: 'John', last_name: 'Doe', email: 'john@test.com', department_id: 1 }]]);
        }
        if (sql.includes('FROM departments WHERE id = ?')) {
          return Promise.resolve([[{ id: 1, code: 'BSIT', name: 'Bachelor of Science in Information Technology' }]]);
        }
        if (sql.includes('FROM school_years WHERE is_active = 1')) {
          return Promise.resolve([[{ label: '2026-2027' }]]);
        }
        if (sql.includes('FROM thesis_groups WHERE join_code = ?')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('SELECT tg.id, tg.name')) {
          return Promise.resolve([[{ id: 101, name: 'BSIT Group', type: insertedType, department_id: 1, department_code: 'BSIT' }]]);
        }
        return Promise.resolve([[]]);
      });

      const group = await groupsService.createGroup({
        leader_id: 1,
        department_id: 1,
        set_name: 'Set A',
        instructor_id: 2,
        member_names: ['Member A', 'Member B', 'Member C'],
      });

      expect(insertedType).toBe('capstone');
      expect(group.type).toBe('capstone');
    });

    test('createGroup assigns "thesis" when department is NOT BSIT (e.g. BSHM)', async () => {
      let insertedType = null;
      const mockConn = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('INSERT INTO thesis_groups')) {
            insertedType = params[10];
            return Promise.resolve([{ insertId: 102 }]);
          }
          if (sql.includes('INSERT INTO group_members')) {
            return Promise.resolve([{ insertId: 1 }]);
          }
          return Promise.resolve([[]]);
        }),
      };

      db.getConnection = jest.fn().mockResolvedValue(mockConn);
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('FROM group_members WHERE student_id = ?')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('FROM users WHERE id = ?')) {
          return Promise.resolve([[{ first_name: 'Jane', last_name: 'Smith', email: 'jane@test.com', department_id: 2 }]]);
        }
        if (sql.includes('FROM departments WHERE id = ?')) {
          return Promise.resolve([[{ id: 2, code: 'BSHM', name: 'Bachelor of Science in Hospitality Management' }]]);
        }
        if (sql.includes('FROM school_years WHERE is_active = 1')) {
          return Promise.resolve([[{ label: '2026-2027' }]]);
        }
        if (sql.includes('FROM thesis_groups WHERE join_code = ?')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('SELECT tg.id, tg.name')) {
          return Promise.resolve([[{ id: 102, name: 'BSHM Group', type: insertedType, department_id: 2, department_code: 'BSHM' }]]);
        }
        return Promise.resolve([[]]);
      });

      const group = await groupsService.createGroup({
        leader_id: 2,
        department_id: 2,
        set_name: 'Set B',
        instructor_id: 3,
        member_names: ['Member 1', 'Member 2', 'Member 3'],
      });

      expect(insertedType).toBe('thesis');
      expect(group.type).toBe('thesis');
    });

    test('getOrCreateGroupSubmission gives BSIT group capstone and BSHM group thesis', async () => {
      let subType = null;
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('SELECT id FROM thesis_submissions WHERE group_id = ?')) {
          return Promise.resolve([[]]); // no existing submission
        }
        if (sql.includes('SELECT tg.id, tg.name')) {
          return Promise.resolve([[{
            id: params[0],
            leader_id: 10,
            department_id: 1,
            department_code: 'BSIT',
            type: 'capstone',
            school_year: '2026-2027',
            title: 'Smart Farming IoT',
          }]]);
        }
        if (sql.includes('INSERT INTO thesis_submissions')) {
          // params: [leader_id, groupId, dept_id, adviser_id, title, subType, school_year]
          subType = params[5];
          return Promise.resolve([{ insertId: 55 }]);
        }
        if (sql.includes('FROM thesis_submissions ts')) {
          return Promise.resolve([[{
            id: 55,
            title: 'Smart Farming IoT',
            type: subType,
            school_year: '2026-2027',
            status: 'approved',
          }]]);
        }
        return Promise.resolve([[]]);
      });

      const sub = await submissionsService.getOrCreateGroupSubmission(101);
      expect(subType).toBe('capstone');
      expect(sub.type).toBe('capstone');
    });
  });

  describe('Promote to Archive Supports Both Full Document and IMRAD', () => {
    test('promoteToArchive accepts IMRaD document', async () => {
      let insertedDocId = null;
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('SELECT ts.*, d.id AS dept_id')) {
          return Promise.resolve([[{
            id: 10,
            title: 'Research Study Title',
            abstract: 'Abstract text',
            keywords: 'study, research',
            school_year: '2026-2027',
            semester: '1st',
            type: 'thesis',
            dept_id: 2,
            status: 'approved',
            deleted_at: null,
          }]]);
        }
        if (sql.includes('SELECT id FROM archive WHERE submission_id = ?')) {
          return Promise.resolve([[]]); // not yet archived
        }
        if (sql.includes('SELECT id, file_path, mime_type, file_name FROM submission_documents')) {
          // doc check: doc_type IN ('full_document', 'imrad')
          return Promise.resolve([[{
            id: 77,
            file_path: 'uploads/docs/imrad.pdf',
            mime_type: 'application/pdf',
            file_name: 'manuscript_imrad.pdf',
            doc_type: 'imrad',
          }]]);
        }
        if (sql.includes('INSERT INTO archive')) {
          insertedDocId = params[1];
          return Promise.resolve([{ insertId: 999 }]);
        }
        if (sql.includes('FROM archive a')) {
          return Promise.resolve([[{
            id: 999,
            title: 'Research Study Title',
            document_id: insertedDocId,
            file_name: 'manuscript_imrad.pdf',
            type: 'thesis',
          }]]);
        }
        return Promise.resolve([[]]);
      });

      const result = await archiveService.promoteToArchive({
        submission_id: 10,
        document_id: 77,
        authors: 'Author One, Author Two',
        adviser: 'Adviser Name',
        keywords: 'test, keywords',
        archived_by: 1,
      });

      expect(insertedDocId).toBe(77);
      expect(result.id).toBe(999);
      expect(result.document_id).toBe(77);
    });

    test('promoteToArchive rejects non-promotable doc_type (e.g. title_proposal)', async () => {
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('SELECT ts.*, d.id AS dept_id')) {
          return Promise.resolve([[{
            id: 10,
            title: 'Research Title',
            school_year: '2026-2027',
            semester: '1st',
            type: 'thesis',
            dept_id: 2,
            status: 'approved',
            deleted_at: null,
          }]]);
        }
        if (sql.includes('SELECT id FROM archive WHERE submission_id = ?')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('SELECT id, file_path, mime_type, file_name FROM submission_documents')) {
          // returns empty because doc_type is title_proposal
          return Promise.resolve([[]]);
        }
        return Promise.resolve([[]]);
      });

      await expect(
        archiveService.promoteToArchive({
          submission_id: 10,
          document_id: 12,
          authors: 'Author Name',
          archived_by: 1,
        })
      ).rejects.toThrow('Only full documents or IMRaD manuscripts can be archived');
    });

    test('promoteToArchive forces "thesis" type when department is not BSIT even if submission was capstone', async () => {
      let insertedType = null;
      let updatedSubmissionType = null;
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('SELECT ts.*, d.id AS dept_id')) {
          return Promise.resolve([[{
            id: 15,
            title: 'Business Research Paper',
            abstract: 'Abstract text',
            keywords: 'business, finance',
            school_year: '2026-2027',
            semester: '1st',
            type: 'capstone', // mistakenly capstone
            dept_id: 3,
            dept_code: 'BSBA', // non-IT
            status: 'approved',
            deleted_at: null,
          }]]);
        }
        if (sql.includes('SELECT id FROM archive WHERE submission_id = ?')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('SELECT id, file_path, mime_type, file_name FROM submission_documents')) {
          return Promise.resolve([[{
            id: 88,
            file_path: '',
            mime_type: 'application/pdf',
            file_name: 'paper.pdf',
            doc_type: 'full_document',
          }]]);
        }
        if (sql.includes('UPDATE thesis_submissions SET type = ?')) {
          updatedSubmissionType = params[0];
          return Promise.resolve([{ affectedRows: 1 }]);
        }
        if (sql.includes('INSERT INTO archive')) {
          // params: [submission_id, document_id, title, abstract, authors, adviser, dept_id, sy, sem, keywords, correctType, ...]
          insertedType = params[10];
          return Promise.resolve([{ insertId: 1001 }]);
        }
        if (sql.includes('FROM archive a')) {
          return Promise.resolve([[{
            id: 1001,
            title: 'Business Research Paper',
            document_id: 88,
            type: insertedType,
          }]]);
        }
        return Promise.resolve([[]]);
      });

      const result = await archiveService.promoteToArchive({
        submission_id: 15,
        document_id: 88,
        authors: 'Business Student',
        adviser: 'Prof. Smith',
        keywords: 'business',
        archived_by: 1,
      });

      expect(insertedType).toBe('thesis');
      expect(updatedSubmissionType).toBe('thesis');
      expect(result.type).toBe('thesis');
    });
  });
});
