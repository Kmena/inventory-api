const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sessionHelperSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'shared', 'session.js'), 'utf8');
const authHelperSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'shared', 'auth.js'), 'utf8');

function createHarness(fetchImplementation) {
  const storage = new Map();
  const createdLinks = [];
  const window = {
    atob(value) {
      return Buffer.from(value, 'base64').toString('utf8');
    },
    document: {
      cookie: '',
      body: {
        appendChild() {},
      },
      createElement() {
        const link = {
          click() {},
          remove() {},
        };
        createdLinks.push(link);
        return link;
      },
    },
    location: { href: '/current' },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    fetch: fetchImplementation,
    URL: {
      createObjectURL() {
        return 'blob:demo';
      },
      revokeObjectURL() {},
    },
  };

  vm.runInNewContext(sessionHelperSource, { window });
  vm.runInNewContext(authHelperSource, { window });

  return {
    authHelper: window.InventoryAuth,
    createdLinks,
    sessionHelper: window.InventorySession,
    storage,
    window,
  };
}

test('public auth helper still builds authenticated headers centrally for explicit bearer API clients', () => {
  const { authHelper } = createHarness(async () => ({ ok: true, status: 204 }));

  const headers = authHelper.buildHeaders({ token: 'token-demo' }, { includeJsonContentType: true, headers: { Accept: 'application/json' } });

  assert.deepEqual(JSON.parse(JSON.stringify(headers)), {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token-demo',
    Accept: 'application/json',
  });
});

test('public auth helper omits bearer headers for browser-session flows that do not expose tokens and relies on same-origin credentials', () => {
  const { authHelper } = createHarness(async () => ({ ok: true, status: 204 }));

  const headers = authHelper.buildHeaders({ authMode: 'browser-session', user: { id: '1' } }, { includeJsonContentType: true });

  assert.deepEqual(JSON.parse(JSON.stringify(headers)), {
    'Content-Type': 'application/json',
  });
});

test('public auth helper clears shared browser session on unauthorized default requests', async () => {
  const { authHelper, sessionHelper, storage, window } = createHarness(async () => ({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Sesion vencida' }),
  }));

  storage.set(sessionHelper.STORAGE_KEY, JSON.stringify({ user: { fullName: 'Demo', username: 'demo', companyId: 'cmp-1', role: { code: 'admin' }, permissions: [] } }));

  await assert.rejects(
    authHelper.fetchJson({ authMode: 'browser-session', user: { id: '1' } }, '/api/demo', { fallbackMessage: 'fallback' }),
    /Sesion vencida/,
  );

  assert.equal(storage.has(sessionHelper.STORAGE_KEY), false);
  assert.equal(window.location.href, '/?reason=session-expired');
});

test('public auth helper bootstraps session state from /api/auth/me without exposing credentials to storage', async () => {
  const { authHelper, storage } = createHarness(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: '7',
      fullName: 'Admin Demo',
      username: 'admin-demo',
      role: { code: 'admin' },
      permissions: ['users.manage'],
      companyId: 'cmp-7',
    }),
  }));

  const session = await authHelper.bootstrapSession();

  assert.deepEqual(JSON.parse(JSON.stringify(session)), {
    authMode: 'browser-session',
    user: {
      id: '7',
      fullName: 'Admin Demo',
      username: 'admin-demo',
      companyId: 'cmp-7',
      role: { code: 'admin' },
      permissions: ['users.manage'],
      landing: null,
    },
  });
  assert.equal(storage.size, 0);
});
