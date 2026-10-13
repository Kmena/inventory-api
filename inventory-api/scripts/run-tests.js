const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const {
  assertDisposableDatabaseUrl,
  resolveFiscalDisposableDatabaseConfig,
  verifyFiscalDisposableDatabase,
} = require('../tests/helpers/fiscal-disposable-database-guard');

const testsRoot = path.join(__dirname, '..', 'tests');
const preferredTestOrder = [
  'tests/logging.test.js',
  'tests/request-context.test.js',
  'tests/audit.test.js',
  'tests/access-policies.test.js',
  'tests/audit-repository.test.js',
  'tests/audit-instrumentation.test.js',
  'tests/health-routes.test.js',
  'tests/p2-hardening-constraints.test.js',
  'tests/client-tenant-scope.test.js',
  'tests/company-authorization-characterization.test.js',
  'tests/administrative-authorization-characterization.test.js',
  'tests/invoice-tenant-scope.test.js',
  'tests/invoice-payment-sync-characterization.test.js',
  'tests/money.test.js',
  'tests/payment-tenant-scope.test.js',
  'tests/payment-lifecycle-schema-characterization.test.js',
  'tests/payment-receipt-security.test.js',
  'tests/agent-workspace-tenant-scope.test.js',
  'tests/geocoding-characterization.test.js',
  'tests/taxpayer-characterization.test.js',
  'tests/public-surface-characterization.test.js',
  'tests/auth-hardening-characterization.test.js',
  'tests/payload-segmentation-characterization.test.js',
  'tests/client-document-security.test.js',
  'tests/pagination.test.js',
  'tests/lifecycle-repository.test.js',
  'tests/lifecycle-delete-authorization.test.js',
  'tests/product-delete-semantics.test.js',
  'tests/lot-datetime-characterization.test.js',
  'tests/inventory-alerts-tenant-scope.test.js',
  'tests/approval-baseline-compatibility.test.js',
  'tests/openapi-contract-consistency.test.js',
  'tests/production-baseline-characterization.test.js',
];
const preferredOrderIndex = new Map(preferredTestOrder.map((filePath, index) => [filePath, index]));
const supportedBrowserSessionStoreModes = new Set(['memory', 'redis']);

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function compareDiscoveredTestFiles(left, right) {
  const leftIndex = preferredOrderIndex.get(left);
  const rightIndex = preferredOrderIndex.get(right);

  if (leftIndex !== undefined && rightIndex !== undefined) {
    return leftIndex - rightIndex;
  }

  if (leftIndex !== undefined) {
    return -1;
  }

  if (rightIndex !== undefined) {
    return 1;
  }

  return left.localeCompare(right);
}

function listTestFiles(directory) {
  const discoveredFiles = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      discoveredFiles.push(...listTestFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      discoveredFiles.push(absolutePath);
    }
  }

  return discoveredFiles
    .map((filePath) => toPosixPath(path.relative(process.cwd(), filePath)))
    .sort(compareDiscoveredTestFiles);
}

function getAggregateTestEnvironment(baseEnv = process.env) {
  return {
    ...baseEnv,
    NODE_ENV: 'test',
    BROWSER_SESSION_STORE_MODE: 'memory',
    REDIS_URL: '',
  };
}

function validateAggregateTestEnvironment(environment) {
  const failures = [];
  const sessionStoreMode = String(environment.BROWSER_SESSION_STORE_MODE || '').trim();

  if (!supportedBrowserSessionStoreModes.has(sessionStoreMode)) {
    failures.push(
      `Unsupported BROWSER_SESSION_STORE_MODE \`${sessionStoreMode}\` for aggregate test execution. Supported values: memory, redis.`,
    );
  }

  if (sessionStoreMode === 'redis' && !String(environment.REDIS_URL || '').trim()) {
    failures.push(
      'BROWSER_SESSION_STORE_MODE=redis requires REDIS_URL for aggregate test execution.',
    );
  }

  if (String(environment.REDIS_URL || '').trim()) {
    failures.push('Aggregate tests require an empty REDIS_URL; Redis behavior is exercised by the isolated fake-Redis lane.');
  }

  try {
    const config = resolveFiscalDisposableDatabaseConfig(environment);
    if (!config) {
      failures.push('Aggregate tests require the verified disposable PostgreSQL runner.');
    } else {
      assertDisposableDatabaseUrl(environment.P2_AUDIT_DATABASE_URL, 'P2_AUDIT_DATABASE_URL', config);
      assertDisposableDatabaseUrl(environment.P2_CONSTRAINTS_DATABASE_URL, 'P2_CONSTRAINTS_DATABASE_URL', config);
    }
  } catch (error) {
    failures.push(`${error.code || 'DISPOSABLE_DATABASE_REJECTED'}: ${error.message}`);
  }

  return failures;
}

function formatAggregateTestEnvironmentGuidance(environment) {
  const sessionStoreMode = String(environment.BROWSER_SESSION_STORE_MODE || '').trim();

  return [
    `Aggregate runner defaults: NODE_ENV=${environment.NODE_ENV}, BROWSER_SESSION_STORE_MODE=${sessionStoreMode}.`,
    'Use `npm run test`; it provisions and verifies runner-owned PostgreSQL before this aggregate runner starts.',
    'Use `npm run test:redis-path` for the dedicated Redis-backed browser-session lane.',
    'P2_AUDIT_DATABASE_URL and P2_CONSTRAINTS_DATABASE_URL must exactly match the verified disposable database.',
  ].join('\n');
}

async function verifyAggregateTestDatabase(environment) {
  const config = resolveFiscalDisposableDatabaseConfig(environment);
  const prisma = new PrismaClient({ datasources: { db: { url: config.url } } });
  try {
    await prisma.$connect();
    return await verifyFiscalDisposableDatabase(prisma, config);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  const testFiles = listTestFiles(testsRoot);

  if (testFiles.length === 0) {
    throw new Error('No test files were discovered under tests/.');
  }

  const forwardedArguments = process.argv.slice(2).filter((argument) => argument !== '--silent');
  const environment = getAggregateTestEnvironment(process.env);
  const environmentFailures = validateAggregateTestEnvironment(environment);

  if (environmentFailures.length > 0) {
    throw new Error(`${environmentFailures.join('\n')}\n${formatAggregateTestEnvironmentGuidance(environment)}`);
  }

  const identity = await verifyAggregateTestDatabase(environment);
  process.stdout.write(`${JSON.stringify({ aggregateDisposableDatabase: identity.databaseName, instanceId: identity.instanceId })}\n`);

  const child = spawn(process.execPath, ['--test', ...forwardedArguments, ...testFiles], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: environment,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  compareDiscoveredTestFiles,
  formatAggregateTestEnvironmentGuidance,
  getAggregateTestEnvironment,
  listTestFiles,
  run,
  supportedBrowserSessionStoreModes,
  toPosixPath,
  validateAggregateTestEnvironment,
  verifyAggregateTestDatabase,
};
