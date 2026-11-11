const REQUIRED_TIDB_TABLES = [
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
];

async function verifyDatabaseConnection({ sequelize, provider, databaseName }) {
  await sequelize.authenticate();

  if (provider !== 'tidb') return { provider, databaseName };

  const [databaseRows] = await sequelize.query('SELECT DATABASE() AS selectedDatabase');
  const selectedDatabase = databaseRows[0]?.selectedDatabase;
  if (selectedDatabase !== databaseName) {
    throw new Error(
      `TiDB selected database mismatch: expected ${databaseName}, received ${selectedDatabase || '(none)'}`,
    );
  }

  const [tableRows] = await sequelize.query('SHOW TABLES');
  const tables = tableRows.map((row) => Object.values(row)[0]);
  const missingTables = REQUIRED_TIDB_TABLES.filter((table) => !tables.includes(table));
  if (missingTables.length > 0) {
    throw new Error(
      `TiDB database ${databaseName} is missing required StockFlow tables: ${missingTables.join(', ')}`,
    );
  }

  return { provider, databaseName: selectedDatabase, tables };
}

module.exports = { verifyDatabaseConnection };
