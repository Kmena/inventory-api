const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const browserSessionService = require('../src/services/browser-session.service');
const fiscalSchedulerService = require('../src/services/fiscal-scheduler.service');

function withModuleStubs(stubsByModule, run) {
  const originals = [];

  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

async function withHttpServer(run) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test('GET /health preserves the backward-compatible liveness response', async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: 'inventory-api',
    });
  });
});

// TASK-015B: All /health/ready responses now include fiscalScheduler check.
// In these tests the application scheduler is never started, so the field
// is always 'stopped'. We stub getApplicationSchedulerStatus to make this
// deterministic regardless of env config.

test('GET /health/ready returns database and browser-session store up when both dependencies are reachable', async () => {
  await withModuleStubs(
    [
      [prisma, { checkDatabaseReadiness: async () => {} }],
      [browserSessionService, { checkBrowserSessionStoreReadiness: async () => ({ mode: 'redis', status: 'up' }) }],
      [fiscalSchedulerService, { getApplicationSchedulerStatus: () => ({ enabled: true, running: false }) }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        service: 'inventory-api',
        checks: { database: 'up', browserSessionStore: 'up', fiscalScheduler: 'stopped' },
      });
    }),
  );
});

test('GET /health/ready returns 503 when Prisma readiness check fails', async () => {
  await withModuleStubs(
    [
      [prisma, { checkDatabaseReadiness: async () => { throw new Error('db down'); } }],
      [browserSessionService, { checkBrowserSessionStoreReadiness: async () => ({ mode: 'redis', status: 'up' }) }],
      [fiscalSchedulerService, { getApplicationSchedulerStatus: () => ({ enabled: true, running: false }) }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        ok: false,
        service: 'inventory-api',
        checks: { database: 'down', browserSessionStore: 'up', fiscalScheduler: 'stopped' },
      });
    }),
  );
});

test('GET /health/ready returns 503 when Redis-backed browser-session readiness fails', async () => {
  await withModuleStubs(
    [
      [prisma, { checkDatabaseReadiness: async () => {} }],
      [browserSessionService, { checkBrowserSessionStoreReadiness: async () => ({ mode: 'redis', status: 'down' }) }],
      [fiscalSchedulerService, { getApplicationSchedulerStatus: () => ({ enabled: true, running: false }) }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        ok: false,
        service: 'inventory-api',
        checks: { database: 'up', browserSessionStore: 'down', fiscalScheduler: 'stopped' },
      });
    }),
  );
});

test('GET /health/ready stays successful in memory mode without requiring Redis', async () => {
  await withModuleStubs(
    [
      [prisma, { checkDatabaseReadiness: async () => {} }],
      [browserSessionService, { checkBrowserSessionStoreReadiness: async () => ({ mode: 'memory', status: 'memory' }) }],
      [fiscalSchedulerService, { getApplicationSchedulerStatus: () => ({ enabled: false, running: false }) }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        service: 'inventory-api',
        checks: { database: 'up', browserSessionStore: 'memory', fiscalScheduler: 'stopped' },
      });
    }),
  );
});

test('GET /health/ready reports fiscalScheduler as running when scheduler is active', async () => {
  await withModuleStubs(
    [
      [prisma, { checkDatabaseReadiness: async () => {} }],
      [browserSessionService, { checkBrowserSessionStoreReadiness: async () => ({ mode: 'memory', status: 'memory' }) }],
      [fiscalSchedulerService, { getApplicationSchedulerStatus: () => ({ enabled: true, running: true, pollCount: 5 }) }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.checks.fiscalScheduler, 'running');
      assert.equal(body.ok, true);
    }),
  );
});

test('GET /health/ready: fiscalScheduler stopped does NOT make response non-ready', async () => {
  await withModuleStubs(
    [
      [prisma, { checkDatabaseReadiness: async () => {} }],
      [browserSessionService, { checkBrowserSessionStoreReadiness: async () => ({ mode: 'memory', status: 'memory' }) }],
      [fiscalSchedulerService, { getApplicationSchedulerStatus: () => ({ enabled: true, running: false }) }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);
      // Scheduler stopped must NOT cause 503 — it is a background worker
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.equal(body.checks.fiscalScheduler, 'stopped');
    }),
  );
});
