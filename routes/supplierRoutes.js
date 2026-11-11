const createResourceRoutes = require('./resourceRoutes');
const controller = require('../controllers/supplierController');

module.exports = createResourceRoutes(controller);
