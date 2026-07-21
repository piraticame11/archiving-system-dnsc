const { body, query, param } = require('express-validator');
const { SLOTS_BY_TYPE } = require('./schedules.service');

const STATUSES      = ['scheduled', 'completed', 'cancelled', 'rescheduled'];
const DEFENSE_TYPES = ['proposal', 'final'];
const PANEL_ROLES    = ['chairperson', 'industry_panelist', 'member'];
const ALL_SLOTS      = [...new Set([...SLOTS_BY_TYPE.proposal, ...SLOTS_BY_TYPE.final])];

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
  body('defense_type').isIn(DEFENSE_TYPES).withMessage('defense_type must be "proposal" or "final"'),
  body('scheduled_date').isDate().withMessage('Valid date (YYYY-MM-DD) is required'),
  body('time_slots').isArray({ min: 1, max: 1 }).withMessage('Exactly one timeslot is required'),
  body('time_slots.*').isIn(ALL_SLOTS).withMessage('Invalid timeslot value'),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('panelists').optional().isArray(),
  body('panelists.*.panelist_id').optional().isInt({ min: 1 }),
  body('panelists.*.role').optional().isIn(PANEL_ROLES).withMessage('Panel role must be chairperson, industry_panelist, or member'),
  body('group_ids').optional().isArray(),
  body('group_ids.*').optional().isInt({ min: 1 }),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('venue_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('defense_type').optional().isIn(DEFENSE_TYPES).withMessage('defense_type must be "proposal" or "final"'),
  body('scheduled_date').optional().isDate(),
  body('time_slots').optional().isArray({ min: 1, max: 1 }),
  body('time_slots.*').optional().isIn(ALL_SLOTS),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('panelists').optional().isArray(),
  body('panelists.*.panelist_id').optional().isInt({ min: 1 }),
  body('panelists.*.role').optional().isIn(PANEL_ROLES).withMessage('Panel role must be chairperson, industry_panelist, or member'),
  body('group_ids').optional().isArray(),
  body('group_ids.*').optional().isInt({ min: 1 }),
];

const statusRules = [
  param('id').isInt({ min: 1 }),
  body('status').isIn(STATUSES).withMessage('Invalid status'),
];

const idRules = [param('id').isInt({ min: 1 })];

const autoScheduleStatusRules = [
  body('enabled').isBoolean().withMessage('enabled must be true or false'),
];

const eligibleGroupsRules = [
  query('defense_type').isIn(DEFENSE_TYPES).withMessage('defense_type must be "proposal" or "final"'),
];

const autoScheduleRules = [
  body('defense_type').isIn(DEFENSE_TYPES).withMessage('defense_type must be "proposal" or "final"'),
  body('group_ids').isArray({ min: 1 }).withMessage('Select at least one group'),
  body('group_ids.*').isInt({ min: 1 }),
  body('start_date').isDate().withMessage('Valid start_date (YYYY-MM-DD) is required'),
  body('end_date').isDate().withMessage('Valid end_date (YYYY-MM-DD) is required'),
  body('venue_ids').optional().isArray(),
  body('venue_ids.*').optional().isInt({ min: 1 }),
  body('panelist_ids').optional().isArray(),
  body('panelist_ids.*').optional().isInt({ min: 1 }),
];

module.exports = {
  listRules, calendarRules, createRules, updateRules, statusRules, idRules,
  autoScheduleStatusRules, eligibleGroupsRules, autoScheduleRules,
};
