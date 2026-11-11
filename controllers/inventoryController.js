const { InventoryMovement, Product, Warehouse, WarehouseStock, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { requireUuid } = require('../utils/validation');
const { validateInventoryMovement } = require('../validators/resourceValidators');
const { applyStockMovement } = require('../services/inventoryService');

function parsePage(value, fallback, field, max = 1000000) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} is out of range`);
  }
  return parsed;
}

async function getStock(req, res) {
  const organizationId = req.user.organizationId;
  const [products, warehouseStocks] = await Promise.all([
    Product.findAll({
      where: { organizationId },
      attributes: ['id', 'name', 'sku', 'quantityOnHand', 'lowStockThreshold'],
      order: [['name', 'ASC'], ['id', 'ASC']],
    }),
    WarehouseStock.findAll({
      where: { organizationId },
      attributes: ['id', 'productId', 'warehouseId', 'quantityOnHand'],
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
      ],
      order: [['warehouseId', 'ASC'], ['productId', 'ASC']],
    }),
  ]);
  return res.json({ data: { products, warehouseStocks } });
}

async function listMovements(req, res) {
  const page = parsePage(req.query.page, 1, 'page');
  const limit = parsePage(req.query.limit, 20, 'limit', 100);
  const where = { organizationId: req.user.organizationId };
  if (req.query.productId !== undefined) {
    where.productId = requireUuid(req.query.productId, 'productId');
  }
  if (req.query.warehouseId !== undefined) {
    where.warehouseId = requireUuid(req.query.warehouseId, 'warehouseId');
  }
  if (req.query.type !== undefined) {
    if (!['IN', 'OUT'].includes(req.query.type)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'type must be IN or OUT');
    }
    where.type = req.query.type;
  }
  const { count, rows } = await InventoryMovement.findAndCountAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return res.json({
    data: {
      items: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    },
  });
}

async function createMovement(req, res) {
  const values = validateInventoryMovement(req.body);
  const movement = await sequelize.transaction(async (transaction) =>
    applyStockMovement({
      ...values,
      organizationId: req.user.organizationId,
      createdBy: req.user.id,
      transaction,
    }),
  );
  return res.status(201).json({ data: movement });
}

module.exports = { getStock, listMovements, createMovement };
