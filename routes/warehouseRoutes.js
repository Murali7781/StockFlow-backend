const createResourceRoutes = require('./resourceRoutes');
const controller = require('../controllers/warehouseController');

module.exports = createResourceRoutes(controller);
