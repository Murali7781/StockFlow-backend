process.env.DB_PROVIDER = 'local';
process.env.LOCAL_DB_HOST = 'localhost';
process.env.LOCAL_DB_PORT = '3306';
process.env.LOCAL_DB_NAME = 'stockflow_test';
process.env.LOCAL_DB_USER = 'test_user';
process.env.LOCAL_DB_PASSWORD = 'test_password';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-that-is-at-least-thirty-two-characters-long';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { QueryTypes } = require('sequelize');
const { Product, Setting, User, sequelize } = require('../models');
const authenticate = require('../middleware/authenticate');
const { list, create, update, remove } = require('../controllers/productController');
const { getSummary } = require('../controllers/dashboardController');

function replaceMethod(t, target, name, replacement) {
  const original = target[name];
  target[name] = replacement;
  t.after(() => {
    target[name] = original;
  });
}

test('product listing filters and searches only the authenticated organization', async (t) => {
  let query;
  replaceMethod(t, Product, 'findAndCountAll', async (options) => {
    query = options;
    return { count: 0, rows: [] };
  });

  const response = {};
  await list(
    {
      user: { organizationId: 'tenant-a' },
      query: { search: 'widget', page: '1', limit: '10' },
    },
    {
      json(body) {
        response.body = body;
        return this;
      },
    },
  );

  assert.equal(query.where.organizationId, 'tenant-a');
  assert.equal(query.where[Object.getOwnPropertySymbols(query.where)[0]].length, 2);
  assert.equal(response.body.data.pagination.total, 0);
});

test('product creation uses server identity and rejects client organization IDs', async (t) => {
  let values;
  replaceMethod(t, Product, 'create', async (attributes) => {
    values = attributes;
    return attributes;
  });

  const response = {};
  await create(
    {
      user: { id: 'user-a', organizationId: 'tenant-a' },
      body: { name: 'Widget', sku: 'W-001', quantityOnHand: 2 },
    },
    {
      status(status) {
        response.status = status;
        return this;
      },
      json(body) {
        response.body = body;
        return this;
      },
    },
  );

  assert.equal(values.organizationId, 'tenant-a');
  assert.equal(values.lastUpdatedBy, 'user-a');
  assert.equal(response.status, 201);

  await assert.rejects(
    create(
      {
        user: { id: 'user-a', organizationId: 'tenant-a' },
        body: {
          name: 'Widget',
          sku: 'W-002',
          organizationId: 'tenant-b',
        },
      },
      { status() { return this; }, json() { return this; } },
    ),
    { code: 'VALIDATION_ERROR' },
  );
});

test('product updates look up the product inside the authenticated organization', async (t) => {
  const product = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Widget',
    async save() {},
  };
  let findQuery;
  replaceMethod(t, Product, 'findOne', async (options) => {
    findQuery = options;
    return product;
  });

  const response = {};
  await update(
    {
      user: { id: 'user-a', organizationId: 'tenant-a' },
      params: { id: product.id },
      body: { name: 'Updated widget' },
    },
    {
      json(body) {
        response.body = body;
        return this;
      },
    },
  );

  assert.deepEqual(findQuery.where, {
    id: product.id,
    organizationId: 'tenant-a',
  });
  assert.equal(product.name, 'Updated widget');
  assert.equal(response.body.data, product);
});

test('product deletion preserves related records and deletes an unreferenced tenant product', async (t) => {
  const productId = '00000000-0000-4000-8000-000000000001';
  const organizationId = 'tenant-a';
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let destroyed = false;
  const product = {
    async destroy(options) {
      assert.equal(options.transaction, transaction);
      destroyed = true;
    },
  };
  const referenceChecks = [];

  replaceMethod(t, sequelize, 'transaction', async (callback) => callback(transaction));
  replaceMethod(t, Product, 'findOne', async (options) => {
    assert.deepEqual(options.where, { id: productId, organizationId });
    return product;
  });
  replaceMethod(t, sequelize, 'query', async (sql, options) => {
    referenceChecks.push({ sql, options });
    return [];
  });

  const response = {};
  await remove(
    { user: { organizationId }, params: { id: productId } },
    {
      status(status) {
        response.status = status;
        return this;
      },
      end() {
        response.ended = true;
        return this;
      },
    },
  );

  assert.equal(referenceChecks.length, 4);
  assert.ok(referenceChecks.every(({ options }) => options.replacements.productId === productId));
  assert.ok(referenceChecks.every(({ options }) => options.replacements.organizationId === organizationId));
  assert.ok(referenceChecks.every(({ sql }) => sql.includes('SELECT 1')));
  assert.equal(destroyed, true);
  assert.equal(response.status, 204);
  assert.equal(response.ended, true);
});

