const { DataTypes } = require('sequelize');

function defineWarehouseStock(sequelize) {
  return sequelize.define(
    'WarehouseStock',
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
      warehouseId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      quantityOnHand: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
    },
    { tableName: 'warehouse_stocks', underscored: true },
  );
}

module.exports = defineWarehouseStock;
