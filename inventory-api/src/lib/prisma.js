const { PrismaClient } = require('@prisma/client');

/**
 * @typedef {import('@prisma/client').PrismaClient & {
 *   checkDatabaseReadiness: (prismaClient?: import('@prisma/client').PrismaClient) => Promise<void>
 *   assertSafeTestDatabaseEnvironment: (environment?: NodeJS.ProcessEnv) => void
 * }} PrismaClientWithReadiness
 */

/** @type {import('@prisma/client').PrismaClient | null} */
let prismaClient = null;

const DISPOSABLE_DATABASE_NAME = /^inventori_fiscal_test_[a-f0-9]{12}$/;
const DISPOSABLE_INSTANCE_ID = /^ift_[a-f0-9]{32}$/;

function assertSafeTestDatabaseEnvironment(environment = process.env) {
  const isTestProcess = environment.NODE_ENV === 'test' || Boolean(environment.NODE_TEST_CONTEXT);
  if (!isTestProcess) return;

  const databaseUrl = String(environment.DATABASE_URL || '').trim();
  const inheritedPostgresDatabase = String(environment.POSTGRES_DB || '').trim();
  const inheritedPostgresUser = String(environment.POSTGRES_USER || '').trim();
  const inheritedPostgresPassword = String(environment.POSTGRES_PASSWORD || '').trim();
  const hasInheritedPostgresTarget = Boolean(
    inheritedPostgresDatabase || inheritedPostgresUser || inheritedPostgresPassword,
  );
  if (!databaseUrl) {
    if (hasInheritedPostgresTarget) {
      throw new Error('Unsafe test database access blocked: inherited POSTGRES_* target without a verified disposable DATABASE_URL');
    }
    return;
  }

  const dedicatedUrl = String(environment.INVENTORI_BILLING_DATABASE_URL || '').trim();
  const instanceId = String(environment.INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID || '').trim();
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch (_error) {
    throw new Error('Unsafe test database access blocked: DATABASE_URL is invalid');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  const postgresTargetMatches = (
    (!inheritedPostgresDatabase || inheritedPostgresDatabase === databaseName)
    && (!inheritedPostgresUser || inheritedPostgresUser === decodeURIComponent(parsed.username))
    && (!inheritedPostgresPassword || inheritedPostgresPassword === decodeURIComponent(parsed.password))
  );
  if (!dedicatedUrl || dedicatedUrl !== databaseUrl || !DISPOSABLE_INSTANCE_ID.test(instanceId) || !DISPOSABLE_DATABASE_NAME.test(databaseName) || !loopback || !postgresTargetMatches) {
    throw new Error('Unsafe test database access blocked: use the runner-owned disposable PostgreSQL entry point');
  }
}

function getPrismaClient() {
  if (!prismaClient) {
    assertSafeTestDatabaseEnvironment();
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

async function checkDatabaseReadiness(prismaInstance = getPrismaClient()) {
  await prismaInstance.$queryRaw`SELECT 1`;
}

const prisma = /** @type {PrismaClientWithReadiness} */ (new Proxy({ checkDatabaseReadiness, assertSafeTestDatabaseEnvironment }, {
  get(target, property, receiver) {
    if (property === 'checkDatabaseReadiness' || property === 'assertSafeTestDatabaseEnvironment') {
      return Reflect.get(target, property, receiver);
    }

    const activeClient = getPrismaClient();
    const value = Reflect.get(activeClient, property, receiver);
    return typeof value === 'function' ? value.bind(activeClient) : value;
  },
  set(target, property, value) {
    if (property === 'checkDatabaseReadiness') {
      target.checkDatabaseReadiness = value;
      return true;
    }

    const activeClient = getPrismaClient();
    activeClient[property] = value;
    return true;
  },
}));

module.exports = prisma;
