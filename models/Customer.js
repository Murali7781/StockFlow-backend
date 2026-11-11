const { DataTypes } = require('sequelize');

function defineCustomer(sequelize) {
  return sequelize.define(
    'Customer',
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
    { tableName: 'customers', underscored: true },
  );
}

module.exports = defineCustomer;
