const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PROVIDER = 'local';
process.env.LOCAL_DB_HOST = 'localhost';
process.env.LOCAL_DB_PORT = '3306';
process.env.LOCAL_DB_USER = 'test-user';
process.env.LOCAL_DB_PASSWORD = '';
process.env.LOCAL_DB_NAME = 'stockflow_test';

const { getDatabaseConfig } = require('../config/database');

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

test('TiDB provider loads a CA file and enforces certificate verification', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stockflow-db-test-'));
  const certificatePath = path.join(directory, 'tidb-ca.pem');
  const certificate = [
    '-----BEGIN CERTIFICATE-----',
    'test-certificate-content',
    '-----END CERTIFICATE-----',
  ].join('\n');
  fs.writeFileSync(certificatePath, certificate);
  t.after(() => {
    fs.rmSync(certificatePath);
    fs.rmdirSync(directory);
  });

  const config = getDatabaseConfig({
    DB_PROVIDER: 'tidb',
    TIDB_HOST: 'tidb.example.com',
    TIDB_PORT: '4000',
    TIDB_USER: 'cloud-user',
    TIDB_PASSWORD: 'cloud-password',
    TIDB_NAME: 'cloud-db',
    TIDB_CA_CERT_PATH: certificatePath,
  });

  assert.equal(config.provider, 'tidb');
  assert.equal(config.options.host, 'tidb.example.com');
  assert.equal(config.options.port, 4000);
  assert.equal(config.database, 'cloud-db');
  assert.equal(config.options.dialectOptions.ssl.ca, certificate);
  assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
});

test('database provider and TiDB certificate settings are validated', () => {
  assert.throws(
    () => getDatabaseConfig({ DB_PROVIDER: 'unknown' }),
    /DB_PROVIDER must be either local or tidb/,
  );
  assert.throws(
    () =>
      getDatabaseConfig({
        DB_PROVIDER: 'tidb',
        TIDB_HOST: 'tidb.example.com',
        TIDB_USER: 'cloud-user',
        TIDB_PASSWORD: 'cloud-password',
        TIDB_NAME: 'cloud-db',
        TIDB_CA_CERT_PATH: 'missing-tidb-ca.pem',
      }),
    /Unable to read TiDB CA certificate/,
  );
});
