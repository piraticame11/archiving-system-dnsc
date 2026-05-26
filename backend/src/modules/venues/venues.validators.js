const { body, query, param } = require('express-validator');

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('include_inactive').optional().isIn(['true', 'false', '1', '0']),
];

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('location').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('capacity').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('location').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('capacity').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
];

const idRules = [param('id').isInt({ min: 1 })];

module.exports = { listRules, createRules, updateRules, idRules };
