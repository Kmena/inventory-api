'use strict';

const { spawnSync } = require('node:child_process');

const testFiles = process.argv.slice(2);
if (testFiles.length === 0) {
  throw new Error('At least one DB-free test file is required');
}

const environment = {
  ...process.env,
  NODE_ENV: 'test',
  BROWSER_SESSION_STORE_MODE: 'memory',
  DATABASE_URL: '',
  POSTGRES_DB: '',
  POSTGRES_USER: '',
  POSTGRES_PASSWORD: '',
  INVENTORI_BILLING_POSTGRES_TEST: '',
  INVENTORI_BILLING_DATABASE_URL: '',
  INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: '',
  P2_AUDIT_DATABASE_URL: '',
  P2_CONSTRAINTS_DATABASE_URL: '',
  REDIS_URL: '',
};

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
