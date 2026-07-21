const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  FileBackedThrottleStore,
  resolveDefaultThrottleStoreMode,
} = require('../src/lib/throttle-store');

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

test('resolveDefaultThrottleStoreMode defaults to file outside test mode and memory during tests', () => {
  const originalMode = process.env.THROTTLE_STORE_MODE;
  const originalNodeEnv = process.env.NODE_ENV;

  delete process.env.THROTTLE_STORE_MODE;
  process.env.NODE_ENV = 'test';
  assert.equal(resolveDefaultThrottleStoreMode(), 'memory');

  process.env.NODE_ENV = 'development';
  assert.equal(resolveDefaultThrottleStoreMode(), 'file');

  process.env.THROTTLE_STORE_MODE = 'memory';
  assert.equal(resolveDefaultThrottleStoreMode(), 'memory');

  process.env.THROTTLE_STORE_MODE = 'file';
  assert.equal(resolveDefaultThrottleStoreMode(), 'file');

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
});
