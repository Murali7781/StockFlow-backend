const { UniqueConstraintError } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize, Organization, User, Setting } = require('../models');
const { getEnvironment } = require('../config/environment');
const AppError = require('../utils/AppError');
const {
  validateRegistration,
  validateLogin,
} = require('../validators/authValidators');

function createAccessToken(user) {
  const { jwtSecret, jwtExpiresIn } = getEnvironment();
  return jwt.sign(
    { email: user.email },
    jwtSecret,
    {
      algorithm: 'HS256',
      subject: user.id,
      expiresIn: jwtExpiresIn,
    },
  );
}

function userResponse(user, organization) {
  return {
    id: user.id,
    email: user.email,
    organization: {
      id: organization.id,
      name: organization.name,
    },
  };
}

async function register(req, res) {
  const input = validateRegistration(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);

  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      const organization = await Organization.create(
        { name: input.organizationName },
        { transaction },
      );
      await Setting.create(
        { organizationId: organization.id, defaultLowStockThreshold: 5 },
        { transaction },
      );
      const user = await User.create(
        {
          organizationId: organization.id,
          email: input.email,
          passwordHash,
        },
        { transaction },
      );

      return { organization, user };
    });
  } catch (error) {
    if (
      error instanceof UniqueConstraintError &&
      error.errors?.some((item) => item.path === 'email')
    ) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists',
      );
    }
    throw error;
  }

  return res.status(201).json({
    data: {
      token: createAccessToken(result.user),
      user: userResponse(result.user, result.organization),
    },
  });
}

async function login(req, res) {
  const input = validateLogin(req.body);
  const user = await User.findOne({
    where: { email: input.email },
    include: [{ model: Organization, required: true }],
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  return res.json({
    data: {
      token: createAccessToken(user),
      user: userResponse(user, user.Organization),
    },
  });
}

module.exports = { register, login };
