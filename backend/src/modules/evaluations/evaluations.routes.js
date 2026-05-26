const router = require('express').Router();
const ctrl   = require('./evaluations.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./evaluations.validators');

const panelistOnly     = [verifyToken, requireRole('panelist')];
const adminOrPanelist  = [verifyToken, requireRole('admin', 'superadmin', 'panelist')];

/* list — panelist sees own; admin sees all (filtered via controller) */
router.get('/', adminOrPanelist, v.listRules, handleValidation, ctrl.list);

/* specific routes before /:id wildcard */
router.get('/schedule/:scheduleId', panelistOnly, v.scheduleIdRules, handleValidation, ctrl.getBySchedule);

router.get('/:id', adminOrPanelist, v.idRules, handleValidation, ctrl.getOne);

/* create or update */
router.post('/', panelistOnly, v.upsertRules, handleValidation, ctrl.upsert);

module.exports = router;
