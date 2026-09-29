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

function createViewSession(permissions) {
  return {
    user: {
      id: '42',
      companyId: '7',
      role: { code: 'fiscal_admin' },
      permissions,
    },
  };
}

function createViewHarness(apiImplementation) {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', apiImplementation);
  executeRootScript('views/fiscal-settings-admin.js', context);
  return browserWindow.RootShell.require('views.fiscalSettingsAdmin');
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

class FakeControl {
  constructor({ code, checked, disabled }) {
    this.code = code;
    this.checked = checked;
    this.disabled = disabled;
    this.listeners = {};
  }

  getAttribute(name) {
    if (name === 'data-activity-code') return this.code;
    return null;
  }

  addEventListener(eventName, handler) {
    this.listeners[eventName] = handler;
  }
}

function extractAttribute(tag, name) {
  const regex = new RegExp(`${name}="([^"]*)"`);
  const match = tag.match(regex);
  return match ? match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&') : '';
}

function createContainer() {
  const statusElement = { innerHTML: '' };
  const contentElement = {
    _innerHTML: '',
    controls: [],
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(value) {
      this._innerHTML = value;
      const inputTags = (value.match(/<input[\s\S]*?>/g) || []).filter((tag) => tag.includes('data-fiscal-activity-toggle'));
      this.controls = inputTags.map((tag) => new FakeControl({
        code: extractAttribute(tag, 'data-activity-code'),
        checked: /\schecked(\s|>)/.test(tag),
        disabled: /\sdisabled(\s|>)/.test(tag),
      }));
    },
    querySelectorAll(selector) {
      if (selector === '[data-fiscal-activity-toggle]') return this.controls;
      return [];
    },
  };

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

function createSettings(overrides = {}) {
  return {
    taxpayer: {
      verificationStatus: 'VERIFIED',
      verifiedAt: '2026-01-15T10:00:00.000Z',
      taxSituation: 'AL DIA',
      moroso: false,
      omiso: false,
    },
    defaultActivityCode: '9609.0',
    billingCompanyId: 'billing-company-secret-ish',
    billingTenantId: 'tenant-nope',
    billingCredentialSecretRef: 'secret/ref/nope',
    apiKey: 'raw-api-key-nope',
    configuration: { hasBillingIntegration: true },
    activities: [
      {
        code: '9609.0',
        description: '<Servicios personales & otros>',
        haciendaStatus: 'A',
        haciendaKind: 'Principal',
        billingEnabled: true,
        isDefault: true,
        verifiedAt: '2026-01-15T10:00:00.000Z',
        lastSeenAt: '2026-01-16T10:00:00.000Z',
        verificationSource: 'billing',
        billingCompanyId: 'activity-billing-company-hidden',
      },
      {
        code: 'A.B-007',
        description: 'Actividad secundaria',
        haciendaStatus: 'A',
        haciendaKind: 'Secundaria',
        billingEnabled: false,
        isDefault: false,
      },
      {
        code: 'INACTIVA.1',
        description: 'Actividad inactiva',
        haciendaStatus: 'I',
        haciendaKind: 'Histórica',
        billingEnabled: false,
        isDefault: false,
      },
    ],
    ...overrides,
  };
}

async function mountView({ api, session = createViewSession(['fiscal.settings.view', 'fiscal.activities.manage']) }) {
  const view = createViewHarness(api);
  const container = createContainer();
  await view.mount(container, session, {});
  return container;
}

test('Wave 5 API patches exact Inventori activity endpoint with billingEnabled only', async () => {
  const { api, fetchCalls } = createApiHarness();
  const session = createViewSession(['fiscal.settings.view', 'fiscal.activities.manage']);

  await api.updateActivityBillingEnabled(session, '9609.0', true);
  await api.updateActivityBillingEnabled(session, 'A/B 007', false);

  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].url, '/api/company/fiscal-settings/activities/9609.0');
  assert.equal(fetchCalls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { billingEnabled: true });
  assert.equal(fetchCalls[1].url, '/api/company/fiscal-settings/activities/A%2FB%20007');
  assert.deepEqual(JSON.parse(fetchCalls[1].options.body), { billingEnabled: false });
  assert.doesNotMatch(fetchCalls[0].options.body, /companyId|billingCompanyId|billingTenantId|secret|apiKey/i);
});

test('Wave 5 checklist renders authoritative backend activities safely and no manual creation UI', async () => {
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings()),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const html = container.contentElement.innerHTML;
  assert.match(html, /Actividades económicas/);
  assert.match(html, /9609\.0/);
  assert.doesNotMatch(html, /96090|960900/);
  assert.match(html, /&lt;Servicios personales &amp; otros&gt;/);
  assert.match(html, /Hacienda activa/);
  assert.match(html, /Hacienda inactiva/);
  assert.match(html, /Predeterminada/);
  assert.match(html, /Habilitada en Billing/);
  assert.match(html, /Deshabilitada en Billing/);
  assert.equal(container.contentElement.controls.length, 3);
  assert.equal(container.contentElement.controls[0].checked, true);
  assert.equal(container.contentElement.controls[1].checked, false);
  assert.equal(container.contentElement.controls[2].disabled, true);
  assert.doesNotMatch(html, /Agregar actividad|Crear actividad|codigo de actividad|código de actividad libre|type="text"/i);
  assert.doesNotMatch(html, /billing-company-secret-ish|tenant-nope|secret\/ref\/nope|raw-api-key-nope|activity-billing-company-hidden/);
  assert.doesNotMatch(html, /Listo para facturar|readyToIssue|reasonCodes|certificate readiness|credential readiness/i);
});

