const { QueryTypes } = require('sequelize');
const { formatDatabaseError } = require('../utils/databaseErrors');

const requestedProvider = process.argv[2];
if (requestedProvider && !['local', 'tidb'].includes(requestedProvider)) {
  console.error('Usage: node scripts/test-db-connection.js [local|tidb]');
  process.exit(1);
}
if (requestedProvider) process.env.DB_PROVIDER = requestedProvider;

async function main() {
  let sequelize;

  try {
    const models = require('../models');
    ({ sequelize } = models);

    await sequelize.authenticate();
    console.log(
      `${models.sequelize.options.host} (${process.env.DB_PROVIDER || 'local'}): database connection established.`,
    );

    const [tables, columns, relationships] = await Promise.all([
      sequelize.query(
        `SELECT table_name AS tableName
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        { type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `SELECT table_name AS tableName,
                column_name AS columnName,
                column_type AS columnType,
                is_nullable AS isNullable,
                column_key AS columnKey
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
         ORDER BY table_name, ordinal_position`,
        { type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `SELECT table_name AS tableName,
                column_name AS columnName,
                referenced_table_name AS referencedTableName,
                referenced_column_name AS referencedColumnName
         FROM information_schema.key_column_usage
         WHERE table_schema = DATABASE()
           AND referenced_table_name IS NOT NULL
         ORDER BY table_name, column_name`,
        { type: QueryTypes.SELECT },
      ),
    ]);

    const tableNames = new Set(tables.map(({ tableName }) => tableName));
    const missingTables = Object.values(models)
      .filter((model) => model?.rawAttributes)
      .map((model) => model.getTableName())
      .filter((tableName) => !tableNames.has(tableName));
    const columnsByTable = new Map();
    for (const column of columns) {
      if (!columnsByTable.has(column.tableName)) {
        columnsByTable.set(column.tableName, new Set());
      }
      columnsByTable.get(column.tableName).add(column.columnName);
    }

    const missingColumns = Object.values(models)
      .filter((model) => model?.rawAttributes)
      .flatMap((model) => {
        const tableName = model.getTableName();
        const actualColumns = columnsByTable.get(tableName) || new Set();
        return Object.values(model.rawAttributes)
          .map((attribute) => attribute.field)
          .filter((columnName) => !actualColumns.has(columnName))
          .map((columnName) => `${tableName}.${columnName}`);
      });
    const expectedRelationships = [
      ['users', 'organization_id', 'organizations', 'id'],
      ['products', 'organization_id', 'organizations', 'id'],
      ['settings', 'organization_id', 'organizations', 'id'],
      ['suppliers', 'organization_id', 'organizations', 'id'],
      ['customers', 'organization_id', 'organizations', 'id'],
      ['warehouses', 'organization_id', 'organizations', 'id'],
      ['warehouse_stocks', 'organization_id', 'organizations', 'id'],
      ['warehouse_stocks', 'product_id', 'products', 'id'],
      ['warehouse_stocks', 'warehouse_id', 'warehouses', 'id'],
      ['inventory_movements', 'organization_id', 'organizations', 'id'],
      ['inventory_movements', 'product_id', 'products', 'id'],
      ['inventory_movements', 'warehouse_id', 'warehouses', 'id'],
      ['purchase_orders', 'organization_id', 'organizations', 'id'],
      ['purchase_orders', 'supplier_id', 'suppliers', 'id'],
      ['purchase_orders', 'warehouse_id', 'warehouses', 'id'],
      ['sales_orders', 'organization_id', 'organizations', 'id'],
      ['sales_orders', 'customer_id', 'customers', 'id'],
      ['sales_orders', 'warehouse_id', 'warehouses', 'id'],
    ];
    const relationshipStatus = expectedRelationships.map(
      ([tableName, columnName, referencedTableName, referencedColumnName]) => ({
        tableName,
        columnName,
        referencedTableName,
        referencedColumnName,
        databaseForeignKey: relationships.some(
          (relationship) =>
            relationship.tableName === tableName &&
            relationship.columnName === columnName &&
            relationship.referencedTableName === referencedTableName &&
            relationship.referencedColumnName === referencedColumnName,
        ),
      }),
    );
    const missingRelationships = relationshipStatus
      .filter(({ databaseForeignKey }) => !databaseForeignKey)
      .map(
        ({ tableName, columnName, referencedTableName, referencedColumnName }) =>
          `${tableName}.${columnName} -> ${referencedTableName}.${referencedColumnName}`,
      );

    console.log('Tables:', tables.map(({ tableName }) => tableName).join(', ') || '(none)');

    if (missingTables.length || missingColumns.length || missingRelationships.length) {
      const missing = [
        ...missingTables.map((tableName) => `table ${tableName}`),
        ...missingColumns.map((columnName) => `column ${columnName}`),
        ...missingRelationships.map((relationship) => `foreign key ${relationship}`),
      ];
      throw new Error(`Database schema is missing required ${missing.join(', ')}`);
    }

    console.log('Required application schema verified.');
    console.log('Columns:');
    console.table(columns);
    console.log('Application relationships and database foreign-key status:');
    console.table(relationshipStatus);
    console.log('All database foreign-key relationships:');
    console.table(relationships);
  } catch (error) {
    console.error(`Database validation failed: ${formatDatabaseError(error)}`);
    process.exitCode = 1;
  } finally {
    if (sequelize) {
      try {
        await sequelize.close();
      } catch (error) {
        console.error(`Failed to close database connection: ${formatDatabaseError(error)}`);
        process.exitCode = 1;
      }
    }
  }
}

main();
