const router = require('express').Router();
const ctrl   = require('./adviser.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { uploadCsv }        = require('../../config/multer');

const instructorOnly = [verifyToken, requireRole('instructor')];

router.get( '/my-advisees',  instructorOnly, ctrl.myAdvisees);
router.post('/upload-list',  instructorOnly, uploadCsv.single('file'), ctrl.uploadList);

module.exports = router;
