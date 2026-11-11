const createOrderRoutes = require('./orderRoutes');
const { salesOrderController } = require('../controllers/orderController');

module.exports = createOrderRoutes(salesOrderController);
