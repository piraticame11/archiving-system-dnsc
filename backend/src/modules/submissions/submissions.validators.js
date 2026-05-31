const { body, query, param } = require('express-validator');

const SEMESTERS = ['1st', '2nd', 'summer'];
const TYPES     = ['thesis', 'capstone'];
const STATUSES  = ['submitted', 'under_review', 'approved', 'rejected', 'revision_required'];
const DOC_TYPES = ['title_proposal', 'full_document', 'imrad', 'presentation', 'other'];

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(STATUSES),
  query('department_id').optional().isInt({ min: 1 }),
  query('type').optional().isIn(TYPES),
  query('school_year').optional().isString().trim(),
  query('semester').optional().isIn(SEMESTERS),
];

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 500 }).withMessage('Title must be 500 characters or fewer'),
  body('adviser_id').isInt({ min: 1 }).withMessage('Please select an adviser'),
  body('type').isIn(TYPES).withMessage('Type must be thesis or capstone'),
  body('school_year').trim().notEmpty().withMessage('School year is required')
    .matches(/^\d{4}-\d{4}$/).withMessage('School year must be in YYYY-YYYY format'),
  body('semester').isIn(SEMESTERS).withMessage('Invalid semester'),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('title').optional().trim().notEmpty().isLength({ max: 500 }),
  body('type').optional().isIn(TYPES),
  body('school_year').optional().trim().matches(/^\d{4}-\d{4}$/),
  body('semester').optional().isIn(SEMESTERS),
];

const statusRules = [
  param('id').isInt({ min: 1 }),
  body('status').isIn(STATUSES).withMessage('Invalid status'),
  body('remarks').optional({ nullable: true }).isString().trim()
    .isLength({ max: 1000 }).withMessage('Remarks must be 1000 characters or fewer'),
];

const docRules = [
  param('id').isInt({ min: 1 }),
  body('doc_type').isIn(DOC_TYPES).withMessage('Invalid document type'),
];

const idRules = [param('id').isInt({ min: 1 })];

const docViewRules = [
  param('id').isInt({ min: 1 }),
  param('docId').isInt({ min: 1 }),
];

module.exports = { listRules, createRules, updateRules, statusRules, docRules, docViewRules, idRules };
