const router = require('express').Router();
const ctrl   = require('./submissions.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { uploadDocument }   = require('../../config/multer');
const v = require('./submissions.validators');

const auth      = [verifyToken];
const adminOnly = [verifyToken, requireRole('admin', 'superadmin')];
const studentOnly = [verifyToken, requireRole('student')];

/* stats — admin / superadmin */
router.get('/stats', adminOnly, ctrl.stats);

/* list — all authenticated (scoped by role in controller) */
router.get('/',    auth, v.listRules,   handleValidation, ctrl.list);
router.get('/:id', auth, v.idRules,     handleValidation, ctrl.getOne);

/* student's group submission — get-or-create, used only as the document/archive anchor */
router.get('/my-group-submission', studentOnly, ctrl.myGroupSubmission);

/* admin deletes / updates status */
router.delete('/:id',       auth,      v.idRules,     handleValidation, ctrl.remove);
router.patch('/:id/status', adminOnly, v.statusRules, handleValidation, ctrl.updateStatus);

/* document upload — student (own) or admin */
router.post(
  '/:id/documents',
  auth,
  uploadDocument.single('file'),
  v.docRules,
  handleValidation,
  ctrl.uploadDocument
);

/* document view / download */
router.get('/:id/documents/:docId/view', auth, v.docViewRules, handleValidation, ctrl.viewDocument);

module.exports = router;
