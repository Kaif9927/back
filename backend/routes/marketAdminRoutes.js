const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const m = require('../controllers/marketAdminController');

router.use(auth.requireAuth, auth.requireAdmin);

router.get('/admin/market/users', m.listUsers);
router.post('/admin/market/users', m.createUser);
router.put('/admin/market/users/:id', m.updateUser);
router.delete('/admin/market/users/:id', m.deleteUser);

router.get('/admin/market/vendors', m.listVendorsAdmin);
router.post('/admin/market/vendors', m.createVendorAdmin);
router.put('/admin/market/vendors/:id', m.updateVendorAdmin);
router.delete('/admin/market/vendors/:id', m.deleteVendorAdmin);

module.exports = router;
