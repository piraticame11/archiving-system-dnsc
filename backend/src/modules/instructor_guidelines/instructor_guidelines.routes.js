const router = require('express').Router();
const ctrl   = require('./instructor_guidelines.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { uploadGuideline }  = require('../../config/multer');
const v = require('./instructor_guidelines.validators');

const instructorAndAbove = [verifyToken, requireRole('admin', 'superadmin', 'instructor')];
const staffAndAbove      = [verifyToken, requireRole('admin', 'superadmin', 'instructor', 'panelist')];

// List all guidelines — visible to all staff
router.get('/', staffAndAbove, ctrl.list);

// Upload a guideline — instructors and above
router.post('/', instructorAndAbove, uploadGuideline.single('file'), v.createRules, handleValidation, ctrl.upload);

// Download a guideline — all staff
router.get('/:id/download', staffAndAbove, v.idRules, handleValidation, ctrl.download);

// Delete — own uploads (instructors) or admins
router.delete('/:id', instructorAndAbove, v.idRules, handleValidation, ctrl.remove);

module.exports = router;
