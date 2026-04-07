const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const events = require('../controllers/eventController');

router.use(auth.requireAuth);

router.get('/events', events.listEvents);
router.post('/transactions', events.bookEvent);
router.get('/transactions/mine', events.myTransactions);
router.get('/reports/participation', events.participationReport);

module.exports = router;
