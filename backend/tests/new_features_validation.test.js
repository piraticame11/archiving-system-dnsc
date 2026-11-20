const schedulesService = require('../src/modules/schedules/schedules.service');
const evaluationsService = require('../src/modules/evaluations/evaluations.service');
const submissionsService = require('../src/modules/submissions/submissions.service');
const adviserController = require('../src/modules/adviser/adviser.controller');
const db = require('../src/config/database');

describe('New Features Validation Suite', () => {
  let originalQuery;
  let originalGetConnection;

  beforeAll(() => {
    originalQuery = db.query;
    originalGetConnection = db.getConnection;
  });

  beforeEach(() => {
    db.query = jest.fn().mockImplementation((sql) => {
      if (sql.includes('FROM system_settings')) {
        return Promise.resolve([[{ value: 'true' }]]);
      }
      return Promise.resolve([[]]);
    });
  });

  afterAll(() => {
    db.query = originalQuery;
    db.getConnection = originalGetConnection;
  });

  describe('Admin Schedule Date Validation', () => {
    test('createSchedule rejects past date', async () => {
      await expect(schedulesService.createSchedule({
        venue_id: 1,
        defense_type: 'proposal',
        scheduled_date: '2020-01-01',
        time_slots: ['8:00-8:30'],
        panelists: [{ id: 1, role: 'chairperson' }, { id: 2, role: 'member' }, { id: 3, role: 'member' }, { id: 4, role: 'member' }],
        group_ids: [1],
        created_by: 1,
      })).rejects.toThrow('Defense schedule date must be in the future');
    });

    test('createSchedule rejects current date (today)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await expect(schedulesService.createSchedule({
        venue_id: 1,
        defense_type: 'proposal',
        scheduled_date: today,
        time_slots: ['8:00-8:30'],
        panelists: [{ id: 1, role: 'chairperson' }, { id: 2, role: 'member' }, { id: 3, role: 'member' }, { id: 4, role: 'member' }],
        group_ids: [1],
        created_by: 1,
      })).rejects.toThrow('Defense schedule date must be in the future');
    });

    test('autoSchedule rejects today or past start_date', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await expect(schedulesService.autoSchedule({
        defense_type: 'proposal',
        start_date: today,
        end_date: '2099-12-31',
        group_ids: [1],
      })).rejects.toThrow('Auto-schedule start date must be in the future');
    });
  });

  describe('Adviser Settings Capacity Limit of 3', () => {
    test('updateSettings rejects capacity greater than 3', async () => {
      const req = { body: { max_advisee_groups: 4 }, user: { id: 10 } };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status: (s) => {
          statusSent = s;
          return {
            json: (j) => { jsonSent = j; }
          };
        }
      };
      await adviserController.updateSettings(req, res, () => {});
      expect(statusSent).toBe(400);
      expect(jsonSent.message).toContain('between 1 and 3');
    });

    test('updateSettings rejects capacity less than 1', async () => {
      const req = { body: { max_advisee_groups: 0 }, user: { id: 10 } };
      let statusSent = null;
      let jsonSent = null;
      const res = {
        status: (s) => {
          statusSent = s;
          return {
            json: (j) => { jsonSent = j; }
          };
        }
      };
      await adviserController.updateSettings(req, res, () => {});
      expect(statusSent).toBe(400);
      expect(jsonSent.message).toContain('between 1 and 3');
    });
  });

  describe('Promote to Archive Authors & Adviser Pre-fill', () => {
    test('submissionsService.getById attaches group authors and group adviser', async () => {
      db.query = jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('FROM thesis_submissions ts') && sql.includes('WHERE ts.id = ?')) {
          return Promise.resolve([[{
            id: 1,
            title: 'Sample Thesis Title',
            group_id: 10,
            student_id: 5,
            student_name: 'Lead Student',
            adviser_name: null,
            adviser_id: null,
            status: 'approved',
          }]]);
        }
        if (sql.includes('FROM submission_documents sd')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('FROM submission_history sh')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('FROM thesis_group_members gm') || sql.includes('FROM group_members gm')) {
          return Promise.resolve([[
            { member_name: 'Leader Student', role: 'leader' },
            { member_name: 'Member Two', role: 'member' },
            { member_name: 'Member Three', role: 'member' },
          ]]);
        }
        if (sql.includes('FROM thesis_groups tg')) {
          return Promise.resolve([[{ adviser_name: 'Dr. Jane Adviser' }]]);
        }
        return Promise.resolve([[]]);
      });

      const sub = await submissionsService.getById(1);
      expect(sub).toBeDefined();
      expect(sub.authors).toBe('Leader Student, Member Two, Member Three');
      expect(sub.adviser_name).toBe('Dr. Jane Adviser');
    });
  });

  describe('Panelist Evaluation Score Validation', () => {
    test('upsertEvaluation rejects submit if any criterion score is 0 or less', async () => {
      const mockConn = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('FROM schedule_panelists')) {
            return Promise.resolve([[{ 1: 1 }]]);
          }
          if (sql.includes('FROM defense_schedules')) {
            return Promise.resolve([[{ submission_id: 1 }]]);
          }
          if (sql.includes('FROM evaluations')) {
            return Promise.resolve([[]]);
          }
          if (sql.includes('INSERT INTO evaluations')) {
            return Promise.resolve([{ insertId: 50 }]);
          }
          if (sql.includes('FROM evaluation_criteria')) {
            return Promise.resolve([[
              { id: 1, rubric_group: 'research_output', name: 'Originality', max_score: 50 },
              { id: 2, rubric_group: 'oral_presentation', name: 'Clarity', max_score: 50 },
            ]]);
          }
          if (sql.includes('DELETE FROM scores') || sql.includes('INSERT INTO scores')) {
            return Promise.resolve([{ affectedRows: 1 }]);
          }
          return Promise.resolve([[]]);
        }),
      };

      db.getConnection = jest.fn().mockResolvedValue(mockConn);
      db.query = jest.fn().mockImplementation((sql) => {
        if (sql.includes('FROM evaluation_criteria')) {
          return Promise.resolve([[
            { id: 1, rubric_group: 'research_output', name: 'Originality', max_score: 50 },
            { id: 2, rubric_group: 'oral_presentation', name: 'Clarity', max_score: 50 },
          ]]);
        }
        return Promise.resolve([[]]);
      });

      await expect(evaluationsService.upsertEvaluation({
        schedule_id: 1,
        panelist_id: 2,
        decision: 'approved',
        remarks: 'Good',
        submit: true,
        scores: [
          { criteria_id: 1, raw_score: 0 },
          { criteria_id: 2, raw_score: 40 },
        ],
      })).rejects.toThrow('All criteria scores must be greater than 0');
    });
  });
});
