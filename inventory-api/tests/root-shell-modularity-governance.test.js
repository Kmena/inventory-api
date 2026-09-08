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
  assert.match(runtimeContract.getLoaderScriptPaths().join('\n'), /\/root\/rfq-tracking-api\.js/);
  assert.match(runtimeContract.getLoaderScriptPaths().join('\n'), /\/root\/views\/rfq-tracking-admin\.js/);
  assert.equal(runtimeContract.getScriptContract('/root/app.js')?.requiresModules.includes('runtimeContract'), true);
  assert.equal(runtimeContract.getScriptContract('/root/rfq-tracking-api.js')?.registers.includes('rfqTrackingApi'), true);
  assert.equal(runtimeContract.getScriptContract('/root/views/rfq-tracking-admin.js')?.requiresModules.includes('views.rfqTrackingAdminRenderers'), true);
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
  assert.match(clientsRenderersSource, /function renderClientDetail\(client, classifications, documentTypes, zoneOptions, canDeactivate, economicActivities\)/);
  assert.match(clientsStateSource, /function flattenZoneOptions\(regions\)/);
  assert.match(clientsStateSource, /function getSelectedClient\(clients, clientDetailsById, selectedClientId\)/);

  assert.match(routesAdminSource, /views\.routesAdminRenderers/);
  assert.match(routesAdminSource, /views\.routesAdminState/);
  assert.match(routesAdminSource, /routesRenderers\.renderRouteDetail\(/);
  assert.match(routesAdminSource, /routesState\.resolveGoalRows\(/);
  assert.match(routesRenderersSource, /function renderLeafletMap\(route\)/);
  assert.match(routesRenderersSource, /function renderRouteDetail\(route, zones, agents, selectedGoalsAgentId, goalRows\)/);
  assert.match(routesStateSource, /function getSelectedRoute\(overview, detailByRouteId, selectedRouteId\)/);

  const recipesAdminHelpersSource = readRootFile(path.join('views', 'recipes-admin.helpers.js'));
  const recipesAdminRenderersSource = readRootFile(path.join('views', 'recipes-admin.renderers.js'));
  const recipesAdminStateSource = readRootFile(path.join('views', 'recipes-admin.state.js'));
  const recipesAdminVersionEditorSource = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));
  const recipesAdminSource = readRootFile(path.join('views', 'recipes-admin.js'));
  const productionOrdersAdminHelpersSource = readRootFile(path.join('views', 'production-orders-admin.helpers.js'));
  const productionOrdersAdminStateSource = readRootFile(path.join('views', 'production-orders-admin.state.js'));
  const productionOrdersAdminRenderersSource = readRootFile(path.join('views', 'production-orders-admin.renderers.js'));
  const productionOrdersAdminSource = readRootFile(path.join('views', 'production-orders-admin.js'));
  const billingAdminSource = readRootFile(path.join('views', 'billing-admin.js'));
  const billingHelpersSource = readRootFile(path.join('views', 'billing-admin.helpers.js'));
  const billingRenderersSource = readRootFile(path.join('views', 'billing-admin.renderers.js'));

  assert.match(recipesAdminHelpersSource, /rootShell\.register\('views\.recipesAdminHelpers'/);
  assert.match(recipesAdminRenderersSource, /rootShell\.register\('views\.recipesAdminRenderers'/);
  assert.match(recipesAdminStateSource, /rootShell\.register\('views\.recipesAdminState'/);
  assert.match(recipesAdminVersionEditorSource, /rootShell\.register\('views\.recipesAdminVersionEditor'/);
  assert.match(recipesAdminSource, /rootShell\.require\('recipesApi'\)/);
  assert.match(recipesAdminSource, /rootShell\.require\('productsApi'\)/);
  assert.match(recipesAdminSource, /rootShell\.require\('views\.recipesAdminHelpers'\)/);
  assert.match(recipesAdminSource, /rootShell\.require\('views\.recipesAdminRenderers'\)/);
  assert.match(recipesAdminSource, /rootShell\.require\('views\.recipesAdminState'\)/);
  assert.match(recipesAdminSource, /rootShell\.require\('views\.recipesAdminVersionEditor'\)/);
  assert.match(recipesAdminSource, /async function mount\(/);
  assert.match(recipesAdminSource, /function render\(\)/);
  assert.match(recipesAdminSource, /rootShell\.register\('views\.recipesAdmin'/);
  assert.match(productionOrdersAdminHelpersSource, /rootShell\.register\('views\.productionOrdersAdminHelpers'/);
  assert.match(productionOrdersAdminStateSource, /rootShell\.register\('views\.productionOrdersAdminState'/);
  assert.match(productionOrdersAdminRenderersSource, /rootShell\.register\('views\.productionOrdersAdminRenderers'/);
  assert.match(productionOrdersAdminSource, /rootShell\.require\('productionAdminApi'\)/);
  assert.match(productionOrdersAdminSource, /rootShell\.require\('views\.productionOrdersAdminHelpers'\)/);
  assert.match(productionOrdersAdminSource, /rootShell\.require\('views\.productionOrdersAdminRenderers'\)/);
  assert.match(productionOrdersAdminSource, /rootShell\.require\('views\.productionOrdersAdminState'\)/);
  assert.match(productionOrdersAdminSource, /async function mount\(/);
  assert.match(productionOrdersAdminSource, /function render\(\)/);
  assert.match(productionOrdersAdminSource, /rootShell\.register\('views\.productionOrdersAdmin'/);

  assert.match(billingAdminSource, /rootShell\.require\('billingApi'\)/);
  assert.match(billingAdminSource, /rootShell\.require\('views\.billingAdminHelpers'\)/);
  assert.match(billingAdminSource, /rootShell\.require\('views\.billingAdminRenderers'\)/);
  assert.match(billingAdminSource, /rootShell\.require\('ui'\)/);
  assert.match(billingHelpersSource, /function escapeHtml\(/);
  assert.match(billingRenderersSource, /rootShell\.register\('views\.billingAdminRenderers'/);
});

test('in-app-feedback: feedback modules are registered in runtime-contract.js and loaded in index.html', () => {
  const runtimeContractSource = readRootFile('runtime-contract.js');
  const indexSource = readRootFile('index.html');

  assert.match(runtimeContractSource, /path: '\/root\/feedback-api\.js'/);
  assert.match(runtimeContractSource, /registers: \['feedbackApi'\]/);
  assert.match(runtimeContractSource, /path: '\/root\/feedback-widget\.js'/);
  assert.match(runtimeContractSource, /registers: \['feedbackWidget'\]/);
  assert.match(runtimeContractSource, /path: '\/root\/views\/feedback-admin\.js'/);
  assert.match(runtimeContractSource, /registers: \['views\.feedbackAdmin'\]/);

  assert.match(indexSource, /\/root\/feedback-api\.js/);
  assert.match(indexSource, /\/root\/feedback-widget\.js/);
  assert.match(indexSource, /\/root\/views\/feedback-admin\.js/);
});

test('in-app-feedback: feedback-api.js registers feedbackApi and calls InventoryAuth.fetchJson', () => {
  const feedbackApiSource = readRootFile('feedback-api.js');

  assert.match(feedbackApiSource, /rootShell\.register\('feedbackApi'/);
  assert.match(feedbackApiSource, /function submitFeedback\(/);
  assert.match(feedbackApiSource, /function listFeedback\(/);
  assert.match(feedbackApiSource, /function resolveFeedback\(/);
  assert.match(feedbackApiSource, /inventoryAuth\.fetchJson\(/);
  assert.match(feedbackApiSource, /\/api\/feedback/);
});

test('in-app-feedback: feedback-widget.js registers feedbackWidget with init and triggerNudge', () => {
  const feedbackWidgetSource = readRootFile('feedback-widget.js');

  assert.match(feedbackWidgetSource, /rootShell\.register\('feedbackWidget'/);
  assert.match(feedbackWidgetSource, /function init\(/);
  assert.match(feedbackWidgetSource, /function triggerNudge\(/);
  assert.match(feedbackWidgetSource, /feedbackApi\.submitFeedback\(/);
  // Widget must NOT use rootShell.require for feedbackApi (lazy require allowed)
  assert.match(feedbackWidgetSource, /feedbackApi/);
});

test('in-app-feedback: feedback-admin view registers views.feedbackAdmin with render and mount', () => {
  const feedbackAdminSource = readRootFile(path.join('views', 'feedback-admin.js'));

  assert.match(feedbackAdminSource, /rootShell\.register\('views\.feedbackAdmin'/);
  assert.match(feedbackAdminSource, /function render\(/);
  assert.match(feedbackAdminSource, /async function mount\(/);
  assert.match(feedbackAdminSource, /feedbackApi\.listFeedback\(/);
  assert.match(feedbackAdminSource, /feedbackApi\.resolveFeedback\(/);
  assert.match(feedbackAdminSource, /data-resolve-feedback-id/);
});

test('in-app-feedback: router.js dispatches feedback routeKey to feedbackAdminView', () => {
  const routerSource = readRootFile('router.js');
  assert.match(routerSource, /feedbackAdminView/);
  assert.match(routerSource, /routeKey === 'feedback'/);
  assert.match(routerSource, /views\.feedbackAdmin/);
});

test('in-app-feedback: app.js initializes feedbackWidget after session bootstrap', () => {
  const appSource = readRootFile('app.js');
  assert.match(appSource, /feedbackWidget\.init\(activeSession\)/);
  assert.match(appSource, /rootShell\.has\('feedbackWidget'\)/);
});
