const { sequelize } = require('../config/database');
const defineOrganization = require('./Organization');
const defineUser = require('./User');
const defineProduct = require('./Product');
const defineSetting = require('./Setting');
const defineSupplier = require('./Supplier');
const defineCustomer = require('./Customer');
const defineWarehouse = require('./Warehouse');
const defineWarehouseStock = require('./WarehouseStock');
const defineInventoryMovement = require('./InventoryMovement');
const definePurchaseOrder = require('./PurchaseOrder');
const defineSalesOrder = require('./SalesOrder');

const Organization = defineOrganization(sequelize);
const User = defineUser(sequelize);
const Product = defineProduct(sequelize);
const Setting = defineSetting(sequelize);
const Supplier = defineSupplier(sequelize);
const Customer = defineCustomer(sequelize);
const Warehouse = defineWarehouse(sequelize);
const WarehouseStock = defineWarehouseStock(sequelize);
const InventoryMovement = defineInventoryMovement(sequelize);
const PurchaseOrder = definePurchaseOrder(sequelize);
const SalesOrder = defineSalesOrder(sequelize);

Organization.hasOne(User, {
  as: 'owner',
  foreignKey: { name: 'organizationId', allowNull: false },
  onDelete: 'CASCADE',
});
User.belongsTo(Organization, {
  foreignKey: { name: 'organizationId', allowNull: false },
});

Organization.hasMany(Product, {
  as: 'products',
  foreignKey: { name: 'organizationId', allowNull: false },
  onDelete: 'CASCADE',
});
Product.belongsTo(Organization, {
  foreignKey: { name: 'organizationId', allowNull: false },
});

Organization.hasOne(Setting, {
  as: 'settings',
  foreignKey: { name: 'organizationId', allowNull: false },
  onDelete: 'CASCADE',
});
Setting.belongsTo(Organization, {
  foreignKey: { name: 'organizationId', allowNull: false },
});

Organization.hasMany(Supplier, { foreignKey: 'organizationId' });
Supplier.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(Customer, { foreignKey: 'organizationId' });
Customer.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(Warehouse, { foreignKey: 'organizationId' });
Warehouse.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(WarehouseStock, { foreignKey: 'organizationId' });
WarehouseStock.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(InventoryMovement, { foreignKey: 'organizationId' });
InventoryMovement.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(PurchaseOrder, { foreignKey: 'organizationId' });
PurchaseOrder.belongsTo(Organization, { foreignKey: 'organizationId' });
Organization.hasMany(SalesOrder, { foreignKey: 'organizationId' });
SalesOrder.belongsTo(Organization, { foreignKey: 'organizationId' });

Product.hasMany(WarehouseStock, { as: 'warehouseStocks', foreignKey: 'productId' });
WarehouseStock.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
Warehouse.hasMany(WarehouseStock, { as: 'stocks', foreignKey: 'warehouseId' });
WarehouseStock.belongsTo(Warehouse, { as: 'warehouse', foreignKey: 'warehouseId' });
Product.hasMany(InventoryMovement, { as: 'movements', foreignKey: 'productId' });
InventoryMovement.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
Warehouse.hasMany(InventoryMovement, { as: 'movements', foreignKey: 'warehouseId' });
InventoryMovement.belongsTo(Warehouse, { as: 'warehouse', foreignKey: 'warehouseId' });
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplierId' });
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplierId' });
Customer.hasMany(SalesOrder, { foreignKey: 'customerId' });
SalesOrder.belongsTo(Customer, { foreignKey: 'customerId' });
Warehouse.hasMany(PurchaseOrder, { foreignKey: 'warehouseId' });
PurchaseOrder.belongsTo(Warehouse, { foreignKey: 'warehouseId' });
Warehouse.hasMany(SalesOrder, { foreignKey: 'warehouseId' });
SalesOrder.belongsTo(Warehouse, { foreignKey: 'warehouseId' });

module.exports = {
  sequelize,
  Organization,
  User,
  Product,
  Setting,
  Supplier,
  Customer,
  Warehouse,
  WarehouseStock,
  InventoryMovement,
  PurchaseOrder,
  SalesOrder,
};
