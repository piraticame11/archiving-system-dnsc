const { body, param } = require('express-validator');

const createRules = [
  body('title').trim().notEmpty().withMessage('Activity title is required').isLength({ max: 255 }).withMessage('Title must be 255 characters or fewer'),
  body('deadline').notEmpty().withMessage('Deadline is required'),
  body('department_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('set_name').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('group_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('description').optional({ nullable: true }).trim(),
];

const idRules = [param('id').isInt({ min: 1 })];
const submissionIdRules = [param('submissionId').isInt({ min: 1 })];

module.exports = {
  createRules,
  idRules,
  submissionIdRules,
};

