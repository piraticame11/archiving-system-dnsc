const router = require('express').Router();
const ctrl   = require('./schedules.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./schedules.validators');

const adminOnly       = [verifyToken, requireRole('admin', 'superadmin')];
const adminOrPanelist = [verifyToken, requireRole('admin', 'superadmin', 'panelist')];
const studentOnly     = [verifyToken, requireRole('student')];

// Static routes before /:id
router.get('/calendar',          adminOrPanelist, v.calendarRules, handleValidation, ctrl.calendar);
router.get('/my-group-schedule', studentOnly,                                        ctrl.myGroupSchedule);
router.get('/',                  adminOrPanelist, v.listRules,     handleValidation, ctrl.list);
router.get('/:id',               adminOrPanelist, v.idRules,       handleValidation, ctrl.getOne);
router.post('/',                 adminOnly, v.createRules,  handleValidation, ctrl.create);
router.patch('/:id',             adminOnly, v.updateRules,  handleValidation, ctrl.update);
router.patch('/:id/status',      adminOnly, v.statusRules,  handleValidation, ctrl.updateStatus);
router.delete('/:id',            adminOnly, v.idRules,      handleValidation, ctrl.remove);

module.exports = router;
