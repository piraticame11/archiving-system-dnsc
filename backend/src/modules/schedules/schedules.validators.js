const { body, query, param } = require('express-validator');

const STATUSES   = ['scheduled', 'completed', 'cancelled', 'rescheduled'];
const TIME_SLOTS = [
  '8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-12:00',
  '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00',
];

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(STATUSES),
  query('from_date').optional().isDate(),
  query('to_date').optional().isDate(),
];

const calendarRules = [
  query('from_date').isDate().withMessage('from_date (YYYY-MM-DD) is required'),
  query('to_date').isDate().withMessage('to_date (YYYY-MM-DD) is required'),
];

const createRules = [
  body('venue_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('scheduled_date').isDate().withMessage('Valid date (YYYY-MM-DD) is required'),
  body('time_slots').isArray({ min: 1 }).withMessage('At least one timeslot is required'),
  body('time_slots.*').isIn(TIME_SLOTS).withMessage('Invalid timeslot value'),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('panelist_ids').optional().isArray(),
  body('panelist_ids.*').optional().isInt({ min: 1 }),
  body('group_ids').optional().isArray(),
  body('group_ids.*').optional().isInt({ min: 1 }),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('venue_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('scheduled_date').optional().isDate(),
  body('time_slots').optional().isArray({ min: 1 }),
  body('time_slots.*').optional().isIn(TIME_SLOTS),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('panelist_ids').optional().isArray(),
  body('panelist_ids.*').optional().isInt({ min: 1 }),
  body('group_ids').optional().isArray(),
  body('group_ids.*').optional().isInt({ min: 1 }),
];

const statusRules = [
  param('id').isInt({ min: 1 }),
  body('status').isIn(STATUSES).withMessage('Invalid status'),
];

const idRules = [param('id').isInt({ min: 1 })];

module.exports = { listRules, calendarRules, createRules, updateRules, statusRules, idRules };
