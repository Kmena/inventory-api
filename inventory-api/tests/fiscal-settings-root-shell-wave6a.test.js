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

function createSession(permissions) {
  return { user: { id: '42', companyId: '7', role: { code: 'fiscal_admin' }, permissions } };
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

function parseControls(value, marker) {
  const inputTags = (value.match(/<input[\s\S]*?>/g) || []).filter((tag) => tag.includes(marker));
  return inputTags.map((tag) => new FakeControl({
    code: extractAttribute(tag, 'data-activity-code'),
    checked: /\schecked(\s|>)/.test(tag),
    disabled: /\sdisabled(\s|>)/.test(tag),
  }));
}

function createContainer() {
  const statusElement = { innerHTML: '' };
  const contentElement = {
    _innerHTML: '',
    activityControls: [],
    defaultControls: [],
    get innerHTML() { return this._innerHTML; },
    set innerHTML(value) {
      this._innerHTML = value;
      this.activityControls = parseControls(value, 'data-fiscal-activity-toggle');
      this.defaultControls = parseControls(value, 'data-fiscal-default-toggle');
    },
    querySelectorAll(selector) {
      if (selector === '[data-fiscal-activity-toggle]') return this.activityControls;
      if (selector === '[data-fiscal-default-toggle]') return this.defaultControls;
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

function activity(overrides) {
  return {
    code: '9609.0',
    description: 'Servicios personales',
    haciendaStatus: 'A',
    haciendaKind: 'Principal',
    billingEnabled: true,
    isDefault: false,
    ...overrides,
  };
}

function settings(overrides = {}) {
  return {
    taxpayer: {
      verificationStatus: 'VERIFIED',
      verifiedAt: '2026-01-15T10:00:00.000Z',
      taxSituation: 'AL DIA',
      moroso: false,
      omiso: false,
    },
    defaultActivityCode: '9609.0',
    billingCompanyId: 'billing-id-nope',
    billingTenantId: 'tenant-nope',
    billingCredentialSecretRef: 'secret-nope',
    apiKey: 'api-key-nope',
    configuration: { hasBillingIntegration: true },
    activities: [
      activity({ code: '9609.0', isDefault: true, description: '<Actual & default>' }),
      activity({ code: 'A.B-007', description: 'Nueva default elegible' }),
      activity({ code: 'DISABLED.1', description: 'Deshabilitada', billingEnabled: false }),
      activity({ code: 'INACTIVE.1', description: 'Inactiva', haciendaStatus: 'I' }),
    ],
    ...overrides,
  };
}

async function mount({ api, session = createSession(['fiscal.settings.view', 'fiscal.activities.default.update']) }) {
  const view = createViewHarness(api);
  const container = createContainer();
  await view.mount(container, session, {});
  return container;
}

test('Wave 6A API sends exact Inventori PUT default body only', async () => {
  const { api, fetchCalls } = createApiHarness();
  const session = createSession(['fiscal.settings.view', 'fiscal.activities.default.update']);

  await api.setDefaultActivity(session, '9609.0');

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, '/api/company/fiscal-settings/activities/default');
  assert.equal(fetchCalls[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { code: '9609.0' });
  assert.doesNotMatch(fetchCalls[0].options.body, /companyId|billingCompanyId|billingTenantId|secret|apiKey/i);
});

test('Wave 6A renders current default and eligibility without exposing secrets or readiness', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const html = container.contentElement.innerHTML;
  assert.match(html, /Predeterminada/);
  assert.match(html, /9609\.0/);
  assert.match(html, /A\.B-007/);
  assert.doesNotMatch(html, /96090|960900/);
  assert.match(html, /&lt;Actual &amp; default&gt;/);
  assert.equal(container.contentElement.defaultControls.length, 4);
  assert.equal(container.contentElement.defaultControls[0].checked, true);
  assert.equal(container.contentElement.defaultControls[1].disabled, false);
  assert.equal(container.contentElement.defaultControls[2].disabled, true);
  assert.equal(container.contentElement.defaultControls[3].disabled, true);
  assert.doesNotMatch(html, /type="text"|Agregar actividad|Crear actividad/i);
  assert.doesNotMatch(html, /billing-id-nope|tenant-nope|secret-nope|api-key-nope/);
  assert.doesNotMatch(html, /readyToIssue|Listo para facturar|preparaci[oó]n fiscal completa|reasonCodes/i);
});

test('Wave 6A view-only and manage-only users cannot change default', async () => {
  for (const permissions of [['fiscal.settings.view'], ['fiscal.settings.view', 'fiscal.activities.manage']]) {
    const container = await mount({
      session: createSession(permissions),
      api: {
        getFiscalSettings: () => Promise.resolve(settings()),
        setDefaultActivity: () => Promise.reject(new Error('not expected')),
        updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
      },
    });
    assert.match(container.contentElement.innerHTML, /puede ver la predeterminada, pero no cambiarla/);
    assert.equal(container.contentElement.defaultControls.every((control) => control.disabled), true);
  }
});

test('Wave 6A successful explicit default selection sends one PUT and consumes canonical response', async () => {
  const putCalls = [];
  const canonical = settings({
    defaultActivityCode: 'A.B-007',
    activities: [
      activity({ code: '9609.0', isDefault: false }),
      activity({ code: 'A.B-007', isDefault: true, description: 'Nueva default elegible' }),
    ],
  });
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings({ activities: settings().activities.slice(0, 2) })),
      setDefaultActivity: (session, code) => {
        putCalls.push({ session, code });
        return Promise.resolve(canonical);
      },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const newDefault = container.contentElement.defaultControls[1];
  newDefault.checked = true;
  await newDefault.listeners.change({ target: newDefault });

  assert.deepEqual(putCalls.map(({ code }) => code), ['A.B-007']);
  assert.match(container.statusElement.innerHTML, /Actividad predeterminada actualizada/);
  assert.equal(container.contentElement.defaultControls[0].checked, false);
  assert.equal(container.contentElement.defaultControls[1].checked, true);
});

test('Wave 6A failed default PUT preserves previous canonical default and allows retry', async () => {
  const putCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings({ activities: settings().activities.slice(0, 2) })),
      setDefaultActivity: (session, code) => {
        putCalls.push({ code });
        return Promise.reject(new Error('No se pudo actualizar la actividad predeterminada.'));
      },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const newDefault = container.contentElement.defaultControls[1];
  newDefault.checked = true;
  await newDefault.listeners.change({ target: newDefault });

  assert.equal(putCalls.length, 1);
  assert.equal(container.contentElement.defaultControls[0].checked, true);
  assert.equal(container.contentElement.defaultControls[1].checked, false);
  assert.equal(container.contentElement.defaultControls[1].disabled, false);
  assert.match(container.statusElement.innerHTML, /No se pudo actualizar/);
});

test('Wave 6A pending default mutation prevents duplicate PUT', async () => {
  const putCalls = [];
  let resolvePut;
  const putPromise = new Promise((resolve) => { resolvePut = resolve; });
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings({ activities: settings().activities.slice(0, 2) })),
      setDefaultActivity: (session, code) => {
        putCalls.push({ code });
        return putPromise;
      },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const newDefault = container.contentElement.defaultControls[1];
  newDefault.checked = true;
  const first = newDefault.listeners.change({ target: newDefault });
  await newDefault.listeners.change({ target: newDefault });

  assert.equal(putCalls.length, 1);
  assert.equal(container.contentElement.defaultControls.every((control) => control.disabled), true);
  resolvePut(settings({ activities: [activity({ code: '9609.0' }), activity({ code: 'A.B-007', isDefault: true })] }));
  await first;
});

