const app = require('./app');
const { sequelize } = require('./models');
const { databaseProvider, databaseName } = require('./config/database');
const { getEnvironment } = require('./config/environment');
const { formatDatabaseError } = require('./utils/databaseErrors');
const { verifyDatabaseConnection } = require('./utils/verifyDatabaseConnection');

async function startServer() {
  const { port } = getEnvironment();
  const connection = await verifyDatabaseConnection({
    sequelize,
    provider: databaseProvider,
    databaseName,
  });
  if (connection.provider === 'tidb') {
    console.log('TiDB Cloud database connected successfully.');
    console.log(`TiDB database selected: ${connection.databaseName}`);
    console.log(`TiDB StockFlow tables accessible: ${connection.tables.join(', ')}`);
  }

  const server = app.listen(port, () => {
    console.log(`StockFlow API listening on port ${port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down gracefully.`);

    server.close(async (error) => {
      if (error) {
        console.error('HTTP server shutdown failed:', error);
        process.exitCode = 1;
      }
      try {
        await sequelize.close();
      } catch (closeError) {
        console.error('Database shutdown failed:', formatDatabaseError(closeError));
        process.exitCode = 1;
      } finally {
        if (error || process.exitCode) process.exit(1);
      }
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch(async (error) => {
  console.error('Failed to start StockFlow API:', formatDatabaseError(error));
  try {
    await sequelize.close();
  } catch (closeError) {
    console.error('Failed to close database connection:', formatDatabaseError(closeError));
  }
  process.exitCode = 1;
});
