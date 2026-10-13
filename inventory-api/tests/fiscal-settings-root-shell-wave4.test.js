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

function createContext(extraWindow = {}) {
  const browserWindow = { ...extraWindow };
  const context = vm.createContext({ Map, Set, window: browserWindow });
  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

function createManifestHarness() {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);
  return browserWindow.RootShell.require('manifest');
}

function createFiscalPermissionSession() {
  return {
    user: {
      id: '42',
      companyId: '7',
      role: { code: 'fiscal_admin' },
      permissions: ['fiscal.settings.view'],
    },
  };
}

function createNoFiscalPermissionSession() {
  return {
    user: {
      id: '43',
      companyId: '7',
      role: { code: 'procurement_operator' },
      permissions: ['procurement.manage'],
    },
  };
}

function registerRouterViewStubs(rootShell) {
  function createView(name) {
    return {
      render() {
        return `${name}-render`;
      },
    };
  }

  const viewNames = [
    'home', 'inProcess', 'companiesAdmin', 'rolesAdmin', 'zonesAdmin', 'agentsAdmin',
    'clientsAdmin', 'routesAdmin', 'warehousesAdmin', 'productsAdmin', 'inventoryAdmin',
    'lotsAdmin', 'movementsAdmin', 'recipesAdmin', 'productionOrdersAdmin', 'productionPlanner',
    'billingAdmin', 'approvalsAdmin', 'suppliersAdmin', 'quotationsAdmin', 'rfqTrackingAdmin',
    'purchaseRequestsAdmin', 'purchaseOrdersAdmin', 'receiptsAdmin', 'fiscalRefsAdmin',
    'usersAdmin', 'feedbackAdmin',
  ];
  for (const viewName of viewNames) {
    rootShell.register(`views.${viewName}`, createView(viewName));
  }
  rootShell.register('views.fiscalSettingsAdmin', createView('fiscalSettingsAdmin'));
}

function createRouterHarness() {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('guards.js', context);
  executeRootScript('manifest.js', context);
  registerRouterViewStubs(browserWindow.RootShell);
  executeRootScript('router.js', context);
  return browserWindow.RootShell.require('router');
}

function createApiHarness() {
  const fetchCalls = [];
  const { browserWindow, context } = createContext({
    InventoryAuth: {
      fetchJson(session, url, options) {
        fetchCalls.push({ session, url, options });
        return Promise.resolve({ ok: true });
      },
    },
  });
  executeRootScript('registry.js', context);
  executeRootScript('fiscal-settings-api.js', context);
  return { api: browserWindow.RootShell.require('fiscalSettingsApi'), fetchCalls };
}

function createViewHarness(apiImplementation) {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', apiImplementation);
  executeRootScript('views/fiscal-settings-admin.js', context);
  return browserWindow.RootShell.require('views.fiscalSettingsAdmin');
}

function createContainer() {
  const statusElement = { innerHTML: '' };
  const contentElement = { innerHTML: '' };
  return {
    statusElement,
    contentElement,
    querySelector(selector) {
      if (selector === '[data-fiscal-settings-status]') return statusElement;
      if (selector === '[data-fiscal-settings-content]') return contentElement;
      return null;
    },
  };
}

test('manifest exposes Configuración fiscal under Administración only for fiscal settings permission', () => {
  const manifest = createManifestHarness();
  const fiscalItem = manifest.items.find((item) => item.id === 'fiscal-settings');
  assert.ok(fiscalItem, 'fiscal-settings manifest item must exist');
  assert.equal(fiscalItem.routeKey, 'configuracion_fiscal');
  assert.equal(fiscalItem.href, '/root/#configuracion_fiscal');
  assert.equal(fiscalItem.implemented, true);
  assert.equal(fiscalItem.visibilityRule(createFiscalPermissionSession()), true);
  assert.equal(fiscalItem.visibilityRule(createNoFiscalPermissionSession()), false);

  const administration = manifest.adminSidebarSections.find((section) => section.id === 'administration');
  assert.ok(administration, 'administration section must exist');
  assert.ok(administration.entries.some((entry) => entry.id === 'fiscal-settings'));
});

test('router protects direct Fiscal Settings route and dispatches to fiscal view when allowed', () => {
  const router = createRouterHarness();

  const allowedResolution = router.resolveRoute('#configuracion_fiscal', createFiscalPermissionSession());
  assert.equal(allowedResolution.allowed, true);
  assert.equal(allowedResolution.routeKey, 'configuracion_fiscal');
  assert.equal(router.renderRoute(allowedResolution, createFiscalPermissionSession()), 'fiscalSettingsAdmin-render');

  const deniedResolution = router.resolveRoute('#configuracion_fiscal', createNoFiscalPermissionSession());
  assert.equal(deniedResolution.allowed, false);
  assert.equal(deniedResolution.requestedRouteKey, 'configuracion_fiscal');
});

