const { DataTypes } = require('sequelize');

function defineUser(sequelize) {
  return sequelize.define(
    'User',
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
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: true,
        set(value) {
          this.setDataValue('email', value.trim().toLowerCase());
        },
        validate: { isEmail: true, len: [3, 254] },
      },
      passwordHash: {
        type: DataTypes.STRING(60),
        allowNull: false,
        field: 'password_hash',
      },
    },
    { tableName: 'users', underscored: true },
  );
}

module.exports = defineUser;
