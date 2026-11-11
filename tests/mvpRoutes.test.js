const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-tests';
process.env.DB_PROVIDER = 'local';
process.env.LOCAL_DB_HOST ||= 'localhost';
process.env.LOCAL_DB_PORT ||= '3306';
process.env.LOCAL_DB_USER ||= 'test';
process.env.LOCAL_DB_PASSWORD ||= '';
process.env.LOCAL_DB_NAME ||= 'stockflow_test';
process.env.CORS_ORIGINS = 'https://frontend.example/';

const app = require('../app');
const { User } = require('../models');

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
          'access-control-request-headers': 'content-type',
        },
      },
    );

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://frontend.example',
    );
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
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
