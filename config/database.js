const path = require('node:path');
const dotenv = require('dotenv');
const { Sequelize } = require('sequelize');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const requiredEnvironmentVariables = ['DB_NAME', 'DB_USER'];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name],
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Missing required database environment variables: ${missingEnvironmentVariables.join(', ')}`,
  );
}

const port = Number(process.env.DB_PORT || 3306);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT must be an integer between 1 and 65535');
}

const databaseSslValue = (process.env.DB_SSL || 'false').toLowerCase();
if (databaseSslValue !== 'true' && databaseSslValue !== 'false') {
  throw new Error('DB_SSL must be set to true or false');
}

const databaseSsl = databaseSslValue === 'true';
const databaseCa = process.env.DB_SSL_CA?.replace(/\\n/g, '\n');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port,
    dialect: 'mysql',
    logging: false,
    timezone: '+00:00',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 10000,
      ...(databaseSsl
        ? {
            ssl: {
              rejectUnauthorized: true,
              ...(databaseCa ? { ca: databaseCa } : {}),
            },
          }
        : {}),
    },
  },
);

async function testConnection() {
  await sequelize.authenticate();
}

module.exports = { sequelize, testConnection };
