const router = require('express').Router();
const ctrl   = require('./school_years.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./school_years.validators');

const anyAuth   = [verifyToken];
const adminOnly = [verifyToken, requireRole('admin', 'superadmin')];

router.get(   '/',                  anyAuth,   v.listRules,   handleValidation, ctrl.list);
router.post(  '/',                  adminOnly, v.createRules, handleValidation, ctrl.create);
router.patch( '/:id/toggle-active', adminOnly, v.idRules,     handleValidation, ctrl.toggleActive);

module.exports = router;
