const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.BROWSER_SESSION_STORE_MODE = 'memory';

const app = require('../src/app');

function request(server, pathName) {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '127.0.0.1',
      port,
      path: pathName,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
  });
}

test('reduced public runtime serves supported HTML entrypoints with strict security headers', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const supportedPaths = ['/', '/index.html', '/no-access.html', '/migration.html', '/migration.html?mode=post-login-transition', '/root/'];

  for (const pathName of supportedPaths) {
    const response = await request(server, pathName);
    assert.equal(response.statusCode, 200, `${pathName} should return 200`);
    assert.match(String(response.headers['content-type'] || ''), /text\/html/);
    assert.match(String(response.headers['content-security-policy'] || ''), /default-src 'self'/);
    assert.doesNotMatch(String(response.headers['content-security-policy'] || ''), /unpkg\.com|cdn\.jsdelivr\.net|nominatim\.openstreetmap\.org/);
    assert.match(response.body, /<script|<html/i);
  }

  const postLoginTransitionResponse = await request(server, '/migration.html?mode=post-login-transition');
  assert.equal(postLoginTransitionResponse.statusCode, 200);
  assert.match(postLoginTransitionResponse.body, /migration-status-note/);
  assert.match(postLoginTransitionResponse.body, /<script src="\/migration\.js"><\/script>/);
});

test('supported root shell and post-login transition URLs stay active while deprecated legacy routes still return 410', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const supportedRootShellResponse = await request(server, '/root/');
  assert.equal(supportedRootShellResponse.statusCode, 200);
  assert.match(String(supportedRootShellResponse.headers['content-security-policy'] || ''), /default-src 'self'/);
  assert.match(supportedRootShellResponse.body, /root-main/);

  const supportedTransitionResponse = await request(server, '/migration.html?mode=post-login-transition');
  assert.equal(supportedTransitionResponse.statusCode, 200);
  assert.match(String(supportedTransitionResponse.headers['content-security-policy'] || ''), /default-src 'self'/);
  assert.match(supportedTransitionResponse.body, /migration-home-link/);

  const deprecatedRouteResponse = await request(server, '/root/dashboard.html');
  assert.equal(deprecatedRouteResponse.statusCode, 410);
  assert.match(deprecatedRouteResponse.body, /Codigo de estado: 410/);
});

test('legacy html routes now return the migration screen directly with 410 Gone', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const deprecatedPaths = [
    '/root/dashboard.html',
    '/warehouse/products.html',
    '/agent/workspace.html',
  ];

  for (const pathName of deprecatedPaths) {
    const response = await request(server, pathName);
    assert.equal(response.statusCode, 410, `${pathName} should return 410`);
    assert.match(String(response.headers['content-type'] || ''), /text\/html/);
    assert.match(String(response.headers['content-security-policy'] || ''), /default-src 'self'/);
    assert.doesNotMatch(String(response.headers['content-security-policy'] || ''), /unpkg\.com|cdn\.jsdelivr\.net|nominatim\.openstreetmap\.org/);
    assert.match(response.body, /Esta ruta ya no se encuentra disponible/);
    assert.match(response.body, /Codigo de estado: 410/);
  }
});

test('reduced public runtime serves only the remaining supported JavaScript assets and no longer serves legacy runtime bundles', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const supportedAssets = ['/login.js', '/migration.js', '/shared/auth.js', '/shared/session.js', '/root/app.js', '/root/router.js', '/root/registry.js', '/root/companies-api.js', '/root/roles-api.js', '/root/ui.js', '/root/views/companies-admin.js', '/root/views/roles-admin.js'];

  for (const assetPath of supportedAssets) {
    const response = await request(server, assetPath);
    assert.equal(response.statusCode, 200, `${assetPath} should return 200`);
    assert.match(String(response.headers['content-type'] || ''), /(javascript|ecmascript|text\/plain)/);
    assert.match(String(response.headers['x-content-type-options'] || ''), /nosniff/i);
    assert.ok(response.body.length > 20, `${assetPath} should not be empty`);
  }

  for (const retiredAssetPath of ['/root/index.js', '/warehouse/products.js', '/agent/workspace.js']) {
    const response = await request(server, retiredAssetPath);
    assert.equal(response.statusCode, 404, `${retiredAssetPath} should no longer be publicly served`);
  }
});
