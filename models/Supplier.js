const { DataTypes } = require('sequelize');

function defineSupplier(sequelize) {
  return sequelize.define(
    'Supplier',
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
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      companyName: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(254),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    { tableName: 'suppliers', underscored: true },
  );
}

module.exports = defineSupplier;
