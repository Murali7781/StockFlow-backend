const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-for-tests';
process.env.DB_PROVIDER = 'local';
process.env.LOCAL_DB_HOST ||= 'localhost';
process.env.LOCAL_DB_PORT ||= '3306';
process.env.LOCAL_DB_USER ||= 'test';
process.env.LOCAL_DB_PASSWORD ||= '';
process.env.LOCAL_DB_NAME ||= 'stockflow_test';

const app = require('../app');

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
      { path: '/api/products', method: 'GET', status: 401 },
      { path: '/api/dashboard', method: 'GET', status: 401 },
      { path: '/api/settings', method: 'GET', status: 401 },
    ];
    for (const route of coreRoutes) {
      const response = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        ...(route.body
          ? {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(route.body),
            }
          : {}),
      });
      assert.equal(response.status, route.status, `${route.method} ${route.path}`);
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
