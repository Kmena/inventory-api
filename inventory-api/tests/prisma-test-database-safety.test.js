'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeTestDatabaseEnvironment } = require('../src/lib/prisma');

const safe = {
  NODE_ENV: 'test',
  NODE_TEST_CONTEXT: 'child-v8',
  DATABASE_URL: 'postgresql://runner:secret@127.0.0.1:55432/inventori_fiscal_test_a1b2c3d4e5f6?schema=public',
  INVENTORI_BILLING_DATABASE_URL: 'postgresql://runner:secret@127.0.0.1:55432/inventori_fiscal_test_a1b2c3d4e5f6?schema=public',
  INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: 'ift_0123456789abcdef0123456789abcdef',
};

test('Wave 9 Prisma guard accepts the exact runner-owned loopback database', () => {
  assert.doesNotThrow(() => assertSafeTestDatabaseEnvironment(safe));
});

test('Wave 9 Prisma guard rejects normal tracksys during direct node:test execution', () => {
  assert.throws(() => assertSafeTestDatabaseEnvironment({
    NODE_TEST_CONTEXT: 'child-v8',
    DATABASE_URL: 'postgresql://tracksys:secret@localhost:5432/tracksys?schema=public',
  }), /Unsafe test database access blocked/);
});

test('Wave 9 Prisma guard rejects a mismatched dedicated URL', () => {
  assert.throws(() => assertSafeTestDatabaseEnvironment({ ...safe, INVENTORI_BILLING_DATABASE_URL: `${safe.DATABASE_URL}&mismatch=1` }), /Unsafe test database access blocked/);
});

test('Wave 9 Prisma guard rejects a missing runner instance identity', () => {
  assert.throws(() => assertSafeTestDatabaseEnvironment({ ...safe, INVENTORI_BILLING_DISPOSABLE_INSTANCE_ID: '' }), /Unsafe test database access blocked/);
});

test('Wave 9 Prisma guard rejects inherited normal POSTGRES_* values', () => {
  assert.throws(() => assertSafeTestDatabaseEnvironment({
    NODE_TEST_CONTEXT: 'child-v8',
    DATABASE_URL: '',
    POSTGRES_DB: 'tracksys',
    POSTGRES_USER: 'tracksys',
    POSTGRES_PASSWORD: 'normal-database-secret',
  }), /inherited POSTGRES_\* target/);
  assert.throws(() => assertSafeTestDatabaseEnvironment({
    ...safe,
    POSTGRES_DB: 'tracksys',
  }), /Unsafe test database access blocked/);
});

test('Wave 9 Prisma guard allows DB-free tests with database URLs blanked', () => {
  assert.doesNotThrow(() => assertSafeTestDatabaseEnvironment({ NODE_TEST_CONTEXT: 'child-v8', DATABASE_URL: '' }));
});
