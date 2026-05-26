const { body, param } = require('express-validator');

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional({ nullable: true }).isString().trim(),
];

const idRules = [param('id').isInt({ min: 1 })];

module.exports = { createRules, idRules };
