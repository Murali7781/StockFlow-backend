const express = require('express');
const authenticate = require('../middleware/authenticate');
const {
  getStock,
  listMovements,
  createMovement,
} = require('../controllers/inventoryController');

const router = express.Router();
router.use(authenticate);
router.get('/', getStock);
router.route('/movements').get(listMovements).post(createMovement);

module.exports = router;
