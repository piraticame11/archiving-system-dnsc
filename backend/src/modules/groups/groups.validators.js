const { body, param } = require('express-validator');

const createRules = [
  body('name').trim().notEmpty().withMessage('Group name is required')
    .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer'),
  body('title').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('school_year').trim().notEmpty().withMessage('School year is required')
    .matches(/^\d{4}-\d{4}$/).withMessage('School year must be in YYYY-YYYY format'),
  body('adviser_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('max_members').optional().isInt({ min: 4, max: 6 }).withMessage('Member capacity must be between 4 and 6'),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('title').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('school_year').optional().trim().matches(/^\d{4}-\d{4}$/),
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
