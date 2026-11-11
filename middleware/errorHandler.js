const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError,
} = require('sequelize');
const AppError = require('../utils/AppError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON' },
    });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the 1 MB limit' },
    });
  }

  let status = error.status || 500;
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected error occurred';

  if (error instanceof UniqueConstraintError) {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with the supplied unique value already exists';
  } else if (error instanceof ForeignKeyConstraintError) {
    status = 409;
    code = 'RESOURCE_IN_USE';
    message = 'This record is referenced by other records and cannot be changed or deleted';
  } else if (error instanceof ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = error.errors.map((item) => item.message).join(', ');
  } else if (!(error instanceof AppError)) {
3
    console.error('Unhandled request error:', {
      name: error.name,
      code: error.original?.code || error.code,
      method: req.method,
      path: req.path,
    });
    message = 'An unexpected error occurred';
  }

  const payload = { error: { code, message } };
  if (error.details) payload.error.details = error.details;
  return res.status(status).json(payload);
}

module.exports = errorHandler;
