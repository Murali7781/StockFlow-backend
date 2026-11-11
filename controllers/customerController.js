const { Customer, SalesOrder } = require('../models');
const AppError = require('../utils/AppError');
const createResourceController = require('./resourceController');
const { validateContact } = require('../validators/resourceValidators');

module.exports = createResourceController({
  Model: Customer,
  entityName: 'customer',
  validate: validateContact,
  searchFields: ['name', 'companyName', 'email'],
  beforeDelete: async ({ item, organizationId, transaction }) => {
    const orderCount = await SalesOrder.count({
      where: { customerId: item.id, organizationId },
      transaction,
    });
    if (orderCount) {
      throw new AppError(409, 'CUSTOMER_IN_USE', 'Customer has sales orders and cannot be deleted');
    }
  },
});
