const { body, query, param } = require('express-validator');

const listRules = [
  query('include_inactive').optional().isIn(['true', 'false', '1', '0']),
];

const createRules = [
  body('label').trim().notEmpty().withMessage('Label is required')
    .matches(/^\d{4}-\d{4}$/).withMessage('School year must be in YYYY-YYYY format'),
];

const idRules = [param('id').isInt({ min: 1 })];

module.exports = { listRules, createRules, idRules };