test('Wave 6A disabled current default requires explicit remediation and never auto-mutates', async () => {
  const calls = { put: 0, patch: 0 };
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings({
        activities: [
          activity({ code: '9609.0', isDefault: true, billingEnabled: false }),
          activity({ code: 'A.B-007', isDefault: false, billingEnabled: true }),
        ],
      })),
      setDefaultActivity: () => { calls.put += 1; return Promise.reject(new Error('not expected')); },
      updateActivityBillingEnabled: () => { calls.patch += 1; return Promise.reject(new Error('not expected')); },
    },
  });

  assert.equal(calls.put, 0);
  assert.equal(calls.patch, 0);
  assert.equal(container.contentElement.defaultControls[0].checked, true);
  assert.equal(container.contentElement.defaultControls[0].disabled, true);
  assert.equal(container.contentElement.defaultControls[1].disabled, false);
  assert.match(container.contentElement.innerHTML, /Selecciona otra actividad habilitada/);
});

test('Wave 6A one eligible activity and null default does not auto-select', async () => {
  let putCalls = 0;
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings({
        defaultActivityCode: null,
        activities: [activity({ code: 'A.B-007', isDefault: false, billingEnabled: true })],
      })),
      setDefaultActivity: () => { putCalls += 1; return Promise.reject(new Error('not expected')); },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.equal(putCalls, 0);
  assert.equal(container.contentElement.defaultControls.length, 1);
  assert.equal(container.contentElement.defaultControls[0].checked, false);
  assert.match(container.contentElement.innerHTML, /Sin actividad predeterminada/);
});

test('Wave 6A zero eligible activities renders safe state and no default PUT on render', async () => {
  let putCalls = 0;
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings({
        defaultActivityCode: null,
        activities: [
          activity({ code: 'DISABLED.1', billingEnabled: false }),
          activity({ code: 'INACTIVE.1', haciendaStatus: 'I' }),
        ],
      })),
      setDefaultActivity: () => { putCalls += 1; return Promise.reject(new Error('not expected')); },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.equal(putCalls, 0);
  assert.match(container.contentElement.innerHTML, /No hay actividades habilitadas disponibles/);
  assert.equal(container.contentElement.defaultControls.every((control) => control.disabled), true);
});

test('Wave 6A disabling current default through Wave 5 checkbox does not trigger PUT default', async () => {
  const calls = { put: 0, patch: 0 };
  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.manage', 'fiscal.activities.default.update']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings({ activities: [settings().activities[0], settings().activities[1]] })),
      setDefaultActivity: () => { calls.put += 1; return Promise.reject(new Error('not expected')); },
      updateActivityBillingEnabled: (session, code, billingEnabled) => {
        calls.patch += 1;
        return Promise.resolve(settings({
          activities: [activity({ code, isDefault: true, billingEnabled }), settings().activities[1]],
        }));
      },
    },
  });

  const currentDefaultCheckbox = container.contentElement.activityControls[0];
  currentDefaultCheckbox.checked = false;
  await currentDefaultCheckbox.listeners.change({ target: currentDefaultCheckbox });

  assert.equal(calls.patch, 1);
  assert.equal(calls.put, 0);
  assert.match(container.contentElement.innerHTML, /Selecciona otra actividad habilitada/);
});
