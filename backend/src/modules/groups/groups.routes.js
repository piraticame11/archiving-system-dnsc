const router = require('express').Router();
const ctrl   = require('./groups.controller');
const { verifyToken }      = require('../../middleware/auth');
const { requireRole }      = require('../../middleware/rbac');
const { handleValidation } = require('../../middleware/validate');
const v = require('./groups.validators');

const auth        = [verifyToken];
const adminOnly   = [verifyToken, requireRole('admin', 'superadmin')];
const studentOnly = [verifyToken, requireRole('student')];

/* list all groups (for admin schedule creation) */
router.get('/', adminOnly, ctrl.listAll);

/* list instructors for adviser selection (any authenticated student) */
router.get('/instructors', auth, ctrl.listInstructors);

/* get own group */
router.get('/my', studentOnly, ctrl.getMyGroup);

/* create a new group */
router.post('/', studentOnly, v.createRules, handleValidation, ctrl.create);

/* request to join a group via code */
router.post('/request-join', studentOnly, v.joinRules, handleValidation, ctrl.requestJoin);

/* update group info (leader validates inside service) */
router.patch('/:id', studentOnly, v.updateRules, handleValidation, ctrl.update);

/* regenerate join code (leader only, validated inside service) */
router.post('/:id/regenerate-code', studentOnly, v.idRules, handleValidation, ctrl.regenerateJoinCode);

/* disband group (leader only, validated inside service) */
router.delete('/:id', studentOnly, v.idRules, handleValidation, ctrl.disbandGroup);

/* leave group (non-leader, validated inside service) */
router.post('/:id/leave', studentOnly, v.idRules, handleValidation, ctrl.leaveGroup);

/* pending join requests (leader only) */
router.get('/:id/requests', studentOnly, v.idRules, handleValidation, ctrl.getPendingRequests);

/* accept / reject a join request */
router.post('/:id/requests/:requestId/accept', studentOnly, v.requestActionRules, handleValidation, ctrl.acceptRequest);
router.post('/:id/requests/:requestId/reject', studentOnly, v.requestActionRules, handleValidation, ctrl.rejectRequest);

/* remove a member (leader only) */
router.delete('/:id/members/:studentId', studentOnly, v.memberRules, handleValidation, ctrl.removeMember);

module.exports = router;
