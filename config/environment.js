const path = require('node:path');
const dotenv = require('dotenv');

const PRODUCTION_CORS_ORIGINS = ['https://stock-flow-frontend-murex.vercel.app'];
const DEVELOPMENT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
}

function getCorsOrigins(environment = process.env) {
  const configuredOrigins = (environment.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const developmentOrigins =
    environment.NODE_ENV === 'production' ? [] : DEVELOPMENT_CORS_ORIGINS;

  return [
    ...new Set([
      ...PRODUCTION_CORS_ORIGINS,
      ...configuredOrigins,
      ...developmentOrigins,
    ]),
  ];
}

function getPort(value, fallback, name) {
  const port = Number(value || fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return port;
}

function getEnvironment() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and contain at least 32 characters');
  }

  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }

  return {
    port: getPort(process.env.PORT, 3000, 'PORT'),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    trustProxyHops,
    corsOrigins: getCorsOrigins(),
  };
}

module.exports = { getEnvironment, getCorsOrigins };
