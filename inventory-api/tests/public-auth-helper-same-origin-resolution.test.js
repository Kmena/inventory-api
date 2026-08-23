const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authHelperPath = path.join(__dirname, '..', 'src', 'public', 'shared', 'auth.js');
const sessionHelperPath = path.join(__dirname, '..', 'src', 'public', 'shared', 'session.js');

function createContext(fetchImplementation) {
  const browserWindow = {
    location: {
      origin: 'http://localhost:2500',
      href: 'http://localhost:2500/root/',
    },
    localStorage: {
      removeItem() {},
      getItem() { return null; },
    },
    document: {
      cookie: '',
      body: {
        appendChild() {},
      },
      createElement() {
        return {
          click() {},
          remove() {},
        };
      },
    },
    URL: {
      createObjectURL() { return 'blob:test'; },
      revokeObjectURL() {},
    },
    fetch: fetchImplementation,
    atob(value) {
      return Buffer.from(value, 'base64').toString('binary');
    },
  };

  const context = vm.createContext({
    window: browserWindow,
    Buffer,
    URLSearchParams,
    console,
  });

  browserWindow.window = browserWindow;
  vm.runInContext(fs.readFileSync(sessionHelperPath, 'utf8'), context, { filename: 'session.js' });
  vm.runInContext(fs.readFileSync(authHelperPath, 'utf8'), context, { filename: 'auth.js' });
  return browserWindow;
}

test('InventoryAuth.fetchJson resolves root-relative API URLs against same origin', async () => {
  const calls = [];
  const browserWindow = createContext(async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true };
      },
    };
  });

  await browserWindow.InventoryAuth.fetchJson(null, '/api/suppliers/company');
  assert.deepEqual(calls, ['http://localhost:2500/api/suppliers/company']);
});

test('InventoryAuth.bootstrapSession and logout also use same-origin absolute URLs', async () => {
  const calls = [];
  const browserWindow = createContext(async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      async json() {
        return { id: '1', username: 'demo', fullName: 'Demo', companyId: '10', role: { code: 'admin' }, permissions: [] };
      },
    };
  });

  await browserWindow.InventoryAuth.bootstrapSession();
  await browserWindow.InventoryAuth.logout({ user: { id: '1' } });

  assert.equal(calls[0], 'http://localhost:2500/api/auth/me');
  assert.equal(calls[1], 'http://localhost:2500/api/auth/logout');
});
