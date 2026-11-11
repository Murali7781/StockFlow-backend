const express = require('express');
const authenticate = require('../middleware/authenticate');

function createResourceRoutes(controller) {
  const router = express.Router();
  router.use(authenticate);
  router.route('/').get(controller.list).post(controller.create);
  router
    .route('/:id')
    .get(controller.getById)
    .put(controller.update)
    .patch(controller.update)
    .delete(controller.remove);
  return router;
}

module.exports = createResourceRoutes;
