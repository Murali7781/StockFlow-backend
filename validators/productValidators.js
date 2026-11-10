const {
  requireObject,
  rejectUnknownFields,
  requireString,
  optionalString,
  requireInteger,
  optionalPrice,
} = require('../utils/validation');

const productFields = [
  'name',
  'sku',
  'description',
  'quantityOnHand',
  'costPrice',
  'sellingPrice',
  'lowStockThreshold',
];

function validateProduct(body, { partial = false } = {}) {
  const input = requireObject(body);
  rejectUnknownFields(input, productFields);
  if (Object.keys(input).length === 0) {
    const AppError = require('../utils/AppError');
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one product field is required');
  }

  const result = {};
  for (const field of ['name', 'sku']) {
    if (input[field] !== undefined || !partial) {
      result[field] = requireString(input[field], field, {
        max: field === 'name' ? 160 : 80,
      });
    }
  }

  if (input.description !== undefined || !partial) {
    result.description =
      input.description === null
        ? null
        : optionalString(input.description ?? '', 'description', 10000, {
            allowEmpty: true,
          });
  }

  if (input.quantityOnHand !== undefined || !partial) {
    result.quantityOnHand = requireInteger(
      input.quantityOnHand === undefined
        ? partial
          ? undefined
          : 0
        : input.quantityOnHand,
      'quantityOnHand',
      { max: 4294967295 },
    );
  }

  for (const field of ['costPrice', 'sellingPrice']) {
    if (input[field] !== undefined || !partial) {
      result[field] = optionalPrice(input[field] ?? null, field);
    }
  }

  if (input.lowStockThreshold !== undefined || !partial) {
    result.lowStockThreshold =
      input.lowStockThreshold === undefined || input.lowStockThreshold === null
        ? null
        : requireInteger(input.lowStockThreshold, 'lowStockThreshold', {
            max: 4294967295,
          });
  }

  return result;
}

module.exports = { validateProduct };
