const { body, query, param } = require('express-validator');

const STATUSES = ['scheduled', 'completed', 'cancelled', 'rescheduled'];

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(STATUSES),
  query('from_date').optional().isISO8601(),
  query('to_date').optional().isISO8601(),
];

const createRules = [
  body('submission_id').isInt({ min: 1 }).withMessage('Submission is required'),
  body('venue_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('scheduled_at').isISO8601().withMessage('Valid date/time is required'),
  body('duration_min').optional().isInt({ min: 15, max: 480 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('panelist_ids').optional().isArray(),
  body('panelist_ids.*').optional().isInt({ min: 1 }),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('venue_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('scheduled_at').optional().isISO8601(),
  body('duration_min').optional().isInt({ min: 15, max: 480 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('panelist_ids').optional().isArray(),
  body('panelist_ids.*').optional().isInt({ min: 1 }),
];

const statusRules = [
  param('id').isInt({ min: 1 }),
  body('status').isIn(STATUSES).withMessage('Invalid status'),
];

const idRules = [param('id').isInt({ min: 1 })];

module.exports = { listRules, createRules, updateRules, statusRules, idRules };
