const router = require('express').Router();
const ctrl   = require('./imrad_templates.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { uploadImrad }      = require('../../config/multer');
const v = require('./imrad_templates.validators');

const adminOnly      = [verifyToken, requireRole('admin', 'superadmin')];
const staffAndAbove  = [verifyToken, requireRole('admin', 'superadmin', 'instructor', 'panelist', 'student')];

router.get(   '/',             staffAndAbove,                                                    ctrl.list);
router.post(  '/',             adminOnly,     uploadImrad.single('file'), v.createRules, handleValidation, ctrl.upload);
router.get(   '/:id/download', staffAndAbove, v.idRules, handleValidation,              ctrl.download);
router.delete('/:id',          adminOnly,     v.idRules, handleValidation,              ctrl.remove);

module.exports = router;
