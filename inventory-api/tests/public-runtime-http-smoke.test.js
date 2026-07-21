const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

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

test('embedded public runtime serves critical HTML entrypoints over HTTP with security headers', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const paths = [
    '/',
    '/root/index.html',
    '/root/dashboard.html',
    '/warehouse/products.html',
    '/agent/workspace.html',
  ];

  for (const pathName of paths) {
    const response = await request(server, pathName);
    assert.equal(response.statusCode, 200, `${pathName} should return 200`);
    assert.match(String(response.headers['content-type'] || ''), /text\/html/);
    assert.match(String(response.headers['content-security-policy'] || ''), /default-src 'self'/);
    assert.match(response.body, /<script|<html/i);
  }
});

test('embedded public runtime serves critical JavaScript assets over HTTP', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const assets = [
    '/login.js',
    '/root/index.js',
    '/warehouse/products.js',
    '/agent/workspace.js',
  ];

  for (const assetPath of assets) {
    const response = await request(server, assetPath);
    assert.equal(response.statusCode, 200, `${assetPath} should return 200`);
    assert.match(String(response.headers['content-type'] || ''), /(javascript|ecmascript|text\/plain)/);
    assert.match(String(response.headers['x-content-type-options'] || ''), /nosniff/i);
    assert.ok(response.body.length > 20, `${assetPath} should not be empty`);
  }
});