test('product deletion preserves its existing inventory history', async (t) => {
  const productId = '00000000-0000-4000-8000-000000000001';
  const organizationId = 'tenant-a';
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  let destroyed = false;
  const product = {
    async destroy() {
      destroyed = true;
    },
  };
  let queryCount = 0;

  replaceMethod(t, sequelize, 'transaction', async (callback) => callback(transaction));
  replaceMethod(t, Product, 'findOne', async () => product);
  replaceMethod(t, sequelize, 'query', async (sql, options) => {
    queryCount += 1;
    assert.ok(sql.includes('SELECT 1'));
    assert.equal(options.replacements.productId, productId);
    assert.equal(options.replacements.organizationId, organizationId);
    return sql.includes('inventory_movements') ? [{ exists: 1 }] : [];
  });

  await assert.rejects(
    remove(
      { user: { organizationId }, params: { id: productId } },
      { status() { return this; }, end() { return this; } },
    ),
    { code: 'PRODUCT_IN_USE' },
  );
  assert.equal(queryCount, 4);
  assert.equal(destroyed, false);
});

test('a product from another organization cannot be deleted', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  replaceMethod(t, sequelize, 'transaction', async (callback) => callback(transaction));
  replaceMethod(t, Product, 'findOne', async () => null);
  replaceMethod(t, sequelize, 'query', async () => {
    assert.fail('Legacy movement references must not be queried for an inaccessible product');
  });

  await assert.rejects(
    remove(
      {
        user: { organizationId: 'tenant-a' },
        params: { id: '00000000-0000-4000-8000-000000000001' },
      },
      { status() { return this; }, end() { return this; } },
    ),
    { code: 'PRODUCT_NOT_FOUND' },
  );
});

test('dashboard returns tenant-scoped stock totals and low-stock products', async (t) => {
  const organizationId = 'tenant-a';
  const queries = [];
  const lowStockProducts = [{
    id: 'product-a',
    name: 'Widget',
    sku: 'W-001',
    quantityOnHand: 2,
    lowStockThreshold: null,
  }];

  replaceMethod(t, Setting, 'findOne', async (options) => {
    assert.deepEqual(options.where, { organizationId });
    return { defaultLowStockThreshold: 5 };
  });
  replaceMethod(t, Product, 'count', async (options) => {
    queries.push(options);
    return options.where[Object.getOwnPropertySymbols(options.where)[0]] ? 1 : 2;
  });
  replaceMethod(t, Product, 'sum', async (field, options) => {
    assert.equal(field, 'quantityOnHand');
    queries.push(options);
    return 8;
  });
  replaceMethod(t, Product, 'findAll', async (options) => {
    queries.push(options);
    return lowStockProducts;
  });

  const response = {};
  await getSummary(
    { user: { organizationId } },
    {
      json(body) {
        response.body = body;
        return this;
      },
    },
  );

  assert.equal(queries.length, 4);
  assert.ok(queries.every((query) => query.where.organizationId === organizationId));
  assert.equal(response.body.data.totalProducts, 2);
  assert.equal(response.body.data.totalStockQuantity, 8);
  assert.equal(response.body.data.lowStockCount, 1);
  assert.equal(response.body.data.defaultLowStockThreshold, 5);
  assert.deepEqual(response.body.data.lowStockProducts, lowStockProducts);
  assert.equal(response.body.data.lowStockProductsTruncated, false);
});

test('authentication derives organization from the database, not token claims', async (t) => {
  replaceMethod(t, User, 'findByPk', async (id) => ({
    id,
    email: 'owner@example.com',
    organizationId: 'tenant-a',
  }));
  const token = jwt.sign(
    { organizationId: 'tenant-b' },
    process.env.JWT_SECRET,
    { subject: 'user-a', algorithm: 'HS256' },
  );
  const req = {
    get(name) {
      return name === 'authorization' ? `Bearer ${token}` : undefined;
    },
  };
  let middlewareError;
  await authenticate(req, {}, (error) => {
    middlewareError = error;
  });

  assert.equal(middlewareError, undefined);
  assert.equal(req.user.organizationId, 'tenant-a');
});
