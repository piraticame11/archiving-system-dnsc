const { body, query, param } = require('express-validator');

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('schedule_id').optional().isInt({ min: 1 }),
  query('panelist_id').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['pending', 'submitted']),
];

const upsertRules = [
  body('schedule_id').isInt({ min: 1 }).withMessage('Schedule is required'),
  body('group_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('group_id must be a positive integer'),
  body('score').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).withMessage('Score must be 0–100'),
  body('remarks').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body('submit').optional().isBoolean(),
];

const idRules = [param('id').isInt({ min: 1 })];

const scheduleIdRules = [param('scheduleId').isInt({ min: 1 })];

module.exports = { listRules, upsertRules, idRules, scheduleIdRules };
