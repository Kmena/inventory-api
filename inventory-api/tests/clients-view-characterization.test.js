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

function createHarness(options = {}) {
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map, Set, URLSearchParams });
  browserWindow.window = browserWindow;
  executeRootScript('registry.js', context);
  browserWindow.InventoryAuth = {
    fetchJson: options.fetchJson || (async () => []),
    buildHeaders: () => ({}),
    handleUnauthorized: () => {},
  };
  executeRootScript('ui.js', context);
  executeRootScript('clients-api.js', context);
  executeRootScript('views/clients-admin.helpers.js', context);
  executeRootScript('views/clients-admin.renderers.js', context);
  executeRootScript('views/clients-admin.state.js', context);
  // clients-admin-store-dialog must be registered before clients-admin.js (RISK-005)
  executeRootScript('views/clients-admin-store-dialog.js', context);
  executeRootScript('views/clients-admin.js', context);
  return browserWindow.RootShell;
}

test('clients helpers keep local filters and payload shaping bounded to approved fields', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.clientsAdminHelpers');

  const filtered = helpers.filterClients(
    [
      { id: 1, name: 'Cliente Norte', code: 'CN-01', phone: '111', clientClassificationId: 9, isActive: true, storesCount: 1, documents: [] },
      { id: 2, name: 'Cliente Sur', code: 'CS-02', phone: '222', clientClassificationId: 10, isActive: false, storesCount: 0, documents: [{}] },
    ],
    'sur',
    '10',
    'inactive',
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 2);
  assert.equal(JSON.stringify(helpers.summarizeClients(filtered)), JSON.stringify({
    total: 1,
    active: 0,
    withStores: 0,
    withDocuments: 1,
  }));

  const formDataSource = new Map([
    ['name', 'Cliente Demo'],
    ['clientClassificationId', '11'],
    ['creditLimit', '2500'],
    ['paymentType', 'CREDIT'],
  ]);
  const formData = {
    get(key) {
      return formDataSource.has(key) ? formDataSource.get(key) : null;
    },
  };
  const payload = helpers.buildClientPayload(formData);
  assert.equal(payload.clientClassificationId, 11);
  assert.equal(payload.name, 'Cliente Demo');
  assert.equal(payload.creditLimit, 2500);
  assert.equal(payload.paymentType, 'CREDIT');
});

test('clients api keeps taxpayer lookup aligned with the authenticated backend contract', async () => {
  const requests = [];
  const rootShell = createHarness({
    fetchJson: async (_session, url) => {
      requests.push(url);
      return { name: 'Cliente Hacienda', economicActivityCode: '6201', economicActivityName: 'Servicios' };
    },
  });
  const clientsApi = rootShell.require('clientsApi');

  const taxpayer = await clientsApi.lookupTaxpayer({ token: 'session' }, '3-101-123456');

  assert.equal(requests[0], '/api/taxpayers/lookup?identification=3-101-123456');
  assert.equal(taxpayer.economicActivityCode, '6201');
});

test('clients renderer and state seams preserve contextual detail summaries and selection helpers', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.clientsAdminRenderers');
  const state = rootShell.require('views.clientsAdminState');

  const html = renderers.renderClientDetail(
    {
      id: 301,
      name: 'Cliente Norte',
      code: 'CN-01',
      phone: '555-0201',
      clientClassificationId: 1,
      classification: { id: 1, name: 'Preferente' },
      documentType: 'NIT',
      documents: [{ id: 1, documentType: 'NIT', fileName: 'nit.pdf' }],
      stores: [{ id: 10, name: 'Tienda 1', code: 'T-01', subregionName: 'Subzona Norte' }],
      references: [{ id: 20, name: 'Banco Demo', contact: 'Ana', phone1: '555' }],
      isActive: true,
    },
    [{ id: 1, name: 'Preferente' }],
    [{ value: 'NIT', label: 'NIT' }],
    [{ id: 101, name: 'Subzona Norte', regionName: 'Zona Norte' }],
    true,
  );

  assert.match(html, /Detalle contextual/);
  assert.match(html, /Agregar tienda/);
  assert.match(html, /Descargar/);
  assert.equal(state.buildClientsListSummary(4, 2), '2 de 4 clientes visibles con el filtro actual.');
  assert.equal(state.getSelectedClient([{ id: 1, name: 'Cliente' }], {}, 1)?.name, 'Cliente');
});

test('clients view render keeps client detail secondary to the clients workspace', () => {
  const rootShell = createHarness();
  const view = rootShell.require('views.clientsAdmin');
  const html = view.render({ user: { companyId: '77' } });

  assert.match(html, /Clientes/);
  assert.match(html, /Selecciona un cliente/);
  assert.doesNotMatch(html, /client-detail|client_detail/);
  assert.match(html, /Nuevo cliente/);
});
