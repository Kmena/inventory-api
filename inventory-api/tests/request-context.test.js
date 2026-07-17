const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';

const app = require('../src/app');

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

test('request context middleware assigns a request id header to every response', async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const requestId = response.headers.get('x-request-id');

    assert.equal(typeof requestId, 'string');
    assert.ok(requestId.length > 10);
  });
});