test('Fiscal Settings API uses only Inventori GET endpoint through InventoryAuth.fetchJson', async () => {
  const { api, fetchCalls } = createApiHarness();
  const session = createFiscalPermissionSession();
  const response = await api.getFiscalSettings(session);

  assert.deepEqual(response, { ok: true });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].session, session);
  assert.equal(fetchCalls[0].url, '/api/company/fiscal-settings');
  assert.equal(fetchCalls[0].options.body, undefined);
  assert.equal(fetchCalls[0].options.method, undefined);
});

test('Fiscal Settings view renders Wave 4 status plus Wave 5 checklist without readiness claims', async () => {
  const view = createViewHarness({
    getFiscalSettings() {
      return Promise.resolve({
        taxpayer: {
          verificationStatus: 'VERIFIED',
          verifiedAt: '2026-01-15T10:00:00.000Z',
          taxSituation: 'AL DIA',
          moroso: false,
          omiso: false,
        },
        defaultActivityCode: '620100',
        configuration: { hasBillingIntegration: true },
        activities: [
          {
            code: '620100',
            description: '<Software & servicios>',
            haciendaStatus: 'A',
            haciendaKind: 'Principal',
            billingEnabled: true,
            isDefault: true,
            verifiedAt: '2026-01-15T10:00:00.000Z',
            lastSeenAt: '2026-01-16T10:00:00.000Z',
            verificationSource: 'billing',
          },
        ],
      });
    },
  });
  const container = createContainer();
  const shellStatusCalls = [];

  assert.match(view.render(), /Configuración fiscal/);
  await view.mount(container, createFiscalPermissionSession(), {
    setShellStatus(message, tone) {
      shellStatusCalls.push({ message, tone });
    },
  });

  assert.match(container.contentElement.innerHTML, /Estado del contribuyente/);
  assert.match(container.contentElement.innerHTML, /VERIFIED/);
  assert.match(container.contentElement.innerHTML, /AL DIA/);
  assert.match(container.contentElement.innerHTML, /Código 620100/);
  assert.match(container.contentElement.innerHTML, /&lt;Software &amp; servicios&gt;/);
  assert.match(container.contentElement.innerHTML, /Integración configurada/);
  assert.match(container.contentElement.innerHTML, /no confirma preparación para emitir comprobantes/);
  assert.match(container.contentElement.innerHTML, /Actividades económicas/);
  assert.match(container.contentElement.innerHTML, /Habilitada para facturación/);
  assert.doesNotMatch(container.contentElement.innerHTML, /Agregar actividad|Refrescar|Sincronizar|Definir predeterminada|Establecer como predeterminada/);
  assert.doesNotMatch(container.contentElement.innerHTML, /readyToIssue|Ready to issue|Listo para facturar|listo para emitir/i);
  assert.deepEqual(shellStatusCalls, [{ message: 'Configuración fiscal cargada.', tone: undefined }]);
});

test('Fiscal Settings view shows safe error state for unavailable integration', async () => {
  const view = createViewHarness({
    getFiscalSettings() {
      return Promise.reject(new Error('La integración de facturación no está configurada para esta empresa.'));
    },
  });
  const container = createContainer();

  await view.mount(container, createFiscalPermissionSession(), {});

  assert.match(container.statusElement.innerHTML, /La integración de facturación no está configurada/);
  assert.match(container.contentElement.innerHTML, /No se pudo cargar la configuración fiscal/);
  assert.match(container.contentElement.innerHTML, /solo muestra el estado disponible/);
});

test('Fiscal Settings Wave 4 scripts are declared in runtime contract and index.html before router', () => {
  const runtimeContractSource = fs.readFileSync(path.join(rootPublicPath, 'runtime-contract.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(rootPublicPath, 'index.html'), 'utf8');

  assert.match(runtimeContractSource, /\/root\/fiscal-settings-api\.js/);
  assert.match(runtimeContractSource, /views\.fiscalSettingsAdmin/);
  assert.ok(
    indexSource.indexOf('/root/fiscal-settings-api.js') < indexSource.indexOf('/root/views/fiscal-settings-admin.js'),
    'API script must load before view script',
  );
  assert.ok(
    indexSource.indexOf('/root/views/fiscal-settings-admin.js') < indexSource.indexOf('/root/router.js'),
    'view script must load before router',
  );
});
