const {
  requireObject,
  rejectUnknownFields,
  requireInteger,
} = require('../utils/validation');
const AppError = require('../utils/AppError');

function validateSetting(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, ['defaultLowStockThreshold']);
  if (input.defaultLowStockThreshold === undefined) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'defaultLowStockThreshold is required',
    );
  }
  return {
    defaultLowStockThreshold: requireInteger(
      input.defaultLowStockThreshold,
      'defaultLowStockThreshold',
      { max: 4294967295 },
    ),
  };
}

module.exports = { validateSetting };
