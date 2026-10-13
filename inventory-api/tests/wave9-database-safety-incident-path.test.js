'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const incidentTestPath = path.resolve(__dirname, 'receiver-fiscal-readiness-wave6-governance.test.js');
const prismaTripwirePath = path.resolve(__dirname, 'helpers/prisma-constructor-tripwire.cjs');

test('Wave 9 exact equivalent denied-authorization path rejects tracksys before Prisma construction', () => {
  const childEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://tracksys:not-a-real-secret@127.0.0.1:5433/tracksys?schema=public',
    POSTGRES_DB: 'tracksys',
    POSTGRES_USER: 'tracksys',
    POSTGRES_PASSWORD: 'not-a-real-secret',
    INVENTORI_BILLING_POSTGRES_TEST: '',
    INVENTORI_BILLING_DATABASE_URL: '',
    INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: '',
    P2_AUDIT_DATABASE_URL: '',
    P2_CONSTRAINTS_DATABASE_URL: '',
  };
  delete childEnvironment.NODE_TEST_CONTEXT;

  const child = spawnSync(process.execPath, [
    '--require',
    prismaTripwirePath,
    '--test',
    '--test-name-pattern=user WITHOUT clients.edit|user with ZERO permissions',
    incidentTestPath,
  ], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    windowsHide: true,
    env: childEnvironment,
  });

  assert.ifError(child.error);
  const output = `${child.stdout || ''}\n${child.stderr || ''}`;
  assert.equal(child.status, 0, output);
  assert.match(output, /Unsafe test database access blocked/);
  assert.doesNotMatch(output, /WAVE9_PRISMA_CONSTRUCTOR_TRIPWIRE_REACHED/);
  assert.match(output, /user WITHOUT clients\.edit/);
  assert.match(output, /user with ZERO permissions/);
});
