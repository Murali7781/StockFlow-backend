const AppError = require('../utils/AppError');
const {
  requireObject,
  rejectUnknownFields,
  requireString,
  requireInteger,
  requireUuid,
} = require('../utils/validation');

const contactFields = ['name', 'companyName', 'email', 'phone', 'address'];

function nullableString(input, field, max, options = {}) {
  if (input[field] === undefined) return undefined;
  if (input[field] === null) return null;
  return requireString(input[field], field, {
    max,
    min: options.allowEmpty ? 0 : 1,
  });
}

function validateContact(body, { partial = false } = {}) {
  const input = requireObject(body);
  rejectUnknownFields(input, contactFields);
  if (!partial && input.name === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'name is required');
  }
  if (partial && Object.keys(input).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one field is required');
  }

  const values = {};
  if (input.name !== undefined) values.name = requireString(input.name, 'name', { max: 160 });
  for (const [field, max] of [
    ['companyName', 160],
    ['phone', 40],
    ['address', 10000],
  ]) {
    const value = nullableString(input, field, max, { allowEmpty: true });
    if (value !== undefined) values[field] = value || null;
  }

  if (input.email !== undefined) {
    const email = nullableString(input, 'email', 254);
    if (email === null) {
      values.email = null;
    } else {
      const normalized = email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'email must be a valid email address');
      }
      values.email = normalized;
    }
  }
  return values;
}

function validateWarehouse(body, { partial = false } = {}) {
  const input = requireObject(body);
  rejectUnknownFields(input, ['name', 'address', 'isDefault']);
  if (!partial && input.name === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'name is required');
  }
  if (partial && Object.keys(input).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one field is required');
  }
  const values = {};
  if (input.name !== undefined) values.name = requireString(input.name, 'name', { max: 120 });
  const address = nullableString(input, 'address', 500, { allowEmpty: true });
  if (address !== undefined) values.address = address || null;
  if (input.isDefault !== undefined) {
    if (typeof input.isDefault !== 'boolean') {
      throw new AppError(400, 'VALIDATION_ERROR', 'isDefault must be a boolean');
    }
    values.isDefault = input.isDefault;
  }
  return values;
}

function validateDate(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid calendar date`);
  }
  return value;
}

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'lines must contain between 1 and 100 items');
  }
  return lines.map((line, index) => {
    const input = requireObject(line, `lines[${index}]`);
    rejectUnknownFields(input, ['productId', 'quantity', 'unitPrice']);
    const productId = requireUuid(input.productId, `lines[${index}].productId`);
    const quantity = requireInteger(input.quantity, `lines[${index}].quantity`, {
      min: 1,
      max: 4294967295,
    });
    if (
      typeof input.unitPrice !== 'number' ||
      !Number.isFinite(input.unitPrice) ||
      input.unitPrice < 0 ||
      input.unitPrice > 9999999999.99 ||
      Math.abs(input.unitPrice * 100 - Math.round(input.unitPrice * 100)) > 1e-8
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `lines[${index}].unitPrice must be a non-negative number with at most two decimal places`,
      );
    }
    const cents = BigInt(Math.round(input.unitPrice * 100));
    return {
      productId,
      quantity,
      unitPrice: (Number(cents) / 100).toFixed(2),
      lineTotalCents: cents * BigInt(quantity),
    };
  });
}

function calculateOrderTotal(lines) {
  const totalCents = lines.reduce((total, line) => total + line.lineTotalCents, 0n);
  if (totalCents > 999999999999n) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Order total exceeds the supported amount');
  }
  return `${totalCents / 100n}.${String(totalCents % 100n).padStart(2, '0')}`;
}

function validateOrder(body, { partyField, partial = false } = {}) {
  const input = requireObject(body);
  const allowedFields = [
    'orderNumber',
    partyField,
    'warehouseId',
    'status',
    'orderDate',
    'dueDate',
    'lines',
    'notes',
  ];
  rejectUnknownFields(input, allowedFields);
  if (partial && Object.keys(input).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one order field is required');
  }

  const values = {};
  if (!partial || input.orderNumber !== undefined) {
    values.orderNumber = requireString(input.orderNumber, 'orderNumber', { max: 40 });
  }
  if (!partial || input[partyField] !== undefined) {
    values[partyField] = requireUuid(input[partyField], partyField);
  }
  if (input.warehouseId !== undefined) {
    values.warehouseId =
      input.warehouseId === null ? null : requireUuid(input.warehouseId, 'warehouseId');
  }
  if (input.status !== undefined) {
    if (!['DRAFT', 'COMPLETED', 'CANCELLED'].includes(input.status)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'status must be DRAFT, COMPLETED, or CANCELLED');
    }
    values.status = input.status;
  }
  if (!partial || input.orderDate !== undefined) {
    values.orderDate =
      input.orderDate === undefined && !partial
        ? new Date().toISOString().slice(0, 10)
        : validateDate(input.orderDate, 'orderDate');
  }
  if (input.dueDate !== undefined) {
    values.dueDate =
      input.dueDate === null ? null : validateDate(input.dueDate, 'dueDate');
  }
  if (!partial || input.lines !== undefined) {
    const lines = validateLines(input.lines);
    values.lines = lines.map(({ lineTotalCents, ...line }) => line);
    values.totalAmount = calculateOrderTotal(lines);
  }
  if (input.notes !== undefined) {
    values.notes = nullableString(input, 'notes', 1000, { allowEmpty: true }) || null;
  }
  const orderDate = values.orderDate || input.orderDate;
  const dueDate = values.dueDate || input.dueDate;
  if (orderDate && dueDate && dueDate < orderDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'dueDate cannot be earlier than orderDate');
  }
  return values;
}

function validateInventoryMovement(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, ['productId', 'warehouseId', 'type', 'quantity', 'reference', 'note']);
  if (!['IN', 'OUT'].includes(input.type)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'type must be IN or OUT');
  }
  const values = {
    productId: requireUuid(input.productId, 'productId'),
    type: input.type,
    quantity: requireInteger(input.quantity, 'quantity', { min: 1, max: 4294967295 }),
    warehouseId:
      input.warehouseId === undefined || input.warehouseId === null
        ? null
        : requireUuid(input.warehouseId, 'warehouseId'),
  };
  for (const [field, max] of [['reference', 120], ['note', 500]]) {
    const value = nullableString(input, field, max, { allowEmpty: true });
    if (value !== undefined) values[field] = value || null;
  }
  return values;
}

module.exports = {
  validateContact,
  validateWarehouse,
  validateOrder,
  validateInventoryMovement,
};
