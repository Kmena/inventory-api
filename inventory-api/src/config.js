const crypto = require('crypto');
const dotenv = require('dotenv');

const { logConfigurationWarning } = require('./lib/logging');

dotenv.config();

const DEFAULT_JWT_SECRET = 'change_this_super_secret_key';
const nodeEnv = process.env.NODE_ENV || 'development';

function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function resolveJwtSecret() {
  const configuredSecret = String(process.env.JWT_SECRET || '').trim();

  if (configuredSecret && configuredSecret !== DEFAULT_JWT_SECRET) {
    return configuredSecret;
  }

  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET debe configurarse con un valor seguro en produccion.');
  }

  const generatedSecret = crypto.randomBytes(32).toString('hex');
  logConfigurationWarning({
    message: 'JWT_SECRET no configurado o inseguro. Se genero un secreto temporal solo para esta ejecucion.',
    nodeEnv,
  });
  return generatedSecret;
}

module.exports = {
  port: getNumber(process.env.PORT, 2500),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:2500',
  bcryptRounds: getNumber(process.env.BCRYPT_ROUNDS, 12),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  haciendaTaxpayerLookupUrl:
    process.env.HACIENDA_TAXPAYER_LOOKUP_URL || 'https://api.hacienda.go.cr/fe/ae?identificacion={identification}',
  geocodingSearchUrl: process.env.GEOCODING_SEARCH_URL || 'https://nominatim.openstreetmap.org/search',
};
