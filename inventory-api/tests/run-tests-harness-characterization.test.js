const test = require('node:test');
const assert = require('node:assert/strict');

const runTests = require('../scripts/run-tests.js');

const disposableUrl = 'postgresql://test:test@127.0.0.1:55432/inventori_fiscal_test_012345abcdef?schema=public';

function verifiedEnvironment(overrides = {}) {
  return {
    INVENTORI_BILLING_POSTGRES_TEST: '1',
    INVENTORI_BILLING_DATABASE_URL: disposableUrl,
    INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: 'ift_0123456789abcdef0123456789abcdef',
    DATABASE_URL: disposableUrl,
    P2_AUDIT_DATABASE_URL: disposableUrl,
    P2_CONSTRAINTS_DATABASE_URL: disposableUrl,
    ...overrides,
  };
}

test('aggregate test runner forces test, memory and an empty inherited Redis target', () => {
  const environment = runTests.getAggregateTestEnvironment(verifiedEnvironment({
    NODE_ENV: 'production',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: 'redis://normal-redis:6379/0',
  }));

  assert.equal(environment.NODE_ENV, 'test');
  assert.equal(environment.BROWSER_SESSION_STORE_MODE, 'memory');
  assert.equal(environment.REDIS_URL, '');
  assert.deepEqual(runTests.validateAggregateTestEnvironment(environment), []);
});

test('aggregate test runner rejects unsupported browser-session modes with actionable guidance', () => {
  const environment = verifiedEnvironment({
    BROWSER_SESSION_STORE_MODE: 'filesystem',
  });

  const failures = runTests.validateAggregateTestEnvironment(environment);
  const guidance = runTests.formatAggregateTestEnvironmentGuidance(environment);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /Unsupported BROWSER_SESSION_STORE_MODE/);
  assert.match(guidance, /Use `npm run test`; it provisions and verifies runner-owned PostgreSQL/);
  assert.match(guidance, /Use `npm run test:redis-path` for the dedicated Redis-backed browser-session lane/);
  assert.match(guidance, /P2_AUDIT_DATABASE_URL/);
  assert.match(guidance, /P2_CONSTRAINTS_DATABASE_URL/);
});

test('aggregate test runner rejects redis mode without REDIS_URL', () => {
  const environment = verifiedEnvironment({
    NODE_ENV: 'test',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: '',
  });

  const failures = runTests.validateAggregateTestEnvironment(environment);

  assert.deepEqual(failures, [
    'BROWSER_SESSION_STORE_MODE=redis requires REDIS_URL for aggregate test execution.',
  ]);
});

test('aggregate test runner rejects missing, normal and mismatched database targets', () => {
  assert.match(
    runTests.validateAggregateTestEnvironment(runTests.getAggregateTestEnvironment({})).join('\n'),
    /DISPOSABLE_DATABASE_URL_REQUIRED|verified disposable PostgreSQL runner/,
  );
  assert.match(
    runTests.validateAggregateTestEnvironment({
      ...verifiedEnvironment(),
      INVENTORI_BILLING_DATABASE_URL: 'postgresql://tracksys:secret@localhost:5432/tracksys?schema=public',
    }).join('\n'),
    /NORMAL_DATABASE_REJECTED/,
  );
  assert.match(
    runTests.validateAggregateTestEnvironment({
      ...verifiedEnvironment(),
      P2_AUDIT_DATABASE_URL: 'postgresql://test:test@127.0.0.1:55433/inventori_fiscal_test_ffffffffffff?schema=public',
    }).join('\n'),
    /DISPOSABLE_DATABASE_URL_MISMATCH/,
  );
});
