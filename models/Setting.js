const { DataTypes } = require('sequelize');

function defineSetting(sequelize) {
  return sequelize.define(
    'Setting',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      defaultLowStockThreshold: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 5,
        validate: { min: 0 },
      },
    },
    { tableName: 'settings', underscored: true },
  );
}

module.exports = defineSetting;
