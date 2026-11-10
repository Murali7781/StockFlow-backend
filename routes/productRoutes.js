const express = require('express');
const authenticate = require('../middleware/authenticate');
const {
  list,
  getById,
  create,
  update,
  remove,
} = require('../controllers/productController');

const router = express.Router();

router.use(authenticate);
router.route('/').get(list).post(create);
router.route('/:id').get(getById).put(update).patch(update).delete(remove);

module.exports = router;
