const { DataTypes } = require('sequelize');

function definePurchaseOrder(sequelize) {
  return sequelize.define(
    'PurchaseOrder',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      supplierId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      warehouseId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      orderNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('DRAFT', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      orderDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      lines: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      notes: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
    },
    { tableName: 'purchase_orders', underscored: true },
  );
}

module.exports = definePurchaseOrder;
