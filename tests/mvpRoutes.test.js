const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-tests';
process.env.DB_PROVIDER = 'local';
process.env.LOCAL_DB_HOST ||= 'localhost';
process.env.LOCAL_DB_PORT ||= '3306';
process.env.LOCAL_DB_USER ||= 'test';
process.env.LOCAL_DB_PASSWORD ||= '';
process.env.LOCAL_DB_NAME ||= 'stockflow_test';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'https://frontend.example/';

const app = require('../app');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Organization, Product, Setting, User, sequelize } = require('../models');
const { getCorsOrigins } = require('../config/environment');

test('CORS origins are explicit, normalized, and environment-aware', () => {
  assert.deepEqual(
    getCorsOrigins({
      NODE_ENV: 'production',
      CORS_ORIGINS: ' https://custom.example/ , https://second.example/// ',
    }),
    [
      'https://stock-flow-frontend-murex.vercel.app',
      'https://custom.example',
      'https://second.example',
    ],
  );
  assert.deepEqual(
    getCorsOrigins({ NODE_ENV: 'development', CORS_ORIGINS: '' }),
    [
      'https://stock-flow-frontend-murex.vercel.app',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
  );
});

test('only the four core MVP API modules are mounted', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const coreRoutes = [
      { path: '/api/auth/login', method: 'POST', body: {}, status: 400 },
      { path: '/api/auth/register', method: 'POST', body: {}, status: 400 },
      { path: '/auth/login', method: 'POST', body: {}, status: 404 },
      { path: '/api/products', method: 'GET', status: 401 },
      { path: '/api/dashboard', method: 'GET', status: 401 },
      { path: '/api/settings', method: 'GET', status: 401 },
    ];
    for (const route of coreRoutes) {
      const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          origin: 'https://frontend.example',
          ...(route.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(route.body
          ? {
              body: JSON.stringify(route.body),
            }
          : {}),
      });
      assert.equal(response.status, route.status, `${route.method} ${route.path}`);
      assert.equal(
        response.headers.get('access-control-allow-origin'),
        'https://frontend.example',
        `${route.method} ${route.path} CORS header`,
      );
    }

    const disabledRoutes = [
      '/api/suppliers',
      '/api/customers',
      '/api/warehouses',
      '/api/purchase-orders',
      '/api/sales-orders',
      '/api/inventory',
      '/api/inventory/movements',
    ];
    for (const route of disabledRoutes) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 404, `GET ${route}`);
      assert.equal((await response.json()).error.code, 'NOT_FOUND');
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('auth preflight is handled for an allowed frontend origin', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/login`,
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://frontend.example',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      },
    );

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://frontend.example',
    );
    assert.equal(
      response.headers.get('access-control-allow-methods'),
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
    assert.match(response.headers.get('access-control-allow-headers'), /authorization/i);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('CORS does not grant an untrusted origin access', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/login`,
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://untrusted.example',
          'access-control-request-method': 'POST',
        },
      },
    );

    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('CORS headers are preserved when the error handler returns a 500', async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => {
    throw new Error('Expected test database failure');
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          origin: 'https://frontend.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'valid-test-password',
        }),
      },
    );

    assert.equal(response.status, 500);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://frontend.example',
    );
  } finally {
    User.findOne = originalFindOne;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('registration, login, and a bearer-token protected request work without database writes', async () => {
  const originals = {
    organizationCreate: Organization.create,
    settingCreate: Setting.create,
    transaction: sequelize.transaction,
    userCreate: User.create,
    userFindOne: User.findOne,
    userFindByPk: User.findByPk,
    productFindAndCountAll: Product.findAndCountAll,
  };
  const organization = { id: 'test-organization', name: 'Test Organization' };
  let createdUser;
  let productQuery;

  Organization.create = async () => organization;
  Setting.create = async () => ({ organizationId: organization.id });
  sequelize.transaction = async (callback) => callback({});
  User.create = async (attributes) => {
    createdUser = { id: 'test-user', ...attributes };
    return createdUser;
  };
  User.findOne = async () => ({ ...createdUser, Organization: organization });
  User.findByPk = async () => ({
    id: createdUser.id,
    email: createdUser.email,
    organizationId: createdUser.organizationId,
  });
  Product.findAndCountAll = async (options) => {
    productQuery = options;
    return { count: 0, rows: [] };
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const origin = 'https://frontend.example';
    const password = 'correct-test-password';
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: organization.name,
        email: 'owner@example.com',
        password,
        confirmPassword: password,
      }),
    });

    assert.equal(registration.status, 201);
    assert.equal(registration.headers.get('access-control-allow-origin'), origin);
    assert.equal(await bcrypt.compare(password, createdUser.passwordHash), true);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password }),
    });
    const loginBody = await login.json();

    assert.equal(login.status, 200);
    assert.equal(login.headers.get('access-control-allow-origin'), origin);
    assert.equal(
      jwt.verify(loginBody.data.token, process.env.JWT_SECRET).sub,
      createdUser.id,
    );

    const protectedResponse = await fetch(`${baseUrl}/api/products`, {
      headers: {
        origin,
        authorization: `Bearer ${loginBody.data.token}`,
      },
    });

    assert.equal(protectedResponse.status, 200);
    assert.equal(protectedResponse.headers.get('access-control-allow-origin'), origin);
    assert.equal(productQuery.where.organizationId, organization.id);

    User.findOne = async () => null;
    const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'wrong-password' }),
    });
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.headers.get('access-control-allow-origin'), origin);
  } finally {
    Organization.create = originals.organizationCreate;
    Setting.create = originals.settingCreate;
    sequelize.transaction = originals.transaction;
    User.create = originals.userCreate;
    User.findOne = originals.userFindOne;
    User.findByPk = originals.userFindByPk;
    Product.findAndCountAll = originals.productFindAndCountAll;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('CORS headers are preserved for malformed JSON and database health failures', async () => {
  const { sequelize } = require('../models');
  const originalAuthenticate = sequelize.authenticate;
  sequelize.authenticate = async () => {
    throw new Error('Expected test database failure');
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const origin = 'https://frontend.example';
    const invalidJson = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(invalidJson.status, 400);
    assert.equal(invalidJson.headers.get('access-control-allow-origin'), origin);

    const health = await fetch(`${baseUrl}/api/health`, {
      headers: { origin },
    });
    assert.equal(health.status, 503);
    assert.equal(health.headers.get('access-control-allow-origin'), origin);
  } finally {
    sequelize.authenticate = originalAuthenticate;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
