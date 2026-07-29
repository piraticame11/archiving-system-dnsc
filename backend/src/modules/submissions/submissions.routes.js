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

/* student's group submission — get-or-create, used only as the document/archive anchor.
   Must be registered before the generic '/:id' route below, or Express matches
   '/:id' first and rejects "my-group-submission" as an invalid integer id. */
router.get('/my-group-submission', studentOnly, ctrl.myGroupSubmission);

router.get('/:id', auth, v.idRules,     handleValidation, ctrl.getOne);

/* admin deletes / updates status */
router.delete('/:id',       auth,      v.idRules,     handleValidation, ctrl.remove);
router.patch('/:id/status', adminOnly, v.statusRules, handleValidation, ctrl.updateStatus);

/* group leader renames their submission's title */
router.patch('/:id/title', auth, v.titleRules, handleValidation, ctrl.updateTitle);

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
