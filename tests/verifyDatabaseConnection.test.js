const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyDatabaseConnection } = require('../utils/verifyDatabaseConnection');

function createSequelizeStub(database, tables) {
  const queries = [];
  return {
    queries,
    async authenticate() {
      queries.push('authenticate');
    },
    async query(sql) {
      queries.push(sql);
      if (sql === 'SELECT DATABASE() AS selectedDatabase') {
        return [[{ selectedDatabase: database }], []];
      }
      if (sql === 'SHOW TABLES') {
        return [tables.map((table) => ({ [`Tables_in_${database}`]: table })), []];
      }
      throw new Error(`Unexpected SQL query: ${sql}`);
    },
  };
}

test('TiDB startup verification confirms selected database and required tables', async () => {
  const sequelize = createSequelizeStub('stockflow_db', [
    'organizations',
    'users',
    'products',
    'settings',
    'suppliers',
    'customers',
    'warehouses',
    'warehouse_stocks',
    'inventory_movements',
    'purchase_orders',
    'sales_orders',
  ]);
  const result = await verifyDatabaseConnection({
    sequelize,
    provider: 'tidb',
    databaseName: 'stockflow_db',
  });

  assert.equal(result.databaseName, 'stockflow_db');
  assert.deepEqual(result.tables, [
    'organizations',
    'users',
    'products',
    'settings',
    'suppliers',
    'customers',
    'warehouses',
    'warehouse_stocks',
    'inventory_movements',
    'purchase_orders',
    'sales_orders',
  ]);
  assert.deepEqual(sequelize.queries, [
    'authenticate',
    'SELECT DATABASE() AS selectedDatabase',
    'SHOW TABLES',
  ]);
});

test('TiDB startup verification fails if the selected database differs', async () => {
  const sequelize = createSequelizeStub('newschema', []);
  await assert.rejects(
    verifyDatabaseConnection({
      sequelize,
      provider: 'tidb',
      databaseName: 'stockflow_db',
    }),
    /TiDB selected database mismatch/,
  );
});

test('local startup keeps its existing authenticate-only behavior', async () => {
  const sequelize = createSequelizeStub('stockflow', []);
  const result = await verifyDatabaseConnection({
    sequelize,
    provider: 'local',
    databaseName: 'stockflow',
  });

  assert.equal(result.databaseName, 'stockflow');
  assert.deepEqual(sequelize.queries, ['authenticate']);
});
