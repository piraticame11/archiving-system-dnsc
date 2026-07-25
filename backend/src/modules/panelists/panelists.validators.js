const { body, query, param } = require('express-validator');

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'inactive']),
  query('department_id').optional().isInt({ min: 1 }),
];

const PANELIST_TYPES = ['regular', 'industry'];

const createRules = [
  body('first_name').trim().notEmpty().withMessage('First name is required').isLength({ max: 80 }),
  body('last_name').trim().notEmpty().withMessage('Last name is required').isLength({ max: 80 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('department_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('panelist_type').optional().isIn(PANELIST_TYPES).withMessage('panelist_type must be "regular" or "industry"'),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('first_name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('last_name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('department_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('panelist_type').optional().isIn(PANELIST_TYPES).withMessage('panelist_type must be "regular" or "industry"'),
  body('max_groups').optional({ nullable: true }).isInt({ min: 1 }).withMessage('max_groups must be a positive integer'),
];

const resetPasswordRules = [
  param('id').isInt({ min: 1 }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const idRules = [param('id').isInt({ min: 1 })];

const unavailabilityRules = [
  param('id').isInt({ min: 1 }),
  body('date').isISO8601().withMessage('A valid date is required').custom(v => {
    const d = new Date(v);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d < today) throw new Error('Date cannot be in the past');
    return true;
  }),
  body('reason').optional({ nullable: true }).trim().isLength({ max: 255 }),
];

const unavailabilityIdRules = [
  param('id').isInt({ min: 1 }),
  param('unavailId').isInt({ min: 1 }),
];

module.exports = {
  listRules, createRules, updateRules, resetPasswordRules, idRules,
  unavailabilityRules, unavailabilityIdRules,
};
