const AppError = require('./AppError');

function requireObject(value, label = 'Request body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} must be a JSON object`);
  }
  return value;
}

function rejectUnknownFields(value, allowedFields) {
  const unknownFields = Object.keys(value).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Unsupported field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')}`,
    );
  }
}

function requireString(value, field, { min = 1, max, trim = true } = {}) {
  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a string`);
  }

  const normalized = trim ? value.trim() : value;
  if (normalized.length < min || (max !== undefined && normalized.length > max)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${field} must be between ${min} and ${max ?? 'unlimited'} characters`,
    );
  }
  return normalized;
}

function optionalString(value, field, max, { allowEmpty = false } = {}) {
  if (value === null && allowEmpty) return null;
  const normalized = requireString(value, field, { min: allowEmpty ? 0 : 1, max });
  return normalized || (allowEmpty ? null : normalized);
}

function requireInteger(value, field, { min = 0, max = 2147483647 } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${field} must be an integer between ${min} and ${max}`,
    );
  }
  return value;
}

function optionalPrice(value, field) {
  if (value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9999999999.99 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-8
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${field} must be a non-negative number with at most two decimal places`,
    );
  }
  return value.toFixed(2);
}

function requireUuid(value, field = 'id') {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be a valid UUID`);
  }
  return value;
}

module.exports = {
  requireObject,
  rejectUnknownFields,
  requireString,
  optionalString,
  requireInteger,
  optionalPrice,
  requireUuid,
};
