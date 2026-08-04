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

function createHarness() {
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map, Set, URLSearchParams });
  browserWindow.window = browserWindow;
  executeRootScript('registry.js', context);
  browserWindow.InventoryAuth = {
    fetchJson: async () => [],
    buildHeaders: () => ({}),
    handleUnauthorized: () => {},
  };
  executeRootScript('ui.js', context);
  executeRootScript('routes-api.js', context);
  executeRootScript('views/routes-admin.helpers.js', context);
  executeRootScript('views/routes-admin.renderers.js', context);
  executeRootScript('views/routes-admin.state.js', context);
  executeRootScript('views/routes-admin.js', context);
  return browserWindow.RootShell;
}

test('routes helpers preserve local search, replace-all goals payload shaping and bounded map support', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.routesAdminHelpers');

  assert.equal(helpers.filterRoutes([{ id: 1, code: 'RN-01', name: 'Ruta Norte' }], 'norte').length, 1);
  assert.equal(JSON.stringify(helpers.summarizeOverview({ summary: { routesCount: 2, subzonesCount: 4, storesCount: 8, assignedAgentsCount: 3 } })), JSON.stringify({
    routesCount: 2,
    subzonesCount: 4,
    storesCount: 8,
    assignedAgentsCount: 3,
  }));

  const mapModel = helpers.buildMapModel([
    { id: 1, code: 'T-1', name: 'Tienda 1', latitude: 9.9, longitude: -84.1 },
    { id: 2, code: 'T-2', name: 'Tienda 2', latitude: 10.1, longitude: -84.2 },
    { id: 3, code: 'T-3', name: 'Tienda 3', latitude: null, longitude: null },
  ]);
  assert.equal(mapModel.hasMapData, true);
  assert.equal(mapModel.points.length, 2);

  assert.equal(JSON.stringify(helpers.buildGoalsPayload([
    { title: 'Meta Norte', periodLabel: 'Mes', targetAmount: '10', currentAmount: '2', notes: 'ok', isActive: true },
  ])), JSON.stringify({
    goals: [{ title: 'Meta Norte', periodLabel: 'Mes', targetAmount: 10, currentAmount: 2, notes: 'ok', isActive: true }],
  }));
});

test('routes renderer and state seams preserve detail sections, map hook, and goal selection behavior', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.routesAdminRenderers');
  const state = rootShell.require('views.routesAdminState');

  const route = {
    id: 501,
    code: 'RN-01',
    name: 'Ruta Norte',
    visitFrequencyDays: 7,
    nearLimitDays: 2,
    isActive: true,
    subzoneIds: [101],
    agentIds: [10],
    agents: [{ id: 10, goals: [{ title: 'Meta Norte', periodLabel: 'Mensual', targetAmount: 20, currentAmount: 5 }] }],
    stores: [{ id: 801, code: 'T-1', name: 'Tienda Norte', clientName: 'Cliente Norte', subregionName: 'Subzona Norte 1', latitude: 14.6, longitude: -90.5 }],
  };
  const html = renderers.renderRouteDetail(
    route,
    [{ id: 1, name: 'Zona Norte', subregions: [{ id: 101, name: 'Subzona Norte 1' }] }],
    [{ id: 10, fullName: 'Ana Perez', username: 'ana', role: { code: 'sales_agent', name: 'Agente comercial' } }],
    10,
    state.resolveGoalRows(route, 10),
  );

  assert.match(html, /Mapa de cobertura/);
  assert.match(html, /data-route-map/);
  assert.match(html, /Guardar metas/);
  assert.equal(state.buildRoutesListSummary(3, 1), '1 de 3 rutas visibles con el filtro actual.');
  assert.equal(state.getSelectedRoute({ routes: [{ id: 7, name: 'Ruta 7' }] }, {}, 7)?.name, 'Ruta 7');
});

test('routes view render exposes route-management-first sections and map region', () => {
  const rootShell = createHarness();
  const view = rootShell.require('views.routesAdmin');
  const html = view.render({ user: { companyId: '77' } });

  assert.match(html, /Rutas comerciales/);
  assert.match(html, /Nueva ruta/);
  assert.match(html, /Selecciona una ruta/);
  assert.match(html, /definicion, subzonas, cobertura y mapa/i);
});
