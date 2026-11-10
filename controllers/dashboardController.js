const { Op, col, where } = require('sequelize');
const { Product, Setting } = require('../models');
const AppError = require('../utils/AppError');

const LOW_STOCK_PRODUCTS_LIMIT = 10;

async function getSummary(req, res) {
  const organizationId = req.user.organizationId;
  const setting = await Setting.findOne({ where: { organizationId } });
  if (!setting) {
    throw new AppError(500, 'SETTINGS_NOT_FOUND', 'Organization settings are unavailable');
  }

  const lowStockWhere = {
    organizationId,
    [Op.or]: [
      where(col('quantity_on_hand'), Op.lte, col('low_stock_threshold')),
      {
        lowStockThreshold: null,
        quantityOnHand: { [Op.lte]: setting.defaultLowStockThreshold },
      },
    ],
  };
  const [totalProducts, totalStockQuantity, lowStockCount, lowStockProducts] =
    await Promise.all([
      Product.count({ where: { organizationId } }),
      Product.sum('quantityOnHand', { where: { organizationId } }),
      Product.count({ where: lowStockWhere }),
      Product.findAll({
        where: lowStockWhere,
        attributes: ['id', 'name', 'sku', 'quantityOnHand', 'lowStockThreshold'],
        order: [['quantityOnHand', 'ASC'], ['name', 'ASC']],
        limit: LOW_STOCK_PRODUCTS_LIMIT,
      }),
    ]);

  return res.json({
    data: {
      totalProducts,
      totalStockQuantity: Number(totalStockQuantity || 0),
      lowStockCount,
      lowStockProducts,
      lowStockProductsLimit: LOW_STOCK_PRODUCTS_LIMIT,
      lowStockProductsTruncated: lowStockCount > lowStockProducts.length,
      defaultLowStockThreshold: setting.defaultLowStockThreshold,
    },
  });
}

module.exports = { getSummary };
