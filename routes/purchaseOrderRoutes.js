const createOrderRoutes = require('./orderRoutes');
const { purchaseOrderController } = require('../controllers/orderController');

module.exports = createOrderRoutes(purchaseOrderController);
