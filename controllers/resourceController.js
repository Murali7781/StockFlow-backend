const { Op } = require('sequelize');
const AppError = require('../utils/AppError');
const { requireUuid } = require('../utils/validation');

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

function createResourceController({
  Model,
  entityName,
  validate,
  searchFields,
  sortFields = ['name', 'createdAt'],
  beforeSave,
  beforeDelete,
}) {
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
      where[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.like]: `%${search}%` },
      }));
    }
    const sortBy = req.query.sortBy === undefined ? sortFields[0] : req.query.sortBy;
    const sortOrder =
      req.query.sortOrder === undefined ? 'ASC' : String(req.query.sortOrder).toUpperCase();
    if (!sortFields.includes(sortBy)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid sort field');
    }
    if (!['ASC', 'DESC'].includes(sortOrder)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'sortOrder must be ASC or DESC');
    }

    const { count, rows } = await Model.findAndCountAll({
      where,
      order: [[sortBy, sortOrder], ['id', 'ASC']],
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
    const item = await Model.findOne({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!item) {
      throw new AppError(404, `${entityName.toUpperCase()}_NOT_FOUND`, `${entityName} was not found`);
    }
    return res.json({ data: item });
  }

  async function create(req, res) {
    const values = validate(req.body);
    const item = await Model.sequelize.transaction(async (transaction) => {
      if (beforeSave) {
        await beforeSave({
          values,
          organizationId: req.user.organizationId,
          transaction,
        });
      }
      return Model.create(
        { ...values, organizationId: req.user.organizationId },
        { transaction },
      );
    });
    return res.status(201).json({ data: item });
  }

  async function update(req, res) {
    const id = requireUuid(req.params.id);
    const values = validate(req.body, { partial: true });
    const item = await Model.sequelize.transaction(async (transaction) => {
      const current = await Model.findOne({
        where: { id, organizationId: req.user.organizationId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!current) {
        throw new AppError(
          404,
          `${entityName.toUpperCase()}_NOT_FOUND`,
          `${entityName} was not found`,
        );
      }
      if (beforeSave) {
        await beforeSave({
          values,
          current,
          organizationId: req.user.organizationId,
          transaction,
        });
      }
      Object.assign(current, values);
      await current.save({ transaction, validate: true });
      return current;
    });
    return res.json({ data: item });
  }

  async function remove(req, res) {
    const id = requireUuid(req.params.id);
    await Model.sequelize.transaction(async (transaction) => {
      const item = await Model.findOne({
        where: { id, organizationId: req.user.organizationId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!item) {
        throw new AppError(
          404,
          `${entityName.toUpperCase()}_NOT_FOUND`,
          `${entityName} was not found`,
        );
      }
      if (beforeDelete) {
        await beforeDelete({ item, transaction, organizationId: req.user.organizationId });
      }
      await item.destroy({ transaction });
    });
    return res.status(204).end();
  }

  return { list, getById, create, update, remove };
}

module.exports = createResourceController;
