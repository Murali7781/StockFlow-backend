const express = require('express');
const authenticate = require('../middleware/authenticate');
const { get, update } = require('../controllers/settingController');

const router = express.Router();

router.route('/').get(authenticate, get).patch(authenticate, update);

module.exports = router;
