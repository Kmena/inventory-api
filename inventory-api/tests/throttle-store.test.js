const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  FileBackedThrottleStore,
  PrismaBackedThrottleStore,
  resolveDefaultThrottleStoreMode,
} = require('../src/lib/throttle-store');

class FakePrismaThrottleClient {
  constructor() {
    this.rows = new Map();
  }

  renderStatement(statement) {
    return statement.strings.join('?').replace(/\s+/g, ' ').trim();
  }

  async $queryRaw(statement) {
    const query = this.renderStatement(statement);
    if (!query.includes('FROM "throttle_entries"')) {
      throw new Error(`Unsupported query: ${query}`);
    }

    const row = this.rows.get(statement.values[0]);
    return row ? [{ ...row }] : [];
  }

  async $executeRaw(statement) {
    const query = this.renderStatement(statement);
    const [key, payloadJson, expiresAt] = statement.values;

    if (query.startsWith('DELETE FROM "throttle_entries" WHERE scope_key = ?')) {
      this.rows.delete(key);
      return 1;
    }

    if (query === 'DELETE FROM "throttle_entries"') {
      this.rows.clear();
      return 1;
    }

    if (query.includes('INSERT INTO "throttle_entries"')) {
      this.rows.set(key, {
        payload_json: payloadJson,
        expires_at: expiresAt || null,
      });
      return 1;
    }

    throw new Error(`Unsupported execute: ${query}`);
  }

  async $transaction(callback) {
    return callback(this);
  }
}

test('FileBackedThrottleStore persists throttle entries across store instances', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-api-throttle-'));
  const filePath = path.join(tempDir, 'throttle-store.json');

  const firstStore = new FileBackedThrottleStore({ filePath });
  firstStore.set('login::alice', {
    failedAttempts: 3,
    firstFailedAt: 100,
    blockedUntil: 200,
  });

  const secondStore = new FileBackedThrottleStore({ filePath });
  assert.deepEqual(secondStore.get('login::alice'), {
    failedAttempts: 3,
    firstFailedAt: 100,
    blockedUntil: 200,
  });

  secondStore.delete('login::alice');
  assert.equal(firstStore.get('login::alice'), undefined);
});

test('PrismaBackedThrottleStore stores, updates and expires shared throttle entries', async () => {
  const prismaClient = new FakePrismaThrottleClient();
  const store = new PrismaBackedThrottleStore({ prismaClient });

  await store.set('lookup::shared', {
    hits: 1,
    windowStartedAt: 100,
  }, {
    expiresAt: new Date(Date.now() + 60_000),
  });

  assert.deepEqual(await store.get('lookup::shared'), {
    hits: 1,
    windowStartedAt: 100,
  });

  const updatedEntry = await store.update('lookup::shared', (currentEntry) => ({
    ...currentEntry,
    hits: currentEntry.hits + 1,
  }), {
    expiresAt: new Date(Date.now() + 60_000),
  });

  assert.deepEqual(updatedEntry, {
    hits: 2,
    windowStartedAt: 100,
  });
  assert.deepEqual(await store.get('lookup::shared'), {
    hits: 2,
    windowStartedAt: 100,
  });

  await store.set('lookup::expired', {
    hits: 9,
    windowStartedAt: 50,
  }, {
    expiresAt: new Date(Date.now() - 1_000),
  });

  assert.equal(await store.get('lookup::expired'), undefined);
});

test('PrismaBackedThrottleStore rejects unsupported table identifiers', () => {
  assert.throws(
    () => new PrismaBackedThrottleStore({ prismaClient: new FakePrismaThrottleClient(), tableName: 'throttle_entries;DROP TABLE users' }),
    /Prisma throttle table name must be one of/i,
  );
});

test('resolveDefaultThrottleStoreMode defaults to prisma when DATABASE_URL is present, file otherwise and memory during tests', () => {
  const originalMode = process.env.THROTTLE_STORE_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  delete process.env.THROTTLE_STORE_MODE;
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://example.test/inventory';
  assert.equal(resolveDefaultThrottleStoreMode(), 'memory');

  process.env.NODE_ENV = 'development';
  delete process.env.DATABASE_URL;
  assert.equal(resolveDefaultThrottleStoreMode(), 'file');

  process.env.DATABASE_URL = 'postgresql://example.test/inventory';
  assert.equal(resolveDefaultThrottleStoreMode(), 'prisma');

  process.env.THROTTLE_STORE_MODE = 'memory';
  assert.equal(resolveDefaultThrottleStoreMode(), 'memory');

  process.env.THROTTLE_STORE_MODE = 'file';
  assert.equal(resolveDefaultThrottleStoreMode(), 'file');

  process.env.THROTTLE_STORE_MODE = 'prisma';
  assert.equal(resolveDefaultThrottleStoreMode(), 'prisma');

  if (originalMode === undefined) {
    delete process.env.THROTTLE_STORE_MODE;
  } else {
    process.env.THROTTLE_STORE_MODE = originalMode;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});
