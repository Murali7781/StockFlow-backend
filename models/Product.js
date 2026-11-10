const { DataTypes } = require('sequelize');

function defineProduct(sequelize) {
  return sequelize.define(
    'Product',
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
        validate: { notEmpty: true, len: [1, 160] },
      },
      sku: {
        type: DataTypes.STRING(80),
        allowNull: false,
        set(value) {
          this.setDataValue('sku', value.trim());
        },
        validate: { notEmpty: true, len: [1, 80] },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      quantityOnHand: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      costPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      sellingPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
      },
      lowStockThreshold: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        validate: { min: 0 },
      },
      lastUpdatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'products',
      underscored: true,
      indexes: [
        {
          name: 'products_organization_sku_unique',
          unique: true,
          fields: ['organization_id', 'sku'],
        },
        {
          name: 'products_organization_name',
          fields: ['organization_id', 'name'],
        },
      ],
    },
  );
}

module.exports = defineProduct;
