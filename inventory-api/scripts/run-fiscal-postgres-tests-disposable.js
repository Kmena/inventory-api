'use strict';

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const {
  resolveFiscalDisposableDatabaseConfig,
  verifyFiscalDisposableDatabase,
} = require('../tests/helpers/fiscal-disposable-database-guard');

const suffix = crypto.randomBytes(6).toString('hex');
const instanceId = `ift_${crypto.randomBytes(16).toString('hex')}`;
const databaseName = `inventori_fiscal_test_${suffix}`;
const containerName = `inventori-fiscal-test-${suffix}`;
const databaseUser = 'inventori_fiscal_test';
const databasePassword = crypto.randomBytes(24).toString('hex');
const containerLabel = 'inventori.test.disposable-instance';

const defaultTests = [
  'tests/fiscal-disposable-database-guard.test.js',
  'tests/inventori-billing-postgres-foundation.test.js',
  'tests/inventori-billing-worker-postgres.test.js',
  'tests/inventori-billing-scheduler-postgres.test.js',
  'tests/inventori-billing-reconciliation-postgres.test.js',
  'tests/inventori-billing-e2e-postgres.test.js',
  'tests/inventori-billing-artifact-proxy-postgres.test.js',
  'tests/invoice-fiscal-history-integration.test.js',
  'tests/receiver-fiscal-readiness-wave1.test.js',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
  return result;
}

function removeRunnerOwnedContainer() {
  const ownership = run(
    'docker',
    ['inspect', '--format', `{{ index .Config.Labels "${containerLabel}" }}`, containerName],
    { allowFailure: true, capture: true },
  );
  if (ownership.status !== 0) {
    throw new Error(`Refusing cleanup because runner-owned container ${containerName} could not be verified`);
  }
  if (ownership.stdout.trim() !== instanceId) {
    throw new Error(`Refusing cleanup of unverified container ${containerName}`);
  }
  run('docker', ['rm', '--force', containerName], { capture: true });
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

async function verifyWithPrisma(env) {
  const config = resolveFiscalDisposableDatabaseConfig(env);
  const client = new PrismaClient({ datasources: { db: { url: config.url } } });
  try {
    await client.$connect();
    return await verifyFiscalDisposableDatabase(client, config);
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  let containerCreated = false;
  try {
    run('docker', [
      'run', '--detach', '--rm', '--name', containerName,
      '--label', `${containerLabel}=${instanceId}`,
      '--env', `POSTGRES_USER=${databaseUser}`,
      '--env', `POSTGRES_PASSWORD=${databasePassword}`,
      '--env', `POSTGRES_DB=${databaseName}`,
      '--publish', '127.0.0.1::5432',
      'postgres:15-alpine',
    ]);
    containerCreated = true;

    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const result = run(
        'docker',
        ['exec', containerName, 'pg_isready', '--username', databaseUser, '--dbname', databaseName],
        { allowFailure: true, capture: true },
      );
      if (result.status === 0) {
        ready = true;
        break;
      }
      wait(250);
    }
    if (!ready) throw new Error('Disposable PostgreSQL did not become ready');

    let identityCheck;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      identityCheck = run('docker', [
        'exec', containerName, 'psql', '--username', databaseUser, '--dbname', databaseName,
        '--tuples-only', '--no-align', '--command', 'SELECT current_database()',
      ], { allowFailure: true, capture: true });
      if (identityCheck.status === 0 && identityCheck.stdout.trim() === databaseName) break;
      wait(250);
    }
    if (identityCheck?.status !== 0 || identityCheck.stdout.trim() !== databaseName) {
      throw new Error('Runner connected to an unexpected PostgreSQL database before marker creation');
    }

    const markerSql = `COMMENT ON DATABASE ${databaseName} IS 'inventori-disposable:${instanceId}'`;
    run('docker', [
      'exec', containerName, 'psql', '--username', databaseUser, '--dbname', databaseName,
      '--set', 'ON_ERROR_STOP=1', '--command', markerSql,
    ]);

    const portResult = run('docker', ['port', containerName, '5432/tcp'], { capture: true });
    const portMatch = portResult.stdout.trim().match(/:(\d+)$/);
    if (!portMatch) throw new Error('Unable to resolve disposable PostgreSQL port');
    const databaseUrl = `postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${portMatch[1]}/${databaseName}?schema=public`;
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      BROWSER_SESSION_STORE_MODE: 'memory',
      REDIS_URL: '',
      INVENTORI_BILLING_POSTGRES_TEST: '1',
      INVENTORI_BILLING_DATABASE_URL: databaseUrl,
      INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: instanceId,
      DATABASE_URL: databaseUrl,
      P2_AUDIT_DATABASE_URL: databaseUrl,
      P2_CONSTRAINTS_DATABASE_URL: databaseUrl,
      POSTGRES_DB: databaseName,
      POSTGRES_USER: databaseUser,
      POSTGRES_PASSWORD: databasePassword,
    };

    const identity = await verifyWithPrisma(env);
    process.stdout.write(`${JSON.stringify({ disposableDatabase: identity.databaseName, instanceId, container: containerName })}\n`);

    run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env });
    await verifyWithPrisma(env);

    const requestedArguments = process.argv.slice(2);
    const aggregateMode = requestedArguments.length === 1 && requestedArguments[0] === '--aggregate';
    const selectedTests = requestedArguments.filter((argument) => argument !== '--aggregate');
    const aggregateEvidenceFile = path.join(process.cwd(), 'test-output', 'wave8-final-global-junit.xml');
    if (aggregateMode) fs.mkdirSync(path.dirname(aggregateEvidenceFile), { recursive: true });
    const testResult = aggregateMode
      ? run(process.execPath, [
        'scripts/run-tests.js',
        '--test-reporter=dot',
        '--test-reporter-destination=stdout',
        '--test-reporter=junit',
        `--test-reporter-destination=${aggregateEvidenceFile}`,
        '--test-concurrency=1',
      ], { env, allowFailure: true })
      : run(
        process.execPath,
        ['--test', '--test-concurrency=1', ...(selectedTests.length > 0 ? selectedTests : defaultTests)],
        { env, allowFailure: true },
      );
    process.exitCode = testResult.status ?? 1;
  } finally {
    if (containerCreated) {
      removeRunnerOwnedContainer();
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
