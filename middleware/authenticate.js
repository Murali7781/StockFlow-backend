const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { getEnvironment } = require('../config/environment');
const AppError = require('../utils/AppError');

async function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'A bearer token is required'));
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'A bearer token is required'));
  }

  let claims;
  try {
    claims = jwt.verify(token, getEnvironment().jwtSecret, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? 'The access token has expired'
        : 'The access token is invalid';
    return next(new AppError(401, 'INVALID_TOKEN', message));
  }

  if (!claims || typeof claims !== 'object' || typeof claims.sub !== 'string') {
    return next(new AppError(401, 'INVALID_TOKEN', 'The access token is invalid'));
  }

  const user = await User.findByPk(claims.sub, {
    attributes: ['id', 'email', 'organizationId'],
  });
  if (!user) {
    return next(new AppError(401, 'INVALID_TOKEN', 'The account is no longer available'));
  }

  req.user = {
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
  };
  return next();
}

module.exports = authenticate;
