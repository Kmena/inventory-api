/* global process */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tag = '121221';
const ownerLabel = 'inventori.company1-final-activation-rehearsal';
const names = {
  network: `company1-activation-rehearsal-${tag}`,
  redis: `company1-activation-redis-${tag}`,
  billingApi: `company1-activation-billing-api-${tag}`,
  inventoriApi: `company1-activation-inventori-api-${tag}`,
  inventoriStorage: `c1act_inventori_store_${tag}`,
  billingDb: `company1-activation-bill-restore-${tag}`,
  inventoriDb: `company1-activation-inv-restore-${tag}`,
};
const created = { containers: [], volumes: [], network: false };
const work = mkdtempSync(join(tmpdir(), 'company1-final-activation-'));
const restoredInventoriStore = resolve('backups', 'company1-activation-20261013T121221-0600', 'inventori-managed-credentials');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result;
}
function docker(args, options = {}) { return run('docker', args, options); }
function inspect(name) { return JSON.parse(docker(['inspect', name]).stdout)[0]; }
function environment(name) {
  return Object.fromEntries((inspect(name).Config.Env || []).map((line) => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
}
function envFile(name, values) {
  const path = join(work, `${name}.env`);
  writeFileSync(path, `${Object.entries(values).map(([key, value]) => `${key}=${String(value).replaceAll('\r', '').replaceAll('\n', '')}`).join('\n')}\n`, { mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* Best effort on non-POSIX filesystems. */ }
  return path;
}
function waitHttp(container, url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = docker(['exec', container, 'node', '-e', `fetch('${url}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`], { allowFailure: true });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`${container} did not become healthy`);
}
function safeRemove() {
  for (const container of created.containers.reverse()) docker(['rm', '--force', container], { allowFailure: true });
  for (const db of [names.billingDb, names.inventoriDb]) docker(['network', 'disconnect', names.network, db], { allowFailure: true });
  if (created.network) docker(['network', 'rm', names.network], { allowFailure: true });
  for (const volume of created.volumes.reverse()) docker(['volume', 'rm', '--force', volume], { allowFailure: true });
  rmSync(work, { recursive: true, force: true });
}

try {
  const billDbEnv = environment(names.billingDb);
  const invDbEnv = environment(names.inventoriDb);
  const billUser = billDbEnv.POSTGRES_USER;
  const billPassword = billDbEnv.POSTGRES_PASSWORD;
  const billDatabase = billDbEnv.POSTGRES_DB;
  const invUser = invDbEnv.POSTGRES_USER;
  const invPassword = invDbEnv.POSTGRES_PASSWORD;
  const invDatabase = invDbEnv.POSTGRES_DB;

  docker(['network', 'create', '--label', `${ownerLabel}=true`, names.network]); created.network = true;
  docker(['network', 'connect', names.network, names.billingDb]);
  docker(['network', 'connect', names.network, names.inventoriDb]);
  docker(['exec', names.billingDb, 'psql', '-U', billUser, '-d', billDatabase, '-X', '-v', 'ON_ERROR_STOP=1', '-c',
    "CREATE SCHEMA IF NOT EXISTS billing_test_safety; CREATE TABLE IF NOT EXISTS billing_test_safety.marker(marker_id smallint PRIMARY KEY); INSERT INTO billing_test_safety.marker VALUES(1) ON CONFLICT DO NOTHING;"]);
  docker(['exec', names.inventoriDb, 'psql', '-U', invUser, '-d', invDatabase, '-X', '-v', 'ON_ERROR_STOP=1', '-c',
    `COMMENT ON DATABASE ${invDatabase} IS 'inventori-disposable:company1-final-activation-${tag}';`]);

  docker(['volume', 'create', '--label', `${ownerLabel}=true`, names.inventoriStorage]); created.volumes.push(names.inventoriStorage);
  docker(['run', '--rm', '--mount', `type=bind,src=${restoredInventoriStore},dst=/source,readonly`,
    '-v', `${names.inventoriStorage}:/target`, 'alpine:3.20', 'sh', '-c',
    'cp -a /source/. /target/ && chown -R 999:999 /target']);
  docker(['run', '--rm', '-v', 'c1act_artifacts_restore_121221:/target', 'alpine:3.20', 'sh', '-c',
    'chown -R 1001:1001 /target && chmod 700 /target']);
  docker(['run', '--rm', '-v', 'c1act_secrets_restore_121221:/target', 'alpine:3.20', 'sh', '-c',
    'chown -R 1001:1001 /target && find /target -type d -exec chmod 700 {} + && find /target -type f -exec chmod 600 {} +']);
  docker(['run', '--detach', '--name', names.redis, '--label', `${ownerLabel}=true`, '--network', names.network, 'redis:7-alpine']); created.containers.push(names.redis);

  const billingEnv = { ...environment('billing-api'),
    DATABASE_URL: `postgresql://${encodeURIComponent(billUser)}:${encodeURIComponent(billPassword)}@${names.billingDb}:5432/${billDatabase}`,
    USE_REAL_HACIENDA: 'false', EMAIL_USE_REAL: 'false', PORT: '3000' };
  delete billingEnv.SMTP_HOST; delete billingEnv.SMTP_USER; delete billingEnv.SMTP_PASSWORD;
  const billingEnvPath = envFile('billing', billingEnv);
  const billingImage = inspect('billing-api').Config.Image;
  docker(['run', '--detach', '--name', names.billingApi, '--label', `${ownerLabel}=true`, '--network', names.network,
    '--env-file', billingEnvPath,
    '--mount', 'type=volume,src=c1act_secrets_restore_121221,dst=/var/lib/billing-secrets',
    '--mount', 'type=volume,src=billing_local_secret_key,dst=/run/operator-key,readonly',
    '--mount', 'type=volume,src=c1act_artifacts_restore_121221,dst=/var/lib/billing-artifacts', billingImage]);
  created.containers.push(names.billingApi);
  waitHttp(names.billingApi, 'http://127.0.0.1:3000/health/ready');

  const inventoriEnv = { ...environment('inventori-api'),
    DATABASE_URL: `postgresql://${encodeURIComponent(invUser)}:${encodeURIComponent(invPassword)}@${names.inventoriDb}:5432/${invDatabase}?schema=public`,
    REDIS_URL: `redis://${names.redis}:6379`, BILLING_BASE_URL: `http://${names.billingApi}:3000`,
    BILLING_MANAGED_CREDENTIAL_DIR: '/app/storage/billing-managed-credentials',
    EMAIL_USE_REAL: 'false', FISCAL_SCHEDULER_ENABLED: 'false', FISCAL_IDENTITY_RECOVERY_ENABLED: 'false', PORT: '2500' };
  delete inventoriEnv.SMTP_HOST; delete inventoriEnv.SMTP_USER; delete inventoriEnv.SMTP_PASSWORD;
  const inventoriEnvPath = envFile('inventori', inventoriEnv);
  const inventoriImage = inspect('inventori-api').Config.Image;
  docker(['run', '--detach', '--name', names.inventoriApi, '--label', `${ownerLabel}=true`, '--network', names.network,
    '--env-file', inventoriEnvPath, '--mount', `type=volume,src=${names.inventoriStorage},dst=/app/storage`, inventoriImage]);
  created.containers.push(names.inventoriApi);
  waitHttp(names.inventoriApi, 'http://127.0.0.1:2500/health/ready');

  const billingScript = 'scripts/reassign-billing-integration-association.cjs';
  const inventoriScript = 'scripts/activate-company1-local-fiscal.cjs';
  docker(['cp', billingScript, `${names.billingApi}:/tmp/reassign-billing-integration-association.cjs`]);
  docker(['cp', inventoriScript, `${names.inventoriApi}:/app/scripts/activate-company1-local-fiscal.cjs`]);

  const sourceDisable = docker(['exec', '-e', 'COMPANY1_ACTIVATION_MODE=REHEARSAL', '-e', 'COMPANY1_ACTIVATION_PHASE=DISABLE_SOURCE', names.inventoriApi, 'node', '/app/scripts/activate-company1-local-fiscal.cjs']).stdout.trim();
  const billFirst = docker(['exec', '-e', 'COMPANY1_ACTIVATION_MODE=REHEARSAL', names.billingApi, 'node', '/tmp/reassign-billing-integration-association.cjs']).stdout.trim();
  const invFirst = docker(['exec', '-e', 'COMPANY1_ACTIVATION_MODE=REHEARSAL', '-e', 'COMPANY1_ACTIVATION_PHASE=ACTIVATE', names.inventoriApi, 'node', '/app/scripts/activate-company1-local-fiscal.cjs']).stdout.trim();
  const billReplay = docker(['exec', '-e', 'COMPANY1_ACTIVATION_MODE=REHEARSAL', names.billingApi, 'node', '/tmp/reassign-billing-integration-association.cjs']).stdout.trim();
  const invReplay = docker(['exec', '-e', 'COMPANY1_ACTIVATION_MODE=REHEARSAL', names.inventoriApi, 'node', '/app/scripts/activate-company1-local-fiscal.cjs']).stdout.trim();

  const summary = docker(['exec', names.inventoriDb, 'psql', '-U', invUser, '-d', invDatabase, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT json_build_object(
      'active_count',(SELECT count(*) FROM company_billing_integration_configs WHERE billing_tenant_id='25ae538c-b272-407b-83d0-ccc78be3c658' AND billing_company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d' AND billing_environment='SANDBOX' AND enabled AND association_status='ACTIVE'),
      'association_1684',(SELECT association_status::text||':'||enabled FROM company_billing_integration_configs WHERE id=1684),
      'association_1686',(SELECT association_status::text||':'||enabled FROM company_billing_integration_configs WHERE id=1686),
      'company1_identity',(SELECT identification_type||':'||identification_number FROM company_fiscal_configs WHERE company_id=1),
      'intents',(SELECT count(*) FROM invoice_fiscal_intents WHERE company_id IN(1,1698)),
      'snapshots',(SELECT count(*) FROM invoice_fiscal_snapshots WHERE company_id IN(1,1698)),
      'invoices',(SELECT count(*) FROM invoices WHERE id IN(1846,1890,1605,1606))
    );`]).stdout.trim();
  const billingSummary = docker(['exec', names.billingDb, 'psql', '-U', billUser, '-d', billDatabase, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT json_build_object(
      'external_key',(SELECT external_company_key FROM fiscal_integration_associations WHERE id='4a74176b-a511-4e27-bfbd-e9ffc1d4f68e'),
      'documents',(SELECT count(*) FROM fiscal_documents WHERE company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d'),
      'sequence_next',(SELECT next_value::text FROM fiscal_sequences WHERE company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d' ORDER BY created_at LIMIT 1),
      'active_profile_keys',(SELECT count(*) FROM api_keys k JOIN api_key_companies c ON c.api_key_id=k.id WHERE k.status='ACTIVE' AND k.integration_profile='inventori-fiscal-v1' AND c.company_id='dde91f44-6ceb-4eb7-b322-0139919cc34d')
    );`]).stdout.trim();
  process.stdout.write(`${JSON.stringify({ event: 'COMPANY1_FINAL_ACTIVATION_REHEARSAL_PASS', sourceDisable: JSON.parse(sourceDisable), billFirst: JSON.parse(billFirst), invFirst: JSON.parse(invFirst), billReplay: JSON.parse(billReplay), invReplay: JSON.parse(invReplay), inventori: JSON.parse(summary), billing: JSON.parse(billingSummary) })}\n`);
} finally {
  safeRemove();
}
