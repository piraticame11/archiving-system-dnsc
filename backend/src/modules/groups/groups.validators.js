const { body, param } = require('express-validator');
const schoolYearsService = require('../school_years/school_years.service');

async function validSchoolYear(value) {
  const ok = await schoolYearsService.isValidActiveLabel(value);
  if (!ok) throw new Error('Select a valid, active school year.');
  return true;
}

const createRules = [
  body('name').trim().notEmpty().withMessage('Group name is required')
    .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer'),
  body('school_year').trim().notEmpty().withMessage('School year is required').custom(validSchoolYear),
  body('type').isIn(['thesis', 'capstone']).withMessage('Type must be "thesis" or "capstone"'),
  body('adviser_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('max_members').optional().isInt({ min: 4, max: 6 }).withMessage('Member capacity must be between 4 and 6'),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('school_year').optional().trim().custom(validSchoolYear),
  body('type').optional().isIn(['thesis', 'capstone']).withMessage('Type must be "thesis" or "capstone"'),
  body('adviser_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('max_members').optional().isInt({ min: 4, max: 6 }),
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

module.exports = { createRules, updateRules, joinRules, idRules, requestActionRules, memberRules };
