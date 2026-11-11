const router = require('express').Router();
const ctrl   = require('./activities.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { uploadDocument }   = require('../../config/multer');
const v = require('./activities.validators');

const instructorOnly = [verifyToken, requireRole('instructor')];
const studentOnly    = [verifyToken, requireRole('student')];
const authenticated  = [verifyToken];

/* List activities (instructor sees created, student sees assigned) */
router.get('/', authenticated, ctrl.list);

/* Instructor sets & groups metadata for activity assignment */
router.get('/meta/sets', instructorOnly, ctrl.instructorSets);

/* Create new activity */
router.post('/', instructorOnly, v.createRules, handleValidation, ctrl.create);

/* Get single activity details */
router.get('/:id', authenticated, v.idRules, handleValidation, ctrl.getOne);

/* Delete activity */
router.delete('/:id', instructorOnly, v.idRules, handleValidation, ctrl.remove);

/* Submit file for activity (Student) */
router.post('/:id/submit', studentOnly, uploadDocument.single('file'), v.idRules, handleValidation, ctrl.submit);

/* List submissions for activity (Instructor) */
router.get('/:id/submissions', instructorOnly, v.idRules, handleValidation, ctrl.submissions);

/* View / download submission file */
router.get('/:id/submissions/:submissionId/file', authenticated, v.idRules, v.submissionIdRules, handleValidation, ctrl.downloadFile);

module.exports = router;

