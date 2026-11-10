const express = require('express');
const authenticate = require('../middleware/authenticate');
const { getSummary } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', authenticate, getSummary);

module.exports = router;
