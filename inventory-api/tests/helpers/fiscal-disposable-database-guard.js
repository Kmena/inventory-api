'use strict';

const { Prisma } = require('@prisma/client');

const DISPOSABLE_DATABASE_NAME = /^inventori_fiscal_test_[a-f0-9]{12}$/;
const DISPOSABLE_INSTANCE_ID = /^ift_[a-f0-9]{32}$/;
const NORMAL_DATABASE_NAMES = new Set(['tracksys', 'postgres', 'template0', 'template1']);

class FiscalDisposableDatabaseGuardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FiscalDisposableDatabaseGuardError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new FiscalDisposableDatabaseGuardError(code, message);
}

function canonicalDatabaseUrl(rawValue, variableName) {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    fail('DISPOSABLE_DATABASE_URL_REQUIRED', `${variableName} is required for fiscal PostgreSQL tests`);
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    fail('DISPOSABLE_DATABASE_URL_INVALID', `${variableName} must be an unambiguous PostgreSQL URL`);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('DISPOSABLE_DATABASE_URL_INVALID', `${variableName} must use the PostgreSQL protocol`);
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName || databaseName.includes('/')) {
    fail('DISPOSABLE_DATABASE_URL_INVALID', `${variableName} must identify exactly one database`);
  }
  if (NORMAL_DATABASE_NAMES.has(databaseName.toLowerCase())) {
    fail('NORMAL_DATABASE_REJECTED', `Fiscal PostgreSQL tests refuse database ${databaseName}`);
  }
  if (!DISPOSABLE_DATABASE_NAME.test(databaseName)) {
    fail('DISPOSABLE_DATABASE_NAME_REQUIRED', 'Fiscal PostgreSQL tests require a runner-generated database name');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname.toLowerCase())) {
    fail('DISPOSABLE_DATABASE_HOST_REQUIRED', 'Fiscal PostgreSQL tests require the runner loopback endpoint');
  }
  if (parsed.searchParams.has('schema') && parsed.searchParams.get('schema') !== 'public') {
    fail('DISPOSABLE_DATABASE_SCHEMA_REJECTED', 'Fiscal PostgreSQL tests require schema=public');
  }
  parsed.searchParams.set('schema', 'public');
  return { url: parsed.toString(), databaseName };
}

function resolveFiscalDisposableDatabaseConfig(env = process.env) {
  if (env.INVENTORI_BILLING_POSTGRES_TEST !== '1') return null;

  const selected = canonicalDatabaseUrl(
    env.INVENTORI_BILLING_DATABASE_URL,
    'INVENTORI_BILLING_DATABASE_URL',
  );
  const instanceId = env.INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID;
  if (!DISPOSABLE_INSTANCE_ID.test(instanceId || '')) {
    fail(
      'DISPOSABLE_INSTANCE_ID_REQUIRED',
      'A runner-generated INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID is required',
    );
  }

  if (env.DATABASE_URL) {
    const fallback = canonicalDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL');
    if (fallback.url !== selected.url) {
      fail(
        'DATABASE_URL_MISMATCH',
        'DATABASE_URL must exactly match INVENTORI_BILLING_DATABASE_URL for fiscal PostgreSQL tests',
      );
    }
  }

  return { ...selected, instanceId };
}

function configureFiscalDisposableDatabase(env = process.env) {
  const config = resolveFiscalDisposableDatabaseConfig(env);
  if (config) env.DATABASE_URL = config.url;
  return config;
}

function assertDisposableDatabaseUrl(rawValue, variableName, config) {
  if (!config) {
    fail(
      'DISPOSABLE_DATABASE_CONFIG_REQUIRED',
      `${variableName} cannot enable a database-backed test outside the verified disposable runner`,
    );
  }
  const selected = canonicalDatabaseUrl(rawValue, variableName);
  if (selected.url !== config.url) {
    fail(
      'DISPOSABLE_DATABASE_URL_MISMATCH',
      `${variableName} must exactly match the verified disposable database URL`,
    );
  }
  return selected.url;
}

async function verifyFiscalDisposableDatabase(prisma, config) {
  if (!config) fail('DISPOSABLE_DATABASE_CONFIG_REQUIRED', 'Disposable database configuration is required');
  if (!prisma || typeof prisma.$queryRaw !== 'function') {
    fail('DISPOSABLE_DATABASE_CLIENT_REQUIRED', 'A connected Prisma client is required');
  }

  const identityRows = await prisma.$queryRaw(Prisma.sql`
    SELECT current_database() AS database_name,
           current_user AS database_user,
           inet_server_addr()::text AS server_address,
           inet_server_port() AS server_port,
           shobj_description(
             (SELECT oid FROM pg_database WHERE datname = current_database()),
             'pg_database'
           ) AS database_marker
  `);
  const identity = identityRows?.[0];
  if (!identity || identity.database_name !== config.databaseName) {
    fail('CONNECTED_DATABASE_MISMATCH', 'Connected PostgreSQL identity does not match the runner URL');
  }
  if (NORMAL_DATABASE_NAMES.has(String(identity.database_name).toLowerCase())) {
    fail('CONNECTED_NORMAL_DATABASE_REJECTED', 'Connected PostgreSQL database is not disposable');
  }
  if (identity.database_marker !== `inventori-disposable:${config.instanceId}`) {
    fail('DISPOSABLE_MARKER_MISMATCH', 'Runner-generated disposable instance marker does not match');
  }

  return Object.freeze({
    databaseName: identity.database_name,
    databaseUser: identity.database_user,
    serverAddress: identity.server_address,
    serverPort: identity.server_port,
    instanceId: config.instanceId,
  });
}

module.exports = {
  FiscalDisposableDatabaseGuardError,
  assertDisposableDatabaseUrl,
  configureFiscalDisposableDatabase,
  resolveFiscalDisposableDatabaseConfig,
  verifyFiscalDisposableDatabase,
};
