/* global process */

import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const inventoriRoot = resolve(scriptDir, '..');
const billingRoot = resolve(inventoriRoot, '..', '..', 'Billing');
const requireInventori = createRequire(join(inventoriRoot, 'package.json'));
const requireBilling = createRequire(join(billingRoot, 'package.json'));
const bcrypt = requireInventori('bcrypt');
const argon2 = requireBilling('argon2');

const runId = `c1_${randomBytes(6).toString('hex')}`;
const ownerLabel = 'inventori.company1-onboarding';
const workRoot = mkdtempSync(join(tmpdir(), `${runId}-`));
const secrets = [];
const containers = [];
const volumes = [];
let networkName = null;
let cleaned = false;

const names = {
  network: `company1-onboarding-${runId}`,
  inventoriDb: `company1-inventori-db-${runId}`,
  billingDb: `company1-billing-db-${runId}`,
  redis: `company1-redis-${runId}`,
  billingApi: `company1-billing-api-${runId}`,
  billingWorker: `company1-billing-worker-${runId}`,
  inventoriApi: `company1-inventori-api-${runId}`,
  billingSecrets: `company1-billing-secrets-${runId}`,
  billingArtifacts: `company1-billing-artifacts-${runId}`,
  inventoriStorage: `company1-inventori-storage-${runId}`,
};

