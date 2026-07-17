const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';

const app = require('../src/app');
const prisma = require('../src/lib/prisma');

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

test('GET /health/ready returns database up when Prisma is reachable', async () => {
  await withModuleStubs(
    [[prisma, {
      checkDatabaseReadiness: async () => {},
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        service: 'inventory-api',
        checks: {
          database: 'up',
        },
      });
    }),
  );
});

test('GET /health/ready returns 503 when Prisma readiness check fails', async () => {
  await withModuleStubs(
    [[prisma, {
      checkDatabaseReadiness: async () => {
        throw new Error('db down');
      },
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health/ready`);

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        ok: false,
        service: 'inventory-api',
        checks: {
          database: 'down',
        },
      });
    }),
  );
});
