const router     = require('express').Router();
const ctrl       = require('./users.controller');
const { verifyToken }     = require('../../middleware/auth');
const { requireRole }     = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v          = require('./users.validators');

const guard = [verifyToken, requireRole('superadmin')];

router.get(   '/',                    guard, v.listRules,          handleValidation, ctrl.list);
router.post(  '/',                    guard, v.createRules,        handleValidation, ctrl.create);
router.get(   '/:id',                 guard, v.idRules,            handleValidation, ctrl.getOne);
router.patch( '/:id',                 guard, v.updateRules,        handleValidation, ctrl.update);
router.delete('/:id',                 guard, v.idRules,            handleValidation, ctrl.remove);
router.patch( '/:id/toggle-active',   guard, v.idRules,            handleValidation, ctrl.toggleActive);
router.post(  '/:id/reset-password',  guard, v.resetPasswordRules, handleValidation, ctrl.resetPassword);

module.exports = router;
