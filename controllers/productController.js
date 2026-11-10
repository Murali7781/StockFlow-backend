const { Op, QueryTypes } = require('sequelize');
const { sequelize, Product } = require('../models');
const AppError = require('../utils/AppError');
const { requireUuid } = require('../utils/validation');
const { validateProduct } = require('../validators/productValidators');

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

async function list(req, res) {
  const page = parsePage(req.query.page, 1, 'page');
  const limit = parsePage(req.query.limit, 20, 'limit', 100);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (req.query.search !== undefined && typeof req.query.search !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'search must be a string');
  }
  if (search.length > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'search must be 100 characters or fewer');
  }

  const where = { organizationId: req.user.organizationId };
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
    ];
  }

  const sortBy = req.query.sortBy === undefined ? 'name' : req.query.sortBy;
  const sortOrder =
    req.query.sortOrder === undefined ? 'ASC' : String(req.query.sortOrder).toUpperCase();
  if (!['name', 'sku', 'quantityOnHand', 'sellingPrice', 'createdAt'].includes(sortBy)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid sort field');
  }
  if (!['ASC', 'DESC'].includes(sortOrder)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'sortOrder must be ASC or DESC');
  }

  const { count, rows } = await Product.findAndCountAll({
    where,
    order: [[sortBy, sortOrder], ['id', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });

  return res.json({
    data: {
      products: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    },
  });
}

async function getById(req, res) {
  const id = requireUuid(req.params.id);
  const product = await Product.findOne({
    where: { id, organizationId: req.user.organizationId },
  });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found');
  }
  return res.json({ data: product });
}

async function create(req, res) {
  const attributes = validateProduct(req.body);
  const product = await Product.create({
    ...attributes,
    organizationId: req.user.organizationId,
    lastUpdatedBy: req.user.id,
  });
  return res.status(201).json({ data: product });
}

async function update(req, res) {
  const id = requireUuid(req.params.id);
  const attributes = validateProduct(req.body, { partial: true });
  const product = await Product.findOne({
    where: { id, organizationId: req.user.organizationId },
  });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found');
  }

  Object.assign(product, attributes, { lastUpdatedBy: req.user.id });
  await product.save({ validate: true });
  return res.json({ data: product });
}

async function remove(req, res) {
  const id = requireUuid(req.params.id);
  await sequelize.transaction(async (transaction) => {
    const product = await Product.findOne({
      where: { id, organizationId: req.user.organizationId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found');
    }

    const legacyMovementTable = await sequelize.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'inventory_movements'
       LIMIT 1`,
      { transaction, type: QueryTypes.SELECT },
    );
    if (legacyMovementTable.length) {
      await sequelize.query(
        `DELETE FROM inventory_movements
         WHERE product_id = :productId
           AND organization_id = :organizationId`,
        {
          replacements: {
            productId: id,
            organizationId: req.user.organizationId,
          },
          transaction,
        },
      );
    }
    await product.destroy({ transaction });
  });
  return res.status(204).end();
}

module.exports = { list, getById, create, update, remove };
