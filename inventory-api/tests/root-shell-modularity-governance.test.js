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
  executeRootScript('runtime-contract.js', context);
  executeRootScript('ui.js', context);
  executeRootScript('session-adapter.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);

  assert.equal(browserWindow.RootShell.has('runtimeContract'), true);
  assert.equal(browserWindow.RootShell.has('ui'), true);
  assert.equal(browserWindow.RootShell.has('sessionAdapter'), true);
  assert.equal(browserWindow.RootShell.has('guards'), true);
  assert.equal(browserWindow.RootShell.has('manifest'), true);

  const runtimeContract = browserWindow.RootShell.require('runtimeContract');
  const manifest = browserWindow.RootShell.require('manifest');
  assert.deepEqual(Array.from(runtimeContract.bootstrapModuleNames), ['sessionAdapter', 'guards', 'manifest', 'router']);
  assert.match(runtimeContract.getLoaderScriptPaths().join('\n'), /\/root\/runtime-contract\.js/);
  assert.equal(runtimeContract.getScriptContract('/root/app.js')?.requiresModules.includes('runtimeContract'), true);
  assert.equal(Array.isArray(manifest.items), true);
  assert.equal(typeof browserWindow.RootShell.require('guards').isRootUser, 'function');
  assert.equal(typeof browserWindow.RootShell.require('sessionAdapter').bootstrap, 'function');
});

test('sensitive root-shell modules keep isolated characterization coverage and extracted seams', () => {
  const appSource = readRootFile('app.js');
  const routerSource = readRootFile('router.js');
  const zonesAdminSource = readRootFile(path.join('views', 'zones-admin.js'));
  const zonesHelpersSource = readRootFile(path.join('views', 'zones-admin.helpers.js'));
  const agentsAdminSource = readRootFile(path.join('views', 'agents-admin.js'));
  const agentsRenderersSource = readRootFile(path.join('views', 'agents-admin.renderers.js'));
  const clientsAdminSource = readRootFile(path.join('views', 'clients-admin.js'));
  const clientsRenderersSource = readRootFile(path.join('views', 'clients-admin.renderers.js'));
  const clientsStateSource = readRootFile(path.join('views', 'clients-admin.state.js'));
  const routesAdminSource = readRootFile(path.join('views', 'routes-admin.js'));
  const routesRenderersSource = readRootFile(path.join('views', 'routes-admin.renderers.js'));
  const routesStateSource = readRootFile(path.join('views', 'routes-admin.state.js'));

  assert.ok(fs.existsSync(path.join(testsPath, 'root-shell-router-characterization.test.js')));
  assert.ok(fs.existsSync(path.join(testsPath, 'zones-view-selection-filters-characterization.test.js')));
  assert.ok(fs.existsSync(path.join(testsPath, 'zones-view-dialog-feedback-characterization.test.js')));

  assert.match(appSource, /rootShell\.require\('runtimeContract'\)/);
  assert.match(appSource, /runtimeContract\.requireModules\(runtimeContract\.bootstrapModuleNames\)/);
  assert.match(appSource, /runtimeContract\.assertNavigationItems\(rootShellManifest\.items\)/);

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

  assert.match(agentsAdminSource, /views\.agentsAdminRenderers/);
  assert.match(agentsAdminSource, /agentsRenderers\.renderList\(/);
  assert.match(agentsAdminSource, /agentsRenderers\.renderDetail\(/);
  assert.match(agentsRenderersSource, /function renderAssignmentsEditor\(routeOptions, selectedRouteIds, disabledReason\)/);
  assert.match(agentsRenderersSource, /function renderDetail\(agent, routeOptions, routesUnavailable\)/);

  assert.match(clientsAdminSource, /views\.clientsAdminRenderers/);
  assert.match(clientsAdminSource, /views\.clientsAdminState/);
  assert.match(clientsAdminSource, /clientsRenderers\.renderClientList\(/);
  assert.match(clientsAdminSource, /clientsState\.buildClientsListSummary\(/);
  assert.match(clientsRenderersSource, /function renderClientDetail\(client, classifications, documentTypes, zoneOptions, canDeactivate\)/);
  assert.match(clientsStateSource, /function flattenZoneOptions\(regions\)/);
  assert.match(clientsStateSource, /function getSelectedClient\(clients, clientDetailsById, selectedClientId\)/);

  assert.match(routesAdminSource, /views\.routesAdminRenderers/);
  assert.match(routesAdminSource, /views\.routesAdminState/);
  assert.match(routesAdminSource, /routesRenderers\.renderRouteDetail\(/);
  assert.match(routesAdminSource, /routesState\.resolveGoalRows\(/);
  assert.match(routesRenderersSource, /function renderSvgMap\(route\)/);
  assert.match(routesRenderersSource, /function renderRouteDetail\(route, zones, agents, selectedGoalsAgentId, goalRows\)/);
  assert.match(routesStateSource, /function getSelectedRoute\(overview, detailByRouteId, selectedRouteId\)/);
});
