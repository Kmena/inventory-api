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

function parseTrustProxy(value) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return false;
  }

  const lowerValue = normalizedValue.toLowerCase();
  if (['false', '0', 'no', 'off'].includes(lowerValue)) {
    return false;
  }

  if (['true', 'yes', 'on'].includes(lowerValue)) {
    return true;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  if (normalizedValue.includes(',')) {
    return normalizedValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return normalizedValue;
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
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  haciendaTaxpayerLookupUrl:
    process.env.HACIENDA_TAXPAYER_LOOKUP_URL || 'https://api.hacienda.go.cr/fe/ae?identificacion={identification}',
  geocodingSearchUrl: process.env.GEOCODING_SEARCH_URL || 'https://nominatim.openstreetmap.org/search',
  parseTrustProxy,
  // TASK-015B: Billing HTTP client timeout (shared by scheduler and artifact proxy)
  billingTimeoutMs: getNumber(process.env.BILLING_TIMEOUT_MS, 10_000),
  // TASK-015B: Fiscal scheduler configuration
  // Disabled by default — must set FISCAL_SCHEDULER_ENABLED=true in production deployment.
  // Tests inject FakeBillingServer directly into FiscalScheduler; they do not use the
  // application singleton and do not require this to be enabled.
  fiscalScheduler: {
    enabled: process.env.FISCAL_SCHEDULER_ENABLED === 'true',
    pollIntervalMs: getNumber(process.env.FISCAL_POLL_INTERVAL_MS, 15_000),
    workerBatchSize: getNumber(process.env.FISCAL_WORKER_BATCH_SIZE, 10),
    reconcilerBatchSize: getNumber(process.env.FISCAL_RECONCILER_BATCH_SIZE, 10),
    maxConcurrency: getNumber(process.env.FISCAL_MAX_CONCURRENCY, 3),
    staleThresholdMs: getNumber(process.env.FISCAL_STALE_THRESHOLD_MS, 15 * 60 * 1000),
    identityRecovery: {
      // Fail closed: enabling automatic lookup requires an explicit activation watermark.
      enabled: process.env.FISCAL_IDENTITY_RECOVERY_ENABLED === 'true',
      startAt: process.env.FISCAL_IDENTITY_RECOVERY_START_AT || null,
      maxAgeMs: getNumber(process.env.FISCAL_IDENTITY_RECOVERY_MAX_AGE_MS, 72 * 60 * 60 * 1000),
      batchSize: getNumber(process.env.FISCAL_IDENTITY_RECOVERY_BATCH_SIZE, 10),
      backoffMs: getNumber(process.env.FISCAL_IDENTITY_RECOVERY_BACKOFF_MS, 5 * 60 * 1000),
    },
  },
};
