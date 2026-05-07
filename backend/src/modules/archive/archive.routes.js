const router = require('express').Router();
const ctrl   = require('./archive.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./archive.validators');

const auth      = [verifyToken];
const adminOnly = [verifyToken, requireRole('admin', 'superadmin')];

/* public-ish (any authenticated user) */
router.get('/stats',    auth, ctrl.stats);
router.get('/eligible', adminOnly, v.eligibleRules, handleValidation, ctrl.eligible);
router.get('/',         auth, v.listRules,  handleValidation, ctrl.list);
router.get('/:id',      auth, v.idRules,    handleValidation, ctrl.getOne);
router.get('/:id/download', auth, v.idRules, handleValidation, ctrl.download);

/* admin / superadmin only */
router.post(  '/',    adminOnly, v.promoteRules, handleValidation, ctrl.promote);
router.delete('/:id', adminOnly, v.idRules,      handleValidation, ctrl.remove);

module.exports = router;
