const { body, query, param } = require('express-validator');
const { ROLES } = require('../../config/constants');

const allRoles = Object.values(ROLES);

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('role').optional().isIn(allRoles),
  query('status').optional().isIn(['active', 'inactive']),
];

const createRules = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role').isIn(allRoles).withMessage('Invalid role'),
  body('department_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('student_number').optional({ nullable: true }).isString().trim(),
  body('is_active').optional().isBoolean(),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional({ nullable: true }).if(body('password').notEmpty())
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role').optional().isIn(allRoles),
  body('department_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('student_number').optional({ nullable: true }).isString().trim(),
  body('is_active').optional().isBoolean(),
];

const idRules = [param('id').isInt({ min: 1 })];

const resetPasswordRules = [
  param('id').isInt({ min: 1 }),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

module.exports = { listRules, createRules, updateRules, idRules, resetPasswordRules };
