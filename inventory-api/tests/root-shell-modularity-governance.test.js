const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
const testsPath = __dirname;

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeRootScript(relativePath, context) {
  const source = readRootFile(relativePath);
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

test('sensitive root-shell modules keep isolated characterization coverage and extracted seams', () => {
  const routerSource = readRootFile('router.js');
  const zonesAdminSource = readRootFile(path.join('views', 'zones-admin.js'));
  const zonesHelpersSource = readRootFile(path.join('views', 'zones-admin.helpers.js'));

  assert.ok(fs.existsSync(path.join(testsPath, 'root-shell-router-characterization.test.js')));
  assert.ok(fs.existsSync(path.join(testsPath, 'zones-view-selection-filters-characterization.test.js')));
  assert.ok(fs.existsSync(path.join(testsPath, 'zones-view-dialog-feedback-characterization.test.js')));

  assert.match(routerSource, /rootShell\.register\('router'/);
  assert.match(routerSource, /function getFirstAccessibleRoute\(session\)/);
  assert.match(routerSource, /function resolveRoute\(hashValue, session\)/);

  assert.match(zonesAdminSource, /zonesAdminHelpers\.getFilteredZones\(zones, zoneSearchTerm\)/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.getSelectedZone\(zones, selectedZoneId, zoneSearchTerm\)/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.getFilteredSubregions\(selectedZone, subregionSearchTerm\)/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.resetFormState\(zoneForm, zoneFormMessage, zoneFieldMap\)/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.resetFormState\(subzoneForm, subzoneFormMessage, subzoneFieldMap\)/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.renderFormError\(zoneFormMessage, zoneFieldMap, error, 'No se pudo crear la zona\.'/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.renderFormError\(subzoneFormMessage, subzoneFieldMap, error, 'No se pudo crear la subzona\.'/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.setSubmitButtonState\(zoneSubmitButton, \{/);
  assert.match(zonesAdminSource, /zonesAdminHelpers\.setSubmitButtonState\(subzoneSubmitButton, \{/);

  assert.match(zonesHelpersSource, /function resetFormState\(formElement, messageElement, fieldMap\)/);
  assert.match(zonesHelpersSource, /function renderFormError\(messageElement, fieldMap, error, fallbackMessage\)/);
  assert.match(zonesHelpersSource, /function setSubmitButtonState\(buttonElement, options\)/);
});
