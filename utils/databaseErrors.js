const messagesByCode = {
  CERT_HAS_EXPIRED: 'The TiDB CA certificate has expired; install the current CA certificate.',
  ECONNREFUSED: 'The database refused the connection; verify the selected host and port.',
  ENOENT: 'The TiDB CA certificate file could not be read; verify TIDB_CA_CERT_PATH.',
  ENOTFOUND: 'The database host could not be resolved; verify the selected provider host.',
  ER_ACCESS_DENIED_ERROR: 'Database authentication failed; verify the selected provider credentials.',
  ER_BAD_DB_ERROR: 'The database was not found; verify the selected provider database name.',
  HANDSHAKE_SSL_ERROR: 'TLS negotiation failed; verify TIDB_CA_CERT_PATH and TiDB TLS settings.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    'The TiDB certificate could not be verified; install the correct CA certificate.',
  ETIMEDOUT: 'The database connection timed out; verify the endpoint and network allowlist.',
};

function formatDatabaseError(error) {
  const code = error?.original?.code || error?.parent?.code || error?.code;
  if (code && messagesByCode[code]) return messagesByCode[code];
  if (code) {
    return `Database connection failed (${code}); verify the TiDB endpoint, credentials, TLS certificate, and network allowlist.`;
  }

  const message = error?.message;
  if (
    typeof message === 'string' &&
    /^(Database schema is missing required |Missing required database environment variable: |Unable to read TiDB CA certificate; |DB_PROVIDER must |LOCAL_DB_PORT must |TIDB_PORT must |TIDB_CA_CERT_PATH must |JWT_SECRET must |TRUST_PROXY_HOPS must |PORT must |TiDB selected database mismatch: |TiDB database .* is missing required StockFlow tables: )/.test(
      message,
    )
  ) {
    return message;
  }
  if (error?.name && code) {
    return `Database connection failed (${error.name}, ${code}); verify the selected database settings and TLS certificate.`;
  }
  if (error?.name && message?.includes('certificate')) {
    return `Database TLS verification failed (${error.name}); verify the selected CA certificate.`;
  }
  return 'Database connection failed; verify the TiDB endpoint, credentials, TLS certificate, and network allowlist.';
}

module.exports = { formatDatabaseError };
