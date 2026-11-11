const { Supplier, PurchaseOrder } = require('../models');
const AppError = require('../utils/AppError');
const createResourceController = require('./resourceController');
const { validateContact } = require('../validators/resourceValidators');

module.exports = createResourceController({
  Model: Supplier,
  entityName: 'supplier',
  validate: validateContact,
  searchFields: ['name', 'companyName', 'email'],
  beforeDelete: async ({ item, organizationId, transaction }) => {
    const orderCount = await PurchaseOrder.count({
      where: { supplierId: item.id, organizationId },
      transaction,
    });
    if (orderCount) {
      throw new AppError(409, 'SUPPLIER_IN_USE', 'Supplier has purchase orders and cannot be deleted');
    }
  },
});