test('Wave 5 zero activities renders safe empty state without creation or refresh', async () => {
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings({ activities: [] })),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.match(container.contentElement.innerHTML, /No hay actividades económicas verificadas disponibles/);
  assert.equal(container.contentElement.controls.length, 0);
  assert.doesNotMatch(container.contentElement.innerHTML, /Agregar actividad|Actualizar desde Hacienda|Refrescar|Sincronizar/i);
});

test('Wave 5 view-only user sees activities but cannot mutate', async () => {
  const container = await mountView({
    session: createViewSession(['fiscal.settings.view']),
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings()),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.match(container.contentElement.innerHTML, /9609\.0/);
  assert.equal(container.contentElement.controls.length, 3);
  assert.equal(container.contentElement.controls.every((control) => control.disabled), true);
  assert.match(container.contentElement.innerHTML, /puede ver esta actividad, pero no modificarla/);
});

test('Wave 5 successful toggle sends one PATCH and consumes canonical backend response', async () => {
  const patchCalls = [];
  const canonical = createSettings({
    activities: [
      {
        code: 'A.B-007',
        description: 'Actividad secundaria',
        haciendaStatus: 'A',
        haciendaKind: 'Secundaria',
        billingEnabled: true,
        isDefault: false,
      },
    ],
  });
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings({ activities: [createSettings().activities[1]] })),
      updateActivityBillingEnabled: (session, code, billingEnabled) => {
        patchCalls.push({ session, code, billingEnabled });
        return Promise.resolve(canonical);
      },
    },
  });

  const control = container.contentElement.controls[0];
  control.checked = true;
  await control.listeners.change({ target: control });

  assert.deepEqual(patchCalls.map(({ code, billingEnabled }) => ({ code, billingEnabled })), [
    { code: 'A.B-007', billingEnabled: true },
  ]);
  assert.match(container.statusElement.innerHTML, /Actividad fiscal actualizada/);
  assert.equal(container.contentElement.controls[0].checked, true);
  assert.doesNotMatch(container.contentElement.innerHTML, /Establecer como predeterminada|<select/i);
});

test('Wave 5 failed toggle preserves previous canonical state and allows retry', async () => {
  const patchCalls = [];
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings({ activities: [createSettings().activities[1]] })),
      updateActivityBillingEnabled: (session, code, billingEnabled) => {
        patchCalls.push({ code, billingEnabled });
        return Promise.reject(new Error('No se pudo actualizar la actividad fiscal.'));
      },
    },
  });

  const control = container.contentElement.controls[0];
  control.checked = true;
  await control.listeners.change({ target: control });

  assert.equal(patchCalls.length, 1);
  assert.equal(container.contentElement.controls[0].checked, false);
  assert.equal(container.contentElement.controls[0].disabled, false);
  assert.match(container.statusElement.innerHTML, /No se pudo actualizar/);
});

test('Wave 5 pending mutation prevents duplicate submission for the same row', async () => {
  const patchCalls = [];
  let resolvePatch;
  const patchPromise = new Promise((resolve) => { resolvePatch = resolve; });
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings({ activities: [createSettings().activities[1]] })),
      updateActivityBillingEnabled: (session, code, billingEnabled) => {
        patchCalls.push({ code, billingEnabled });
        return patchPromise;
      },
    },
  });

  const control = container.contentElement.controls[0];
  control.checked = true;
  const first = control.listeners.change({ target: control });
  await control.listeners.change({ target: control });

  assert.equal(patchCalls.length, 1);
  assert.equal(container.contentElement.controls[0].disabled, true);
  resolvePatch(createSettings({ activities: [{ ...createSettings().activities[1], billingEnabled: true }] }));
  await first;
  assert.equal(container.contentElement.controls[0].disabled, false);
});

test('Wave 5 disabling current default does not call default/refresh and renders canonical disabled default', async () => {
  const patchCalls = [];
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings({ activities: [createSettings().activities[0]] })),
      updateActivityBillingEnabled: (session, code, billingEnabled) => {
        patchCalls.push({ code, billingEnabled });
        return Promise.resolve(createSettings({
          defaultActivityCode: '9609.0',
          activities: [{ ...createSettings().activities[0], billingEnabled: false, isDefault: true }],
        }));
      },
    },
  });

  const control = container.contentElement.controls[0];
  control.checked = false;
  await control.listeners.change({ target: control });

  assert.deepEqual(patchCalls, [{ code: '9609.0', billingEnabled: false }]);
  assert.match(container.contentElement.innerHTML, /Predeterminada/);
  assert.match(container.contentElement.innerHTML, /Deshabilitada en Billing/);
  assert.match(container.contentElement.innerHTML, /Selecciona otra actividad habilitada/i);
  assert.doesNotMatch(container.contentElement.innerHTML, /PUT|activities\/default|Actualizar desde Hacienda|POST|activities\/refresh/);
  assert.doesNotMatch(container.contentElement.innerHTML, /Establecer como predeterminada|Seleccionar predeterminada|<select/i);
});

test('Wave 5 one enabled activity with null default does not auto-default or synthesize readiness', async () => {
  const container = await mountView({
    api: {
      getFiscalSettings: () => Promise.resolve(createSettings({
        defaultActivityCode: null,
        activities: [{ ...createSettings().activities[1], billingEnabled: true, isDefault: false }],
      })),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.match(container.contentElement.innerHTML, /Sin actividad predeterminada/);
  assert.doesNotMatch(container.contentElement.innerHTML, /<span class="badge badge-success">Predeterminada<\/span>/);
  assert.doesNotMatch(container.contentElement.innerHTML, /Listo para facturar|readyToIssue/i);
});
