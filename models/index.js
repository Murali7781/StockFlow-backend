const { sequelize } = require('../config/database');
const defineOrganization = require('./Organization');
const defineUser = require('./User');
const defineProduct = require('./Product');
const defineSetting = require('./Setting');

const Organization = defineOrganization(sequelize);
const User = defineUser(sequelize);
const Product = defineProduct(sequelize);
const Setting = defineSetting(sequelize);

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

module.exports = {
  sequelize,
  Organization,
  User,
  Product,
  Setting,
};
