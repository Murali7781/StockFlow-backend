const { Op } = require('sequelize');
const {
  Customer,
  Product,
  PurchaseOrder,
  SalesOrder,
  Supplier,
  Warehouse,
  sequelize,
} = require('../models');
const { applyStockMovement } = require('../services/inventoryService');
const AppError = require('../utils/AppError');
const { requireUuid } = require('../utils/validation');
const { validateOrder } = require('../validators/resourceValidators');

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

function createOrderController({
  Model,
  partyModel,
  partyField,
  movementType,
  entityName,
}) {
  const include = [
    { model: partyModel, attributes: ['id', 'name'] },
    { model: Warehouse, attributes: ['id', 'name'] },
  ];

  async function list(req, res) {
    const page = parsePage(req.query.page, 1, 'page');
    const limit = parsePage(req.query.limit, 20, 'limit', 100);
    const where = { organizationId: req.user.organizationId };
    if (req.query.status !== undefined) {
      if (!['DRAFT', 'COMPLETED', 'CANCELLED'].includes(req.query.status)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid order status');
      }
      where.status = req.query.status;
    }
    if (req.query.search !== undefined) {
      if (typeof req.query.search !== 'string' || req.query.search.trim().length > 100) {
        throw new AppError(400, 'VALIDATION_ERROR', 'search must be a string of 100 characters or fewer');
      }
      const search = req.query.search.trim();
      if (search) where.orderNumber = { [Op.like]: `%${search}%` };
    }
    const sortOrder =
      req.query.sortOrder === undefined ? 'DESC' : String(req.query.sortOrder).toUpperCase();
    if (!['ASC', 'DESC'].includes(sortOrder)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'sortOrder must be ASC or DESC');
    }
    const { count, rows } = await Model.findAndCountAll({
      where,
      include,
      order: [['orderDate', sortOrder], ['id', 'ASC']],
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

  async function getById(req, res) {
    const id = requireUuid(req.params.id);
    const order = await Model.findOne({
      where: { id, organizationId: req.user.organizationId },
      include,
    });
    if (!order) {
      throw new AppError(404, `${entityName.toUpperCase()}_NOT_FOUND`, `${entityName} was not found`);
    }
    return res.json({ data: order });
  }

  async function validateReferences(values, organizationId, transaction) {
    if (values[partyField]) {
      const party = await partyModel.findOne({
        where: { id: values[partyField], organizationId },
        transaction,
      });
      if (!party) {
        throw new AppError(404, `${partyField.toUpperCase()}_NOT_FOUND`, `${partyField} was not found`);
      }
    }
    if (values.warehouseId) {
      const warehouse = await Warehouse.findOne({
        where: { id: values.warehouseId, organizationId },
        transaction,
      });
      if (!warehouse) {
        throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Warehouse was not found');
      }
    }
    if (values.lines) {
      const productIds = [...new Set(values.lines.map((line) => line.productId))];
      const products = await Product.findAll({
        where: { id: { [Op.in]: productIds }, organizationId },
        attributes: ['id'],
        transaction,
      });
      if (products.length !== productIds.length) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'One or more products were not found in this organization');
      }
    }
  }

  async function create(req, res) {
    const values = validateOrder(req.body, { partyField });
    if (values.status && values.status !== 'DRAFT') {
      throw new AppError(400, 'INVALID_ORDER_TRANSITION', 'Orders must be created as DRAFT');
    }
    values.status = 'DRAFT';
    const order = await sequelize.transaction(async (transaction) => {
      await validateReferences(values, req.user.organizationId, transaction);
      return Model.create(
        { ...values, organizationId: req.user.organizationId },
        { transaction },
      );
    });
    return res.status(201).json({ data: order });
  }

  async function update(req, res) {
    const id = requireUuid(req.params.id);
    const values = validateOrder(req.body, { partyField, partial: true });
    const order = await sequelize.transaction(async (transaction) => {
      const current = await Model.findOne({
        where: { id, organizationId: req.user.organizationId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!current) {
        throw new AppError(404, `${entityName.toUpperCase()}_NOT_FOUND`, `${entityName} was not found`);
      }
      if (current.status !== 'DRAFT') {
        throw new AppError(409, 'ORDER_NOT_EDITABLE', 'Only draft orders can be changed');
      }
      await validateReferences(
        { ...current.get({ plain: true }), ...values },
        req.user.organizationId,
        transaction,
      );
      Object.assign(current, values);
      if (current.status === 'COMPLETED') {
        for (const line of current.lines) {
          await applyStockMovement({
            organizationId: req.user.organizationId,
            productId: line.productId,
            warehouseId: current.warehouseId,
            type: movementType,
            quantity: line.quantity,
            reference: current.orderNumber,
            note: `${entityName} completed`,
            createdBy: req.user.id,
            transaction,
          });
        }
      }
      await current.save({ transaction, validate: true });
      return current;
    });
    return res.json({ data: order });
  }

  async function remove(req, res) {
    const id = requireUuid(req.params.id);
    await sequelize.transaction(async (transaction) => {
      const order = await Model.findOne({
        where: { id, organizationId: req.user.organizationId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) {
        throw new AppError(404, `${entityName.toUpperCase()}_NOT_FOUND`, `${entityName} was not found`);
      }
      if (order.status !== 'DRAFT') {
        throw new AppError(409, 'ORDER_NOT_DELETABLE', 'Only draft orders can be deleted');
      }
      await order.destroy({ transaction });
    });
    return res.status(204).end();
  }

  return { list, getById, create, update, remove };
}

const purchaseOrderController = createOrderController({
  Model: PurchaseOrder,
  partyModel: Supplier,
  partyField: 'supplierId',
  movementType: 'IN',
  entityName: 'purchase order',
});
const salesOrderController = createOrderController({
  Model: SalesOrder,
  partyModel: Customer,
  partyField: 'customerId',
  movementType: 'OUT',
  entityName: 'sales order',
});

module.exports = { purchaseOrderController, salesOrderController };
