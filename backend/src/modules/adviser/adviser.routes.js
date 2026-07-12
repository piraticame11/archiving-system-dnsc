const router = require('express').Router();
const ctrl   = require('./adviser.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { uploadCsv, uploadExcel } = require('../../config/multer');

const instructorOnly = [verifyToken, requireRole('instructor')];
const anyAuth        = [verifyToken];

router.get(  '/list',                    anyAuth,        ctrl.listAdvisers);
router.get(  '/my-advisees',             instructorOnly, ctrl.myAdvisees);
router.get(  '/my-students',             instructorOnly, ctrl.myStudents);
router.get(  '/my-groups',               instructorOnly, ctrl.myGroups);
router.delete('/my-groups/:id',          instructorOnly, ctrl.removeGroup);
router.post( '/upload-list',             instructorOnly, uploadCsv.single('file'), ctrl.uploadList);
router.get(  '/import-template',         instructorOnly, ctrl.downloadImportTemplate);
router.post( '/import-students',         instructorOnly, uploadExcel.single('file'), ctrl.importStudents);
router.post( '/export-credentials',      instructorOnly, ctrl.exportCredentials);
router.get(  '/submitted-titles',        instructorOnly, ctrl.submittedTitles);
router.patch('/submissions/:id/approve', instructorOnly, ctrl.approveTitle);
router.patch('/submissions/:id/reject',  instructorOnly, ctrl.rejectTitle);

module.exports = router;
