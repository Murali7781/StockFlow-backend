const { DataTypes } = require('sequelize');

function defineOrganization(sequelize) {
  return sequelize.define(
    'Organization',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: true, len: [1, 120] },
      },
    },
    { tableName: 'organizations', underscored: true },
  );
}

module.exports = defineOrganization;
