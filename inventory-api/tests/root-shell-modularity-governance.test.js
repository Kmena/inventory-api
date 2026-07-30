const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function executeRootScript(relativePath, context) {
  const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function createBrowserContext() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

test('window.RootShell exposes the approved bounded dependency registry contract', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);

  assert.equal(typeof browserWindow.RootShell?.register, 'function');
  assert.equal(typeof browserWindow.RootShell?.require, 'function');
  assert.equal(typeof browserWindow.RootShell?.has, 'function');

  const dependency = { name: 'dependency' };
  browserWindow.RootShell.register('test.dependency', dependency);

  assert.equal(browserWindow.RootShell.has('test.dependency'), true);
  assert.equal(browserWindow.RootShell.require('test.dependency'), dependency);
  assert.throws(() => browserWindow.RootShell.require('missing.dependency'), /Falta la dependencia requerida de RootShell/);
});

test('root shell modules publish and consume dependencies through the bounded RootShell registry', () => {
  const { browserWindow, context } = createBrowserContext();

  browserWindow.InventorySession = { read() { return null; } };
  browserWindow.InventoryAuth = { bootstrapSession: async () => null, fetchJson: async () => null };

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('session-adapter.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);

  assert.equal(browserWindow.RootShell.has('ui'), true);
  assert.equal(browserWindow.RootShell.has('sessionAdapter'), true);
  assert.equal(browserWindow.RootShell.has('guards'), true);
  assert.equal(browserWindow.RootShell.has('manifest'), true);

  const manifest = browserWindow.RootShell.require('manifest');
  assert.equal(Array.isArray(manifest.items), true);
  assert.equal(typeof browserWindow.RootShell.require('guards').isRootUser, 'function');
  assert.equal(typeof browserWindow.RootShell.require('sessionAdapter').bootstrap, 'function');
});
