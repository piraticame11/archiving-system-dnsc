const router = require('express').Router();
const ctrl   = require('./panelists.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./panelists.validators');

const adminGuard      = [verifyToken, requireRole('admin', 'superadmin')];
const superAdminGuard = [verifyToken, requireRole('superadmin')];

router.get(   '/',                   adminGuard,      v.listRules,          handleValidation, ctrl.list);
router.post(  '/',                   superAdminGuard, v.createRules,        handleValidation, ctrl.create);
router.get(   '/:id',                adminGuard,      v.idRules,            handleValidation, ctrl.getOne);
router.patch( '/:id',                superAdminGuard, v.updateRules,        handleValidation, ctrl.update);
router.delete('/:id',                superAdminGuard, v.idRules,            handleValidation, ctrl.remove);
router.patch( '/:id/toggle-active',  adminGuard,      v.idRules,            handleValidation, ctrl.toggleActive);
router.post(  '/:id/reset-password', adminGuard,      v.resetPasswordRules, handleValidation, ctrl.resetPassword);

module.exports = router;
