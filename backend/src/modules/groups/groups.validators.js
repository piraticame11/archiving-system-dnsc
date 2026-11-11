const { body, param } = require('express-validator');
const schoolYearsService = require('../school_years/school_years.service');

async function validSchoolYear(value) {
  const ok = await schoolYearsService.isValidActiveLabel(value);
  if (!ok) throw new Error('Select a valid, active school year.');
  return true;
}

const createRules = [
  body('department_id').notEmpty().withMessage('Program is required').isInt({ min: 1 }).withMessage('Valid program is required'),
  body('set_name').notEmpty().withMessage('Set is required').trim().isLength({ max: 50 }).withMessage('Set must be 50 characters or fewer'),
  body('instructor_id').notEmpty().withMessage('Instructor is required').isInt({ min: 1 }).withMessage('Valid instructor is required'),
  body('adviser_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('member_names').optional(),
  body('name').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('school_year').optional({ nullable: true }).trim().custom(async (val) => {
    if (!val) return true;
    return validSchoolYear(val);
  }),
  body('type').optional({ nullable: true }).isIn(['thesis', 'capstone']),
  body('max_members').optional({ nullable: true }).isInt({ min: 1, max: 20 }),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('department_id').optional().isInt({ min: 1 }),
  body('set_name').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('instructor_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('adviser_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('school_year').optional().trim().custom(validSchoolYear),
  body('type').optional().isIn(['thesis', 'capstone']).withMessage('Type must be "thesis" or "capstone"'),
  body('max_members').optional().isInt({ min: 1, max: 20 }),
];

const joinRules = [
  body('join_code').trim().notEmpty().withMessage('Join code is required')
    .matches(/^\d{6}$/).withMessage('Join code must be a 6-digit number'),
];

const idRules = [param('id').isInt({ min: 1 })];

const requestActionRules = [
  param('id').isInt({ min: 1 }),
  param('requestId').isInt({ min: 1 }),
];

const memberRules = [
  param('id').isInt({ min: 1 }),
  param('studentId').isInt({ min: 1 }),
];

const addMemberRules = [
  param('id').isInt({ min: 1 }),
  body('name').trim().notEmpty().withMessage('Member name is required').isLength({ max: 255 }),
];

module.exports = { createRules, updateRules, joinRules, idRules, requestActionRules, memberRules, addMemberRules };
