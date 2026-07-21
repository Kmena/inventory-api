const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');

const app = require('../src/app');
const {
  SMALL_PAYLOAD_LIMIT,
  MEDIUM_PAYLOAD_LIMIT,
  HIGH_PAYLOAD_LIMIT,
} = require('../src/middlewares/request-payload');

function createOversizedString(sizeInBytes) {
  return 'x'.repeat(sizeInBytes);
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

async function postJson(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

test('small payload surfaces reject oversized login bodies with 413', async () => {
  const oversizedUsername = createOversizedString(300 * 1024);

  await withHttpServer(async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/auth/login`, {
      username: oversizedUsername,
      password: 'demo',
    });

    assert.equal(response.status, 413);
  });
});

test('medium payload surfaces still allow structured requests above the small class baseline', async () => {
  const mediumButNotSmallValue = createOversizedString(400 * 1024);

  await withHttpServer(async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/companies`, {
      name: mediumButNotSmallValue,
      legalName: 'Empresa demo',
      email: 'demo@example.com',
    });

    assert.notEqual(response.status, 413);
    assert.equal(response.status, 401);
  });
});

test('medium payload surfaces reject requests beyond the medium class limit', async () => {
  const oversizedMediumValue = createOversizedString(2 * 1024 * 1024);

  await withHttpServer(async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/companies`, {
      name: oversizedMediumValue,
      legalName: 'Empresa demo',
      email: 'demo@example.com',
    });

    assert.equal(response.status, 413);
  });
});

test('high payload exception surfaces do not inherit the small payload class', async () => {
  const documentContent = createOversizedString(400 * 1024);

  await withHttpServer(async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/clients/1/documents`, {
      documentType: 'CEDULA_REPRESENTANTE',
      fileName: 'documento.txt',
      fileContentBase64: documentContent,
    });

    assert.notEqual(response.status, 413);
    assert.equal(response.status, 401);
  });
});

test('payload limit classes stay explicitly versioned', () => {
  assert.equal(SMALL_PAYLOAD_LIMIT, '256kb');
  assert.equal(MEDIUM_PAYLOAD_LIMIT, '1mb');
  assert.equal(HIGH_PAYLOAD_LIMIT, '25mb');
});

test('mixed routers now mount with medium baseline and keep high payload only on justified endpoints', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const clientRoutesSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'client.routes.js'), 'utf8');
  const productRoutesSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'product.routes.js'), 'utf8');
  const paymentRoutesSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'payment.routes.js'), 'utf8');

  assert.match(appSource, /app\.use\('\/api\/clients', \.\.\.mediumPayloadParsers, clientRouter\);/);
  assert.match(appSource, /app\.use\('\/api\/products', \.\.\.mediumPayloadParsers, productRouter\);/);
  assert.match(appSource, /app\.use\('\/api\/payments', \.\.\.mediumPayloadParsers, paymentRouter\);/);

  assert.match(clientRoutesSource, /router\.post\('\/:clientId\/documents', \.\.\.highPayloadParsers, authorizeAccessPolicy\('client\.document\.upload'\)/);
  assert.match(productRoutesSource, /router\.post\('\/import', \.\.\.highPayloadParsers, authorizeAccessPolicy\('product\.import'\), validate\(importProductsSchema\)/);
  assert.match(paymentRoutesSource, /router\.post\('\/', \.\.\.highPayloadParsers, authorizeAccessPolicy\('payment\.create'\), validate\(createPaymentSchema\)/);
  assert.match(paymentRoutesSource, /router\.put\('\/:id', \.\.\.highPayloadParsers, authorizeAccessPolicy\('payment\.update'\), validate\(updatePaymentSchema\)/);
  assert.doesNotMatch(paymentRoutesSource, /router\.post\('\/:id\/approve', \.\.\.highPayloadParsers/);
  assert.doesNotMatch(paymentRoutesSource, /router\.post\('\/:id\/reject', \.\.\.highPayloadParsers/);
  assert.doesNotMatch(paymentRoutesSource, /router\.post\('\/:id\/reverse', \.\.\.highPayloadParsers/);
});
