const router = require('express').Router();
const ctrl   = require('./venues.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./venues.validators');

const adminOnly = [verifyToken, requireRole('admin', 'superadmin')];

router.get(   '/',                 adminOnly, v.listRules,   handleValidation, ctrl.list);
router.post(  '/',                 adminOnly, v.createRules, handleValidation, ctrl.create);
router.patch( '/:id',              adminOnly, v.updateRules, handleValidation, ctrl.update);
router.patch( '/:id/toggle-active',adminOnly, v.idRules,     handleValidation, ctrl.toggleActive);
router.delete('/:id',              adminOnly, v.idRules,     handleValidation, ctrl.remove);

module.exports = router;
