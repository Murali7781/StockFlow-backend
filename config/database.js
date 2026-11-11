const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql2 = require('mysql2');
const { Sequelize } = require('sequelize');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
}

function requireValue(environment, name) {
  if (environment[name] === undefined || environment[name] === '') {
    throw new Error(`Missing required database environment variable: ${name}`);
  }
  return environment[name];
}

function getPort(value, fallback, name) {
  const port = Number(value || fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

function getDatabaseConfig(environment = process.env) {
  const provider = (environment.DB_PROVIDER || 'local').toLowerCase();
  if (provider !== 'local' && provider !== 'tidb') {
    throw new Error('DB_PROVIDER must be either local or tidb');
  }

  const localVariableNames = [
    'LOCAL_DB_HOST',
    'LOCAL_DB_PORT',
    'LOCAL_DB_USER',
    'LOCAL_DB_PASSWORD',
    'LOCAL_DB_NAME',
  ];
  const hasPrefixedLocalConfig = localVariableNames.some(
    (name) => environment[name] !== undefined,
  );
  const useLegacyLocalConfig =
    provider === 'local' &&
    !hasPrefixedLocalConfig &&
    ['localhost', '127.0.0.1'].includes(environment.DB_HOST);
  const names =
    provider === 'tidb'
      ? {
          host: 'TIDB_HOST',
          port: 'TIDB_PORT',
          user: 'TIDB_USER',
          password: 'TIDB_PASSWORD',
          database: 'TIDB_NAME',
        }
      : useLegacyLocalConfig
        ? {
            host: 'DB_HOST',
            port: 'DB_PORT',
            user: 'DB_USER',
            password: 'DB_PASSWORD',
            database: 'DB_NAME',
          }
        : {
            host: 'LOCAL_DB_HOST',
            port: 'LOCAL_DB_PORT',
            user: 'LOCAL_DB_USER',
            password: 'LOCAL_DB_PASSWORD',
            database: 'LOCAL_DB_NAME',
          };
  const host = requireValue(environment, names.host);
  const user = requireValue(environment, names.user);
  const passwordName = names.password;
  if (environment[passwordName] === undefined) {
    throw new Error(`Missing required database environment variable: ${passwordName}`);
  }
  const database = requireValue(environment, names.database);
  const port = getPort(
    environment[names.port],
    provider === 'local' ? 3306 : 4000,
    names.port,
  );

  const dialectOptions = { connectTimeout: 10000 };
  if (provider === 'tidb') {
    const caPath = requireValue(environment, 'TIDB_CA_CERT_PATH');
    const resolvedCaPath = path.isAbsolute(caPath)
      ? caPath
      : path.resolve(__dirname, '..', caPath);
    let ca;
    try {
      ca = fs.readFileSync(resolvedCaPath, 'utf8');
    } catch {
      throw new Error('Unable to read TiDB CA certificate; verify TIDB_CA_CERT_PATH');
    }

    if (
      !ca.includes('-----BEGIN CERTIFICATE-----') ||
      !ca.includes('-----END CERTIFICATE-----')
    ) {
      throw new Error('TIDB_CA_CERT_PATH must point to a PEM-encoded CA certificate');
    }

    dialectOptions.ssl = { ca, rejectUnauthorized: true };
  }

  return {
    provider,
    database,
    user,
    password: environment[passwordName],
    options: {
      host,
      port,
      dialect: 'mysql',
      dialectModule: mysql2,
      logging: false,
      timezone: '+00:00',
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions,
    },
  };
}

const activeDatabaseConfig = getDatabaseConfig();
const sequelize = new Sequelize(
  activeDatabaseConfig.database,
  activeDatabaseConfig.user,
  activeDatabaseConfig.password,
  activeDatabaseConfig.options,
);

async function testConnection() {
  await sequelize.authenticate();
}

module.exports = {
  sequelize,
  testConnection,
  databaseProvider: activeDatabaseConfig.provider,
  databaseName: activeDatabaseConfig.database,
  getDatabaseConfig,
};
