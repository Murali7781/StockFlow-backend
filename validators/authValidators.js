const AppError = require('../utils/AppError');
const {
  requireObject,
  rejectUnknownFields,
  requireString,
} = require('../utils/validation');

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new AppError(400, 'VALIDATION_ERROR', 'password must be at least 8 characters');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw new AppError(400, 'VALIDATION_ERROR', 'password must be no more than 72 UTF-8 bytes');
  }
  return value;
}

function validateRegistration(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, [
    'email',
    'password',
    'confirmPassword',
    'organizationName',
  ]);

  const email = requireString(input.email, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'email must be a valid email address');
  }

  const password = validatePassword(input.password);
  if (typeof input.confirmPassword !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'confirmPassword is required');
  }
  if (input.confirmPassword !== password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'passwords do not match');
  }

  return {
    email,
    password,
    organizationName: requireString(input.organizationName, 'organizationName', {
      max: 120,
    }),
  };
}

function validateLogin(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, ['email', 'password']);
  const email = requireString(input.email, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'email must be a valid email address');
  }

  return {
    email,
    password: validatePassword(input.password),
  };
}

module.exports = { validateRegistration, validateLogin };
