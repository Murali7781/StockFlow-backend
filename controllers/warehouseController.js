const {
  Warehouse,
  WarehouseStock,
  InventoryMovement,
  PurchaseOrder,
  SalesOrder,
} = require('../models');
const AppError = require('../utils/AppError');
const createResourceController = require('./resourceController');
const { validateWarehouse } = require('../validators/resourceValidators');

module.exports = createResourceController({
  Model: Warehouse,
  entityName: 'warehouse',
  validate: validateWarehouse,
  searchFields: ['name', 'address'],
  beforeSave: async ({ values, organizationId, transaction }) => {
    if (values.isDefault) {
      await Warehouse.update(
        { isDefault: false },
        { where: { organizationId }, transaction },
      );
    }
  },
  beforeDelete: async ({ item, organizationId, transaction }) => {
    const referenceChecks = await Promise.all([
      WarehouseStock.count({ where: { warehouseId: item.id, organizationId }, transaction }),
      InventoryMovement.count({ where: { warehouseId: item.id, organizationId }, transaction }),
      PurchaseOrder.count({ where: { warehouseId: item.id, organizationId }, transaction }),
      SalesOrder.count({ where: { warehouseId: item.id, organizationId }, transaction }),
    ]);
    if (referenceChecks.some(Boolean)) {
      throw new AppError(409, 'WAREHOUSE_IN_USE', 'Warehouse has stock or history and cannot be deleted');
    }
  },
});