function sanitize(value) {
  let output = String(value ?? '');
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join('[REDACTED]');
  }
  return output;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    input: options.input,
    encoding: options.binary ? null : 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(sanitize(result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result;
}

function docker(args, options = {}) {
  return run('docker', args, options);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseEnv(containerName) {
  const inspected = JSON.parse(docker(['inspect', containerName]).stdout)[0];
  return Object.fromEntries((inspected.Config.Env || []).map((entry) => {
    const index = entry.indexOf('=');
    return [entry.slice(0, index), entry.slice(index + 1)];
  }));
}

function assertNormalRuntime(containerName) {
  const inspected = JSON.parse(docker(['inspect', containerName]).stdout)[0];
  if (!inspected.State?.Running) throw new Error(`${containerName} is not running`);
}

function writeEnvFile(name, environment) {
  const file = join(workRoot, `${name}.env`);
  const content = Object.entries(environment)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value).replaceAll('\r', '').replaceAll('\n', '')}`)
    .join('\n');
  writeFileSync(file, `${content}\n`, { encoding: 'utf8', mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Best effort on platforms without POSIX modes. */ }
  return file;
}

function createVolume(name) {
  docker(['volume', 'create', '--label', `${ownerLabel}=${runId}`, name]);
  volumes.push(name);
}

function createContainer(args, name) {
  docker(['run', '--detach', '--name', name, '--label', `${ownerLabel}=${runId}`, ...args]);
  containers.push(name);
}

function waitForPostgres(containerName, user, database, password) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = docker([
      'exec', '-e', `PGPASSWORD=${password}`, containerName,
      'pg_isready', '-U', user, '-d', database,
    ], { allowFailure: true });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`${containerName} PostgreSQL did not become ready`);
}

function psql(containerName, user, database, password, statement, options = {}) {
  return docker([
    'exec', '-e', `PGPASSWORD=${password}`, containerName,
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database,
    ...(options.tuples ? ['-A', '-t'] : []), '-c', statement,
  ]);
}

function cloneDatabase(source, target, targetUser, targetDatabase, targetPassword, dumpName) {
  const dumpFile = join(workRoot, `${dumpName}.dump`);
  const dump = docker([
    'exec', source.container, 'pg_dump', '-U', source.user, '-d', source.database,
    '--format=custom', '--no-owner', '--no-privileges',
  ], { binary: true });
  writeFileSync(dumpFile, dump.stdout, { mode: 0o600 });
  docker(['cp', dumpFile, `${target}:/tmp/source.dump`]);
  docker([
    'exec', '-e', `PGPASSWORD=${targetPassword}`, target,
    'pg_restore', '-U', targetUser, '-d', targetDatabase,
    '--no-owner', '--no-privileges', '--clean', '--if-exists', '/tmp/source.dump',
  ]);
}

function normalSnapshots() {
  const inventoriSql = `BEGIN READ ONLY;
    SELECT json_build_object(
      'company1', (SELECT count(*) FROM companies WHERE id=1),
      'commercialOrders', (SELECT count(*) FROM orders WHERE company_id=1),
      'commercialInvoices', (SELECT count(*) FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.company_id=1),
      'association1684', (SELECT row_to_json(x) FROM (SELECT id,company_id,billing_company_id,enabled,association_status FROM company_billing_integration_configs WHERE id=1684) x),
      'association1686', (SELECT row_to_json(x) FROM (SELECT id,company_id,billing_company_id,enabled,association_status FROM company_billing_integration_configs WHERE id=1686) x),
      'company1Intents', (SELECT count(*) FROM invoice_fiscal_intents WHERE company_id=1),
      'company1Snapshots', (SELECT count(*) FROM invoice_fiscal_snapshots WHERE company_id=1),
      'auditEvents', (SELECT count(*) FROM audit_events)
    ); COMMIT;`;
  const billingSql = `BEGIN READ ONLY;
    SELECT json_build_object(
      'company', (SELECT row_to_json(x) FROM (SELECT id,tenant_id,identification_number,status FROM companies WHERE id='dde91f44-6ceb-4eb7-b322-0139919cc34d') x),
      'documents', (SELECT count(*) FROM fiscal_documents WHERE company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d'),
      'sequences', (SELECT count(*) FROM fiscal_sequences WHERE company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d'),
      'certificates', (SELECT count(*) FROM fiscal_signing_certificates WHERE company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d'),
      'connections', (SELECT count(*) FROM hacienda_connections WHERE company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d'),
      'tenants', (SELECT count(*) FROM tenants),
      'companies', (SELECT count(*) FROM companies),
      'apiKeys', (SELECT count(*) FROM api_keys),
      'auditEvidence', (SELECT count(*) FROM audit_logs WHERE action <> 'get-health-liveness')
    ); COMMIT;`;
  const inv = docker(['exec', 'inventory-api-db-1', 'psql', '-U', 'tracksys', '-d', 'tracksys', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', inventoriSql]).stdout.trim().split('\n').find((line) => line.startsWith('{'));
  const bill = docker(['exec', 'billing-postgres', 'psql', '-U', 'billing', '-d', 'billing_dev', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', billingSql]).stdout.trim().split('\n').find((line) => line.startsWith('{'));
  return { inventori: JSON.parse(inv), billing: JSON.parse(bill) };
}

function waitForContainerHttp(containerName, url, label) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const script = `fetch(${JSON.stringify(url)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`;
    const result = docker(['exec', containerName, 'node', '-e', script], { allowFailure: true });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`${label} did not become healthy`);
}

function publishedPort(containerName, containerPort) {
  const output = docker(['port', containerName, `${containerPort}/tcp`]).stdout.trim();
  const match = output.match(/:(\d+)$/);
  if (!match) throw new Error(`Published port missing for ${containerName}`);
  return Number(match[1]);
}

function verifyOwnedContainer(name) {
  const value = docker(['inspect', '--format', `{{ index .Config.Labels "${ownerLabel}" }}`, name], { allowFailure: true });
  return value.status === 0 && value.stdout.trim() === runId;
}

function verifyOwnedVolume(name) {
  const value = docker(['volume', 'inspect', '--format', `{{ index .Labels "${ownerLabel}" }}`, name], { allowFailure: true });
  return value.status === 0 && value.stdout.trim() === runId;
}

async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const name of [...containers].reverse()) {
    if (verifyOwnedContainer(name)) docker(['rm', '--force', name], { allowFailure: true });
  }
  for (const name of [...volumes].reverse()) {
    if (verifyOwnedVolume(name)) docker(['volume', 'rm', '--force', name], { allowFailure: true });
  }
  if (networkName) {
    const value = docker(['network', 'inspect', '--format', `{{ index .Labels "${ownerLabel}" }}`, networkName], { allowFailure: true });
    if (value.status === 0 && value.stdout.trim() === runId) docker(['network', 'rm', networkName], { allowFailure: true });
  }
  rmSync(workRoot, { recursive: true, force: true });
}

async function main() {
  ['inventory-api-db-1', 'billing-postgres', 'inventori-api', 'billing-api', 'billing-worker'].forEach(assertNormalRuntime);
  const baseline = normalSnapshots();

  const invUser = `inv_${runId}`;
  const invDb = `inventori_fiscal_test_${runId.slice(3)}`;
  const invPassword = randomBytes(24).toString('hex');
  const invInstanceId = `ift_${randomBytes(16).toString('hex')}`;
  const billingUser = `bill_${runId}`;
  const billingDb = `billing_p0_${runId}_test`;
  const billingPassword = randomBytes(24).toString('hex');
  const testPassword = 'Company1-Disposable!2026';
  const bootstrapPrefix = randomBytes(4).toString('hex');
  const bootstrapSecret = randomBytes(16).toString('hex');
  const bootstrapKey = `bk_test_${bootstrapPrefix}_${bootstrapSecret}`;
  secrets.push(invPassword, billingPassword, bootstrapKey, bootstrapSecret);

  networkName = names.network;
  docker(['network', 'create', '--label', `${ownerLabel}=${runId}`, networkName]);
  createContainer([
    '--network', networkName, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=1g',
    '-e', `POSTGRES_USER=${invUser}`, '-e', `POSTGRES_PASSWORD=${invPassword}`, '-e', `POSTGRES_DB=${invDb}`,
    'postgres:16-alpine',
  ], names.inventoriDb);
  createContainer([
    '--network', networkName, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=1g',
    '-e', `POSTGRES_USER=${billingUser}`, '-e', `POSTGRES_PASSWORD=${billingPassword}`, '-e', `POSTGRES_DB=${billingDb}`,
    'postgres:15-alpine',
  ], names.billingDb);
  waitForPostgres(names.inventoriDb, invUser, invDb, invPassword);
  waitForPostgres(names.billingDb, billingUser, billingDb, billingPassword);
  cloneDatabase({ container: 'inventory-api-db-1', user: 'tracksys', database: 'tracksys' }, names.inventoriDb, invUser, invDb, invPassword, 'inventori');
  cloneDatabase({ container: 'billing-postgres', user: 'billing', database: 'billing_dev' }, names.billingDb, billingUser, billingDb, billingPassword, 'billing');

  psql(names.inventoriDb, invUser, invDb, invPassword, `COMMENT ON DATABASE ${invDb} IS ${sqlLiteral(`inventori-disposable:${invInstanceId}`)};`);
  psql(names.billingDb, billingUser, billingDb, billingPassword, `
    CREATE SCHEMA IF NOT EXISTS billing_test_safety;
    CREATE TABLE IF NOT EXISTS billing_test_safety.marker (
      marker_id smallint PRIMARY KEY CHECK (marker_id=1), run_id text NOT NULL,
      run_token_hash char(64) NOT NULL, database_name text NOT NULL, role_name text NOT NULL,
      created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL
    );
    DELETE FROM billing_test_safety.marker;
    INSERT INTO billing_test_safety.marker VALUES (1, ${sqlLiteral(runId)}, ${sqlLiteral(createHash('sha256').update(runId).digest('hex'))}, ${sqlLiteral(billingDb)}, ${sqlLiteral(billingUser)}, now(), now()+interval '2 hours');
  `);

  const passwordHash = await bcrypt.hash(testPassword, 12);
  psql(names.inventoriDb, invUser, invDb, invPassword, `
    BEGIN;
    SELECT pg_advisory_xact_lock(hashtextextended('company1-disposable-onboarding',0));
    DELETE FROM invoice_fiscal_intents WHERE company_id=1;
    DELETE FROM invoice_fiscal_snapshots WHERE company_id=1;
    DELETE FROM fiscal_sequences WHERE company_id=1;
    DELETE FROM company_billing_integration_configs WHERE company_id=1;
    UPDATE users SET password_hash=${sqlLiteral(passwordHash)}, updated_at=now() WHERE id=3 AND company_id=1;
    COMMIT;
  `);

  const tenantId = randomUUID();
  const keyId = randomUUID();
  const keyHash = await argon2.hash(bootstrapKey, { type: argon2.argon2id });
  psql(names.billingDb, billingUser, billingDb, billingPassword, `
    INSERT INTO tenants (id,name,slug,status,plan,created_at,updated_at)
      VALUES (${sqlLiteral(tenantId)},'Company 1 Disposable Tenant',${sqlLiteral(`company1-${runId}`)},'ACTIVE','TRIAL',now(),now());
    INSERT INTO api_keys (id,tenant_id,name,environment,key_prefix,key_hash,scopes,integration_profile,status,created_at,updated_at)
      VALUES (${sqlLiteral(keyId)},${sqlLiteral(tenantId)},'Company 1 disposable bootstrap','TEST',${sqlLiteral(bootstrapPrefix)},${sqlLiteral(keyHash)},ARRAY['fiscal-bootstrap:provision'], 'inventori-bootstrap-v1','ACTIVE',now(),now());
  `);

  createVolume(names.billingSecrets);
  createVolume(names.billingArtifacts);
  createVolume(names.inventoriStorage);
  docker(['run', '--rm', '-v', 'billing_local_encrypted_secrets:/source:ro', '-v', `${names.billingSecrets}:/target`, 'postgres:15-alpine', 'sh', '-c', 'cp -a /source/. /target/ && chown -R 1001:1001 /target']);
  docker(['run', '--rm', '-v', `${names.billingArtifacts}:/target`, 'postgres:15-alpine', 'sh', '-c', 'touch /target/.billing-fiscal-storage-root && chown -R 1001:1001 /target']);
  docker(['run', '--rm', '-v', `${names.inventoriStorage}:/target`, 'postgres:15-alpine', 'sh', '-c', 'chown -R 999:999 /target']);

  createContainer(['--network', networkName, 'redis:7-alpine'], names.redis);

  const billingDbUrl = `postgresql://${encodeURIComponent(billingUser)}:${encodeURIComponent(billingPassword)}@${names.billingDb}:5432/${billingDb}`;
  const billingBaseEnv = {
    ...parseEnv('billing-api'),
    DATABASE_URL: billingDbUrl,
    USE_REAL_HACIENDA: 'false',
    EMAIL_USE_REAL: 'false',
    SECRET_PROVIDER: 'local-encrypted',
    LOCAL_SECRET_STORE_PATH: '/var/lib/billing-secrets',
    LOCAL_STORAGE_PATH: '/var/lib/billing-artifacts',
    LOCAL_STORAGE_REQUIRED_MARKER: '.billing-fiscal-storage-root',
    PORT: '3000',
  };
  delete billingBaseEnv.SMTP_HOST;
  delete billingBaseEnv.SMTP_USER;
  delete billingBaseEnv.SMTP_PASSWORD;
  const billingApiEnv = writeEnvFile('billing-api', billingBaseEnv);
  const billingWorkerEnv = writeEnvFile('billing-worker', { ...parseEnv('billing-worker'), ...billingBaseEnv });
  const billingMounts = [
    '--mount', `type=volume,src=${names.billingSecrets},dst=/var/lib/billing-secrets`,
    '--mount', 'type=volume,src=billing_local_secret_key,dst=/run/operator-key,readonly',
    '--mount', `type=volume,src=${names.billingArtifacts},dst=/var/lib/billing-artifacts`,
  ];
  createContainer([
    '--network', networkName, '--env-file', billingApiEnv, ...billingMounts,
    '-p', '127.0.0.1::3000', 'billing-company1-onboarding:20261013',
  ], names.billingApi);
  createContainer([
    '--network', networkName, '--env-file', billingWorkerEnv, ...billingMounts,
    'billing-company1-onboarding:20261013', 'node', 'dist/src/bootstrap/worker.main.js',
  ], names.billingWorker);

  const invDbUrl = `postgresql://${encodeURIComponent(invUser)}:${encodeURIComponent(invPassword)}@${names.inventoriDb}:5432/${invDb}?schema=public`;
  const inventoriEnv = {
    ...parseEnv('inventori-api'),
    DATABASE_URL: invDbUrl,
    REDIS_URL: `redis://${names.redis}:6379`,
    BILLING_BASE_URL: `http://${names.billingApi}:3000`,
    BILLING_BOOTSTRAP_SECRET_REF: 'env:BILLING_BOOTSTRAP_API_KEY',
    BILLING_BOOTSTRAP_API_KEY: bootstrapKey,
    BILLING_MANAGED_CREDENTIAL_DIR: '/app/storage/billing-managed-credentials',
    BILLING_MANAGED_CREDENTIAL_KEY: randomBytes(32).toString('base64url'),
    EMAIL_USE_REAL: 'false',
    FORCE_SECURE_BROWSER_SESSION_COOKIE: 'false',
    PORT: '2500',
  };
  secrets.push(inventoriEnv.BILLING_MANAGED_CREDENTIAL_KEY);
  const inventoriEnvFile = writeEnvFile('inventori-api', inventoriEnv);
  createContainer([
    '--network', networkName, '--env-file', inventoriEnvFile,
    '--mount', `type=volume,src=${names.inventoriStorage},dst=/app/storage`,
    '-p', '127.0.0.1::2500', 'inventori-company1-onboarding:20261013',
  ], names.inventoriApi);

  const inventoriPort = publishedPort(names.inventoriApi, 2500);
  waitForContainerHttp(names.billingApi, 'http://127.0.0.1:3000/health/ready', 'Disposable Billing API');
  waitForContainerHttp(names.inventoriApi, 'http://127.0.0.1:2500/health/ready', 'Disposable Inventori API');

  const targetIdentity = psql(names.inventoriDb, invUser, invDb, invPassword, `
    SELECT current_database() || '|' || coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database'),'') || '|' || (SELECT count(*) FROM company_billing_integration_configs WHERE company_id=1);
  `, { tuples: true }).stdout.trim();
  if (targetIdentity !== `${invDb}|inventori-disposable:${invInstanceId}|0`) throw new Error('Inventori disposable identity/state verification failed');
  const billingIdentity = psql(names.billingDb, billingUser, billingDb, billingPassword, `SELECT current_database() || '|' || (SELECT run_id FROM billing_test_safety.marker WHERE marker_id=1);`, { tuples: true }).stdout.trim();
  if (billingIdentity !== `${billingDb}|${runId}`) throw new Error('Billing disposable identity verification failed');

  process.stdout.write(`${JSON.stringify({
    event: 'HARNESS_READY', runId,
    url: `http://127.0.0.1:${inventoriPort}/root/#configuracion_fiscal`,
    loginUrl: `http://127.0.0.1:${inventoriPort}/`,
    username: 'admin', password: testPassword,
    isolatedDatabases: { inventori: invDb, billing: billingDb },
    normalDatabaseNamesRejected: ['tracksys', 'billing_dev'],
    normalServicesRestarted: false,
  })}\n`);

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const raw of rl) {
    const command = raw.trim().toUpperCase();
    if (command === 'RUN_E2E') {
      const runnerPath = join(scriptDir, 'company1-onboarding-secure-runner.js');
      docker(['cp', runnerPath, `${names.billingApi}:/app/company1-onboarding-secure-runner.js`]);
      const result = docker([
        'exec',
        '-e', `INVENTORI_TEST_ORIGIN=http://${names.inventoriApi}:2500`,
        '-e', `INVENTORI_TEST_PASSWORD=${testPassword}`,
        '-e', 'SOURCE_BILLING_COMPANY_ID=dde91f44-6ceb-4eb7-b322-0139919cc34d',
        '-e', `TEST_BILLING_TENANT_ID=${tenantId}`,
        names.billingApi, 'node', '/app/company1-onboarding-secure-runner.js',
      ], { allowFailure: true });
      process.stdout.write(`${JSON.stringify({ event: 'E2E_FINISHED', exitCode: result.status, output: sanitize(result.stdout), error: sanitize(result.stderr) })}\n`);
    } else if (command === 'STOP') {
      break;
    }
  }
  rl.close();

  const finalSnapshot = normalSnapshots();
  const unchanged = JSON.stringify(finalSnapshot) === JSON.stringify(baseline);
  process.stdout.write(`${JSON.stringify({ event: 'NORMAL_DATABASE_VERIFICATION', unchanged, before: baseline, after: finalSnapshot })}\n`);
  if (!unchanged) throw new Error('Normal database evidence changed during disposable run');
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${sanitize(error instanceof Error ? error.message : error)}\n`);
  for (const name of [names.billingApi, names.billingWorker, names.inventoriApi]) {
    if (!verifyOwnedContainer(name)) continue;
    const state = docker(['inspect', '--format', '{{.State.Status}}|{{.State.ExitCode}}|{{.State.Error}}', name], { allowFailure: true });
    process.stderr.write(`${name}: ${sanitize(state.stdout.trim())}\n`);
    const logs = docker(['logs', '--tail', '80', name], { allowFailure: true });
    process.stderr.write(`${sanitize(`${logs.stdout}\n${logs.stderr}`.trim())}\n`);
  }
  process.exitCode = 1;
} finally {
  await cleanup();
}
