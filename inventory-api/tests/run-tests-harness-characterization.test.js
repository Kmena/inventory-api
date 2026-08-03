const test = require('node:test');
const assert = require('node:assert/strict');

const runTests = require('../scripts/run-tests.js');

test('aggregate test runner defaults to test env and memory browser-session mode', () => {
  const environment = runTests.getAggregateTestEnvironment({});

  assert.equal(environment.NODE_ENV, 'test');
  assert.equal(environment.BROWSER_SESSION_STORE_MODE, 'memory');
  assert.deepEqual(runTests.validateAggregateTestEnvironment(environment), []);
});

test('aggregate test runner rejects unsupported browser-session modes with actionable guidance', () => {
  const environment = runTests.getAggregateTestEnvironment({
    NODE_ENV: 'test',
    BROWSER_SESSION_STORE_MODE: 'filesystem',
  });

  const failures = runTests.validateAggregateTestEnvironment(environment);
  const guidance = runTests.formatAggregateTestEnvironmentGuidance(environment);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /Unsupported BROWSER_SESSION_STORE_MODE/);
  assert.match(guidance, /Use `npm run test` for the default broad suite in memory mode/);
  assert.match(guidance, /Use `npm run test:redis-path` for the dedicated Redis-backed browser-session lane/);
  assert.match(guidance, /P2_AUDIT_DATABASE_URL/);
  assert.match(guidance, /P2_CONSTRAINTS_DATABASE_URL/);
});

test('aggregate test runner rejects redis mode without REDIS_URL', () => {
  const environment = runTests.getAggregateTestEnvironment({
    NODE_ENV: 'test',
    BROWSER_SESSION_STORE_MODE: 'redis',
  });

  const failures = runTests.validateAggregateTestEnvironment(environment);

  assert.deepEqual(failures, [
    'BROWSER_SESSION_STORE_MODE=redis requires REDIS_URL for aggregate test execution.',
  ]);
});
