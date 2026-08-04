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
  executeRootScript('agents-api.js', context);
  executeRootScript('views/agents-admin.helpers.js', context);
  executeRootScript('views/agents-admin.renderers.js', context);
  executeRootScript('views/agents-admin.js', context);
  return browserWindow.RootShell;
}

test('agents helpers compose commercial dataset and local filters from users plus routes overview', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.agentsAdminHelpers');

  const agents = helpers.composeAgentsDataset(
    [
      { id: 1, fullName: 'Ana Perez', username: 'ana', role: { code: 'sales_agent', name: 'Agente' }, status: 'ACTIVE' },
      { id: 2, fullName: 'Luis Mora', username: 'luis', role: { code: 'warehouse', name: 'Bodega' }, status: 'ACTIVE' },
      { id: 3, fullName: 'Carla Soto', username: 'carla', role: { code: 'custom', name: 'Personalizado' }, status: 'ACTIVE' },
    ],
    [],
    {
      routes: [{ id: 11, code: 'RN-01', name: 'Ruta Norte', agentIds: [1, 3] }],
      agents: [
        { id: 1, goalsCount: 1, goals: [{ title: 'Meta A', targetAmount: 10, currentAmount: 3 }] },
        { id: 3, goalsCount: 0, goals: [] },
      ],
    },
  );

  assert.equal(agents.length, 2);
  assert.equal(agents[0].fullName, 'Ana Perez');
  assert.equal(agents[0].assignedRoutes[0].code, 'RN-01');
  assert.equal(agents[1].fullName, 'Carla Soto');
  assert.equal(helpers.filterAgents(agents, 'carla', 'all').length, 1);
  assert.equal(helpers.summarizeAgents(agents).withRoutes, 2);
});

test('agents api shapes route-centric assignment updates from agent selection intent', () => {
  const rootShell = createHarness();
  const agentsApi = rootShell.require('agentsApi');

  const operations = agentsApi.shapeAssignmentOperations(
    {
      routes: [
        { id: 10, agentIds: [5, 8] },
        { id: 11, agentIds: [8] },
      ],
    },
    5,
    [11],
  );

  assert.equal(JSON.stringify(operations), JSON.stringify([
    { routeId: 10, userIds: ['8'] },
    { routeId: 11, userIds: ['8', '5'] },
  ]));
});

test('agents renderers keep detail and assignment sections visible without changing the shell contract', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.agentsAdminRenderers');
  const html = renderers.renderDetail({
    id: 1,
    fullName: 'Ana Perez',
    username: 'ana',
    email: 'ana@test.dev',
    phone: '555-0101',
    status: 'ACTIVE',
    group: 'Agente comercial',
    routeIds: [201],
    assignedRoutes: [{ id: 201, code: 'RN-01', name: 'Ruta Norte' }],
    goals: [{ title: 'Meta Norte', periodLabel: 'Mensual', targetAmount: 20, currentAmount: 6 }],
  }, [{ id: 201, code: 'RN-01', name: 'Ruta Norte' }], '');

  assert.match(html, /Rutas asignadas/);
  assert.match(html, /Gestionar en rutas/);
  assert.match(html, /Meta Norte/);
  assert.match(html, /Guardar rutas asignadas/);
});

test('agents view render exposes the dedicated shell surface', () => {
  const rootShell = createHarness();
  const view = rootShell.require('views.agentsAdmin');
  const html = view.render({ user: { companyId: '77' } });

  assert.match(html, /Agentes comerciales/);
  assert.match(html, /Nuevo agente/);
  assert.match(html, /Selecciona un agente/);
});
