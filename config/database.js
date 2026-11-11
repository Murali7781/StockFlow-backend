const fs = require('node:fs');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');
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

function logDatabaseDiagnostics(diagnostics) {
  console.info(`[database] TiDB provider selected: ${diagnostics.providerIsTiDB}`);
  console.info(`[database] TiDB CA path configured: ${diagnostics.certificatePathConfigured}`);
  console.info(`[database] TiDB CA file exists: ${diagnostics.certificateFileExists}`);
  console.info(`[database] TiDB CA file readable: ${diagnostics.certificateFileReadable}`);
  console.info(`[database] TiDB CA inline content configured: ${diagnostics.inlineCertificateConfigured}`);
  console.info(`[database] TiDB CA source selected: ${diagnostics.certificateSource}`);
  console.info(`[database] TiDB CA certificate valid: ${diagnostics.certificateValid}`);
  console.info(`[database] Database configuration valid: ${diagnostics.databaseConfigurationValid}`);
}

function getDatabaseConfig(environment = process.env, diagnostics) {
  const provider = (environment.DB_PROVIDER || 'local').toLowerCase();
  if (diagnostics) {
    diagnostics.providerIsTiDB = provider === 'tidb';
    diagnostics.certificatePathConfigured =
      provider === 'tidb' &&
      typeof environment.TIDB_CA_CERT_PATH === 'string' &&
      Boolean(environment.TIDB_CA_CERT_PATH.trim());
    diagnostics.inlineCertificateConfigured =
      provider === 'tidb' &&
      [environment.TIDB_CA_CERT, environment.DB_CA_CERT].some(
        (certificate) => typeof certificate === 'string' && Boolean(certificate.trim()),
      );
  }
  if (provider !== 'local' && provider !== 'tidb') {
    throw new Error('DB_PROVIDER must be either local or tidb');
  }

  const dialectOptions = { connectTimeout: 10000 };
  if (provider === 'tidb') {
    const caPath =
      typeof environment.TIDB_CA_CERT_PATH === 'string'
        ? environment.TIDB_CA_CERT_PATH.trim()
        : '';
    const resolvedCaPath = caPath
      ? path.isAbsolute(caPath)
        ? caPath
        : path.resolve(__dirname, '..', caPath)
      : '';
    if (diagnostics && resolvedCaPath) {
      diagnostics.certificateFileExists = fs.existsSync(resolvedCaPath);
    }
    const tidbInlineCertificate =
      typeof environment.TIDB_CA_CERT === 'string' ? environment.TIDB_CA_CERT : '';
    const legacyInlineCertificate =
      typeof environment.DB_CA_CERT === 'string' ? environment.DB_CA_CERT : '';
    const validateCertificate = (certificate) => {
      if (!certificate.trim()) return false;
      const certificates =
        certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
      const contentOutsideCertificates = certificate
        .replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, '');
      const certificatesAreValid =
        certificates.length > 0 &&
        !contentOutsideCertificates &&
        certificates.every((pemCertificate) => {
          try {
            new X509Certificate(pemCertificate);
            return true;
          } catch {
            return false;
          }
        });
      return certificatesAreValid;
    };

    let ca;
    if (tidbInlineCertificate.trim()) {
      if (!validateCertificate(tidbInlineCertificate)) {
        throw new Error(
          'TiDB CA certificate must contain one or more valid PEM-encoded X.509 certificates.',
        );
      }
      ca = tidbInlineCertificate;
      if (diagnostics) diagnostics.certificateSource = 'inline';
    } else if (
      legacyInlineCertificate.trim() &&
      validateCertificate(legacyInlineCertificate)
    ) {
      ca = legacyInlineCertificate;
      if (diagnostics) diagnostics.certificateSource = 'inline';
    } else if (caPath) {
      try {
        const stats = fs.statSync(resolvedCaPath);
        if (!stats.isFile()) throw new Error('TiDB CA path is not a file');
        fs.accessSync(resolvedCaPath, fs.constants.R_OK);
        if (diagnostics) diagnostics.certificateFileReadable = true;
        ca = fs.readFileSync(resolvedCaPath, 'utf8');
      } catch {
        throw new Error(
          'Unable to read TiDB CA certificate; verify TIDB_CA_CERT_PATH points to an existing readable file.',
        );
      }
      if (diagnostics) diagnostics.certificateSource = 'file';
      if (!ca.trim()) {
        throw new Error('TiDB CA certificate is empty.');
      }
      if (!validateCertificate(ca)) {
        throw new Error(
          'TiDB CA certificate must contain one or more valid PEM-encoded X.509 certificates.',
        );
      }
    } else if (legacyInlineCertificate.trim()) {
      throw new Error(
        'TiDB CA certificate must contain one or more valid PEM-encoded X.509 certificates.',
      );
    } else {
      throw new Error(
        'Configure TIDB_CA_CERT with valid PEM content or set TIDB_CA_CERT_PATH to a readable CA certificate file.',
      );
    }
    if (diagnostics) diagnostics.certificateValid = true;
    dialectOptions.ssl = { ca, rejectUnauthorized: true };
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

  const config = {
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
  if (diagnostics) diagnostics.databaseConfigurationValid = true;
  return config;
}

const databaseDiagnostics = {
  providerIsTiDB: false,
  certificatePathConfigured: false,
  certificateFileExists: false,
  certificateFileReadable: false,
  inlineCertificateConfigured: false,
  certificateSource: 'none',
  certificateValid: false,
  databaseConfigurationValid: false,
};
let activeDatabaseConfig;
try {
  activeDatabaseConfig = getDatabaseConfig(process.env, databaseDiagnostics);
} catch (error) {
  logDatabaseDiagnostics(databaseDiagnostics);
  throw error;
}
logDatabaseDiagnostics(databaseDiagnostics);
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
