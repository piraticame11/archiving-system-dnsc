const router = require('express').Router();
const ctrl   = require('./schedules.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const { uploadMinutes }    = require('../../config/multer');
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

/* Minutes photo — the panel's written minutes are what the system's record
   of the defense outcome is based on. Admin/Research Office digitizes it. */
router.post('/:id/minutes',        adminOnly,       v.idRules, handleValidation, uploadMinutes.single('file'), ctrl.uploadMinutes);
router.get('/:id/minutes',         adminOrPanelist, v.idRules, handleValidation, ctrl.getMinutes);

module.exports = router;
