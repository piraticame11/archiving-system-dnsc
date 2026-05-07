const { body, query, param } = require('express-validator');

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('department_id').optional().isInt({ min: 1 }),
  query('school_year').optional().isString().trim(),
  query('semester').optional().isIn(['1st', '2nd', 'summer']),
  query('type').optional().isIn(['thesis', 'capstone']),
];

const eligibleRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const promoteRules = [
  body('submission_id').isInt({ min: 1 }).withMessage('submission_id is required'),
  body('document_id').isInt({ min: 1 }).withMessage('document_id is required'),
  body('authors').trim().notEmpty().withMessage('Authors are required'),
  body('adviser').optional({ nullable: true }).isString().trim(),
  body('keywords').optional({ nullable: true }).isString().trim(),
];

const idRules = [param('id').isInt({ min: 1 })];

module.exports = { listRules, eligibleRules, promoteRules, idRules };
