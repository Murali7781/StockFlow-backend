async function main() {
  let sequelize;

  try {
    const database = require('../config/database');
    sequelize = database.sequelize;
    const { testConnection } = database;

    await testConnection();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

main();
