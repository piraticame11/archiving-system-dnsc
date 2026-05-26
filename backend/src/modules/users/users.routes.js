const router     = require('express').Router();
const ctrl       = require('./users.controller');
const { verifyToken }     = require('../../middleware/auth');
const { requireRole }     = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { uploadExcel }     = require('../../config/multer');
const v          = require('./users.validators');

const adminGuard      = [verifyToken, requireRole('admin', 'superadmin')];
const superAdminGuard = [verifyToken, requireRole('superadmin')];

router.get(   '/import-template',     adminGuard,                                                          ctrl.downloadImportTemplate);
router.post(  '/import-students',     adminGuard,      uploadExcel.single('file'),                         ctrl.importStudents);
router.post(  '/export-credentials',  adminGuard,                                                          ctrl.exportCredentials);
router.get(   '/',                    adminGuard,      v.listRules,          handleValidation, ctrl.list);
router.post(  '/',                    superAdminGuard, v.createRules,        handleValidation, ctrl.create);
router.get(   '/:id',                 adminGuard,      v.idRules,            handleValidation, ctrl.getOne);
router.patch( '/:id',                 superAdminGuard, v.updateRules,        handleValidation, ctrl.update);
router.delete('/:id',                 superAdminGuard, v.idRules,            handleValidation, ctrl.remove);
router.patch( '/:id/toggle-active',   adminGuard,      v.idRules,            handleValidation, ctrl.toggleActive);
router.post(  '/:id/reset-password',  adminGuard,      v.resetPasswordRules, handleValidation, ctrl.resetPassword);

module.exports = router;
