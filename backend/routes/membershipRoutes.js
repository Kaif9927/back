const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const membership = require('../controllers/membershipController');

// anyone logged in can see membership summary report
router.get('/reports/membership', auth.requireAuth, membership.membershipReport);

router.post('/memberships', auth.requireAuth, auth.requireAdmin, membership.createMembership);
router.get('/memberships/:id', auth.requireAuth, auth.requireAdmin, membership.getMembershipByNumber);
router.post('/memberships/update', auth.requireAuth, auth.requireAdmin, membership.updateMembership);
router.get('/users-for-membership', auth.requireAuth, auth.requireAdmin, membership.listUsersForDropdown);

module.exports = router;
