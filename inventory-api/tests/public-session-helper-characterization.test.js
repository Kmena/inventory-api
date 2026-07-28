const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const helperSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'shared', 'session.js'), 'utf8');

function encodeUserCookie(user) {
  const payload = Buffer.from(JSON.stringify(user), 'utf8').toString('base64url');
  return `${payload}.signature-demo`;
}

function createHarness({ cookie = '', storedSession = null } = {}) {
  const storage = new Map();
  if (storedSession !== null) {
    storage.set('inventory-api-auth', storedSession);
  }

  const window = {
    atob(value) {
      return Buffer.from(value, 'base64').toString('utf8');
    },
    document: {
      cookie,
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
  };

  vm.runInNewContext(helperSource, { window });

  return {
    storage,
    sessionHelper: window.InventorySession,
    window,
  };
}

test('public session helper normalizes browser-state cookies to a browser-safe browser session without persisting bearer credentials', () => {
  const { sessionHelper } = createHarness({
    cookie: `inventory_browser_state=${encodeUserCookie({
      id: 'user-1',
      fullName: 'Admin Demo',
      username: 'admin-demo',
      companyId: 'cmp-1',
      role: { code: 'admin', name: 'Administrador' },
      permissions: ['users.manage', '', null, 'users.manage'],
    })}`,
  });

  const session = sessionHelper.read();

  assert.deepEqual(JSON.parse(JSON.stringify(session)), {
    authMode: 'browser-session',
    user: {
      id: 'user-1',
      fullName: 'Admin Demo',
      username: 'admin-demo',
      companyId: 'cmp-1',
      role: { code: 'admin' },
      permissions: ['users.manage', 'users.manage'],
    },
  });
});

test('public session helper clears malformed or legacy stored sessions during read fallback', () => {
  const { storage, sessionHelper } = createHarness({
    storedSession: '{sesion-corrupta',
  });

  assert.equal(sessionHelper.read(), null);
  assert.equal(storage.has(sessionHelper.STORAGE_KEY), false);

  const legacyHarness = createHarness({
    storedSession: JSON.stringify({ token: 'legacy-token', user: { id: '1', fullName: 'Demo', username: 'demo', companyId: null, role: { code: 'root' }, permissions: [] } }),
  });
  const legacySession = legacyHarness.sessionHelper.read();
  assert.equal(legacyHarness.storage.has(legacyHarness.sessionHelper.STORAGE_KEY), false);
  assert.equal(legacySession.authMode, 'browser-session');
  assert.equal(Object.prototype.hasOwnProperty.call(legacySession, 'token'), false);
});

test('public session helper centralizes logout cleanup and redirect flow', () => {
  const { storage, sessionHelper, window } = createHarness({
    storedSession: JSON.stringify({ user: { id: '1', fullName: 'Demo', username: 'demo', companyId: null, role: { code: 'root' }, permissions: [] } }),
  });
  sessionHelper.clearAndRedirectToLogin('session-expired');

  assert.equal(storage.has(sessionHelper.STORAGE_KEY), false);
  assert.equal(window.location.href, '/?reason=session-expired');
});
