const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PROVIDER = 'local';
process.env.LOCAL_DB_HOST = 'localhost';
process.env.LOCAL_DB_PORT = '3306';
process.env.LOCAL_DB_USER = 'test-user';
process.env.LOCAL_DB_PASSWORD = '';
process.env.LOCAL_DB_NAME = 'stockflow_test';

const { getDatabaseConfig } = require('../config/database');

const validCertificate = tls.rootCertificates[0];

function createCertificateFile(t, certificate) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stockflow-db-test-'));
  const certificatePath = path.join(directory, 'tidb-ca.pem');
  fs.writeFileSync(certificatePath, certificate);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return certificatePath;
}

function tidbEnvironment(overrides = {}) {
  return {
    DB_PROVIDER: 'tidb',
    TIDB_HOST: 'tidb.example.com',
    TIDB_PORT: '4000',
    TIDB_USER: 'cloud-user',
    TIDB_PASSWORD: 'cloud-password',
    TIDB_NAME: 'cloud-db',
    ...overrides,
  };
}

test('local provider uses MySQL on localhost without TLS', () => {
  const config = getDatabaseConfig({
    DB_PROVIDER: 'local',
    LOCAL_DB_HOST: 'localhost',
    LOCAL_DB_PORT: '3306',
    LOCAL_DB_USER: 'local-user',
    LOCAL_DB_PASSWORD: '',
    LOCAL_DB_NAME: 'stockflow',
  });

  assert.equal(config.provider, 'local');
  assert.equal(config.options.host, 'localhost');
  assert.equal(config.options.port, 3306);
  assert.equal(config.database, 'stockflow');
  assert.equal(config.password, '');
  assert.equal(config.options.dialectOptions.ssl, undefined);
  assert.equal(config.options.dialectModule, require('mysql2'));
});

test('local provider remains compatible with existing DB_* settings', () => {
  const config = getDatabaseConfig({
    DB_PROVIDER: 'local',
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'legacy-local-user',
    DB_PASSWORD: 'legacy-local-password',
    DB_NAME: 'legacy-stockflow',
  });

  assert.equal(config.options.host, 'localhost');
  assert.equal(config.options.port, 3306);
  assert.equal(config.database, 'legacy-stockflow');
  assert.equal(config.user, 'legacy-local-user');
});

test('TiDB provider loads a valid CA file and enforces certificate verification', (t) => {
  const certificatePath = createCertificateFile(t, validCertificate);
  const diagnostics = {};
  const config = getDatabaseConfig(
    tidbEnvironment({ TIDB_CA_CERT_PATH: certificatePath }),
    diagnostics,
  );

  assert.equal(config.provider, 'tidb');
  assert.equal(config.options.host, 'tidb.example.com');
  assert.equal(config.options.port, 4000);
  assert.equal(config.database, 'cloud-db');
  assert.equal(config.options.dialectOptions.ssl.ca, validCertificate);
  assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
  assert.deepEqual(diagnostics, {
    providerIsTiDB: true,
    certificatePathConfigured: true,
    inlineCertificateConfigured: false,
    certificateFileExists: true,
    certificateFileReadable: true,
    certificateSource: 'file',
    certificateValid: true,
    databaseConfigurationValid: true,
  });
});

test('TiDB provider prefers a valid inline CA certificate', () => {
  const diagnostics = {};
  const config = getDatabaseConfig(
    tidbEnvironment({
      TIDB_CA_CERT: validCertificate,
      TIDB_CA_CERT_PATH: 'missing-tidb-ca.pem',
    }),
    diagnostics,
  );

  assert.equal(config.options.dialectOptions.ssl.ca, validCertificate);
  assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
  assert.equal(diagnostics.certificateFileExists, false);
  assert.equal(diagnostics.certificateSource, 'inline');
  assert.equal(diagnostics.certificateValid, true);
});

test('TiDB provider accepts the existing DB_CA_CERT name as a legacy alias', () => {
  const config = getDatabaseConfig(
    tidbEnvironment({ DB_CA_CERT: validCertificate }),
  );

  assert.equal(config.options.dialectOptions.ssl.ca, validCertificate);
  assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
});

test('TiDB provider falls back to the CA file when the legacy DB_CA_CERT value is invalid', (t) => {
  const certificatePath = createCertificateFile(t, validCertificate);
  const config = getDatabaseConfig(
    tidbEnvironment({
      DB_CA_CERT: '-----BEGIN CERTIFICATE-----',
      TIDB_CA_CERT_PATH: certificatePath,
    }),
  );

  assert.equal(config.options.dialectOptions.ssl.ca, validCertificate);
});

test('TiDB provider falls back to valid inline CA when the configured path is invalid', () => {
  const diagnostics = {};
  const config = getDatabaseConfig(
    tidbEnvironment({
      TIDB_CA_CERT_PATH: 'missing-tidb-ca.pem',
      TIDB_CA_CERT: validCertificate,
    }),
    diagnostics,
  );

  assert.equal(config.options.dialectOptions.ssl.ca, validCertificate);
  assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
  assert.equal(diagnostics.certificateFileExists, false);
  assert.equal(diagnostics.certificateSource, 'inline');
});

test('TiDB provider requires a CA path or inline certificate', () => {
  assert.throws(
    () => getDatabaseConfig(tidbEnvironment()),
    /Configure TIDB_CA_CERT with valid PEM content or set TIDB_CA_CERT_PATH/,
  );
});

test('TiDB provider rejects an incorrect CA file path', () => {
  assert.throws(
    () =>
      getDatabaseConfig(
        tidbEnvironment({ TIDB_CA_CERT_PATH: 'missing-tidb-ca.pem' }),
      ),
    /Unable to read TiDB CA certificate/,
  );
});

test('TiDB provider rejects a directory as the CA file path', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stockflow-db-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.throws(
    () =>
      getDatabaseConfig(
        tidbEnvironment({ TIDB_CA_CERT_PATH: directory }),
      ),
    /Unable to read TiDB CA certificate/,
  );
});

test('TiDB provider rejects an empty CA file', (t) => {
  const certificatePath = createCertificateFile(t, '');

  assert.throws(
    () =>
      getDatabaseConfig(
        tidbEnvironment({ TIDB_CA_CERT_PATH: certificatePath }),
      ),
    /TiDB CA certificate is empty/,
  );
});

test('TiDB provider rejects malformed inline PEM certificate content', () => {
  assert.throws(
    () =>
      getDatabaseConfig(
        tidbEnvironment({
          TIDB_CA_CERT: `-----BEGIN CERTIFICATE-----
invalid
-----END CERTIFICATE-----`,
        }),
      ),
    /valid PEM-encoded X.509 certificates/,
  );
});

test('TiDB provider rejects malformed inline certificate even if a valid file path exists', (t) => {
  const certificatePath = createCertificateFile(t, validCertificate);

  assert.throws(
    () =>
      getDatabaseConfig(
        tidbEnvironment({
          TIDB_CA_CERT_PATH: certificatePath,
          TIDB_CA_CERT: 'not-a-valid-certificate',
        }),
      ),
    /valid PEM-encoded X.509 certificates/,
  );
});

test('database provider and TiDB certificate settings are validated', () => {
  assert.throws(
    () => getDatabaseConfig({ DB_PROVIDER: 'unknown' }),
    /DB_PROVIDER must be either local or tidb/,
  );
});
