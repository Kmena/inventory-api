'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertDisposableDatabaseUrl,
  configureFiscalDisposableDatabase,
  resolveFiscalDisposableDatabaseConfig,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

const instanceId = 'ift_0123456789abcdef0123456789abcdef';
const disposableUrl = 'postgresql://test:test@127.0.0.1:55432/inventori_fiscal_test_012345abcdef?schema=public';

function enabledEnv(overrides = {}) {
  return {
    INVENTORI_BILLING_POSTGRES_TEST: '1',
    INVENTORI_BILLING_DATABASE_URL: disposableUrl,
    INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: instanceId,
    ...overrides,
  };
}

function fakePrisma({
  databaseName = 'inventori_fiscal_test_012345abcdef',
  markerInstanceId = instanceId,
} = {}) {
  return {
    async $queryRaw(sql) {
      if (sql?.strings?.join('').includes('current_database()')) {
        return [{
          database_name: databaseName,
          database_user: 'test',
          server_address: '127.0.0.1/32',
          server_port: 55432,
          database_marker: markerInstanceId == null
            ? null
            : `inventori-disposable:${markerInstanceId}`,
        }];
      }
      throw new Error('Unexpected query');
    },
  };
}

test('fiscal PostgreSQL suites remain skipped when the explicit gate is absent', () => {
  assert.equal(resolveFiscalDisposableDatabaseConfig({}), null);
});

test('rejects missing INVENTORI_BILLING_DATABASE_URL instead of falling back to DATABASE_URL', () => {
  assert.throws(
    () => resolveFiscalDisposableDatabaseConfig(enabledEnv({
      INVENTORI_BILLING_DATABASE_URL: '',
      DATABASE_URL: 'postgresql://tracksys:secret@localhost:5432/tracksys?schema=public',
    })),
    { code: 'DISPOSABLE_DATABASE_URL_REQUIRED' },
  );
});

test('rejects tracksys even with an otherwise valid runner marker', () => {
  assert.throws(
    () => resolveFiscalDisposableDatabaseConfig(enabledEnv({
      INVENTORI_BILLING_DATABASE_URL: 'postgresql://tracksys:secret@localhost:5432/tracksys?schema=public',
    })),
    { code: 'NORMAL_DATABASE_REJECTED' },
  );
});

test('rejects arbitrary database names and non-loopback hosts', () => {
  assert.throws(
    () => resolveFiscalDisposableDatabaseConfig(enabledEnv({
      INVENTORI_BILLING_DATABASE_URL: 'postgresql://test:test@localhost:5432/inventory_test?schema=public',
    })),
    { code: 'DISPOSABLE_DATABASE_NAME_REQUIRED' },
  );
  assert.throws(
    () => resolveFiscalDisposableDatabaseConfig(enabledEnv({
      INVENTORI_BILLING_DATABASE_URL: 'postgresql://test:test@db.internal:5432/inventori_fiscal_test_012345abcdef?schema=public',
    })),
    { code: 'DISPOSABLE_DATABASE_HOST_REQUIRED' },
  );
});

test('rejects missing marker identity and mismatched DATABASE_URL', () => {
  assert.throws(
    () => resolveFiscalDisposableDatabaseConfig(enabledEnv({
      INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: '',
    })),
    { code: 'DISPOSABLE_INSTANCE_ID_REQUIRED' },
  );
  assert.throws(
    () => resolveFiscalDisposableDatabaseConfig(enabledEnv({
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:55433/inventori_fiscal_test_012345abcdef?schema=public',
    })),
    { code: 'DATABASE_URL_MISMATCH' },
  );
});

test('configures DATABASE_URL only from the guarded explicit URL', () => {
  const env = enabledEnv();
  const config = configureFiscalDisposableDatabase(env);
  assert.equal(env.DATABASE_URL, config.url);
  assert.equal(config.databaseName, 'inventori_fiscal_test_012345abcdef');
});

test('rejects dedicated DB suite URLs outside or different from the verified disposable target', () => {
  const config = resolveFiscalDisposableDatabaseConfig(enabledEnv());
  assert.equal(
    assertDisposableDatabaseUrl(disposableUrl, 'P2_AUDIT_DATABASE_URL', config),
    config.url,
  );
  assert.throws(
    () => assertDisposableDatabaseUrl(disposableUrl, 'P2_AUDIT_DATABASE_URL', null),
    { code: 'DISPOSABLE_DATABASE_CONFIG_REQUIRED' },
  );
  assert.throws(
    () => assertDisposableDatabaseUrl(
      'postgresql://test:test@127.0.0.1:55433/inventori_fiscal_test_ffffffffffff?schema=public',
      'P2_CONSTRAINTS_DATABASE_URL',
      config,
    ),
    { code: 'DISPOSABLE_DATABASE_URL_MISMATCH' },
  );
});

test('verifies the actual connected database and runner marker', async () => {
  const config = resolveFiscalDisposableDatabaseConfig(enabledEnv());
  const identity = await verifyFiscalDisposableDatabase(fakePrisma(), config);
  assert.equal(identity.databaseName, config.databaseName);
  assert.equal(identity.instanceId, instanceId);
});

test('rejects a connected normal or mismatched database before fixtures', async () => {
  const config = resolveFiscalDisposableDatabaseConfig(enabledEnv());
  await assert.rejects(
    verifyFiscalDisposableDatabase(fakePrisma({ databaseName: 'tracksys' }), config),
    { code: 'CONNECTED_DATABASE_MISMATCH' },
  );
});

test('rejects missing or mismatched runner markers from the connected database', async () => {
  const config = resolveFiscalDisposableDatabaseConfig(enabledEnv());
  await assert.rejects(
    verifyFiscalDisposableDatabase(fakePrisma({ markerInstanceId: null }), config),
    { code: 'DISPOSABLE_MARKER_MISMATCH' },
  );
  await assert.rejects(
    verifyFiscalDisposableDatabase(fakePrisma({ markerInstanceId: 'ift_ffffffffffffffffffffffffffffffff' }), config),
    { code: 'DISPOSABLE_MARKER_MISMATCH' },
  );
});
