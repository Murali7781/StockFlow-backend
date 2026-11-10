const app = require('./app');
const { sequelize } = require('./models');
const { getEnvironment } = require('./config/environment');

async function startServer() {
  const { port } = getEnvironment();
  await sequelize.authenticate();
  await sequelize.sync();

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
        console.error('Database shutdown failed:', closeError);
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
  console.error('Failed to start StockFlow API:', error.message);
  try {
    await sequelize.close();
  } catch (closeError) {
    console.error('Failed to close database connection:', closeError.message);
  }
  process.exitCode = 1;
});
