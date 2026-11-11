const createResourceRoutes = require('./resourceRoutes');
const controller = require('../controllers/customerController');

module.exports = createResourceRoutes(controller);
