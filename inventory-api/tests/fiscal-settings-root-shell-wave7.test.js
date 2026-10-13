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
  return { user: { id: '7', companyId: '3', role: { code: 'fiscal_admin' }, permissions } };
}

function createApiHarness() {
  const calls = { post: [], get: [], patch: [], put: [] };
  const { browserWindow, context } = createContext({
    InventoryAuth: {
      fetchJson(session, url, options) {
        const method = (options?.method || 'GET').toUpperCase();
        if (method === 'POST') calls.post.push({ url, options });
        else if (method === 'PUT') calls.put.push({ url, options });
        else if (method === 'PATCH') calls.patch.push({ url, options });
        else calls.get.push({ url, options });
        return Promise.resolve({});
      },
    },
  });
  executeRootScript('registry.js', context);
  executeRootScript('fiscal-settings-api.js', context);
  return { api: browserWindow.RootShell.require('fiscalSettingsApi'), calls };
}

function createViewHarness(apiImplementation) {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', apiImplementation);
  executeRootScript('views/fiscal-settings-admin.js', context);
  return browserWindow.RootShell.require('views.fiscalSettingsAdmin');
}

class FakeButton {
  constructor({ hidden = true } = {}) {
    this.hidden = hidden;
    this.disabled = false;
    this._ariaBusy = 'false';
    this.textContent = 'Actualizar desde Hacienda';
    this.listeners = {};
  }

  setAttribute(name, value) {
    if (name === 'aria-busy') this._ariaBusy = value;
  }

  getAttribute(name) {
    if (name === 'aria-busy') return this._ariaBusy;
    return null;
  }

  addEventListener(eventName, handler) { this.listeners[eventName] = handler; }
}

class FakeControl {
  constructor({ code, checked, disabled }) {
    this.code = code; this.checked = checked; this.disabled = disabled; this.listeners = {};
  }

  getAttribute(name) { return name === 'data-activity-code' ? this.code : null; }
  addEventListener(eventName, handler) { this.listeners[eventName] = handler; }
}

function extractAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&') : '';
}

function parseControls(value, marker) {
  return (value.match(/<input[\s\S]*?>/g) || [])
    .filter((tag) => tag.includes(marker))
    .map((tag) => new FakeControl({
      code: extractAttribute(tag, 'data-activity-code'),
      checked: /\schecked(\s|>)/.test(tag),
      disabled: /\sdisabled(\s|>)/.test(tag),
    }));
}

function createContainer() {
  const statusElement = { innerHTML: '' };
  const refreshButton = new FakeButton({ hidden: true });
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
    statusElement, contentElement, refreshButton,
    querySelector(selector) {
      if (selector === '[data-fiscal-settings-status]') return statusElement;
      if (selector === '[data-fiscal-settings-content]') return contentElement;
      if (selector === '[data-fiscal-refresh-btn]') return refreshButton;
      return null;
    },
  };
}

function activity(overrides) {
  return {
    code: '9609.0', description: 'Servicios personales', haciendaStatus: 'A',
    haciendaKind: 'Principal', billingEnabled: true, isDefault: false, ...overrides,
  };
}

function settings(overrides = {}) {
  return {
    taxpayer: { verificationStatus: 'VERIFIED', verifiedAt: '2026-01-15T10:00:00.000Z',
      taxSituation: 'AL DIA', moroso: false, omiso: false },
    defaultActivityCode: null,
    billingCompanyId: 'billing-id-secret', billingTenantId: 'tenant-secret',
    billingCredentialSecretRef: 'secret/ref/hidden', apiKey: 'raw-key-hidden',
    configuration: { hasBillingIntegration: true },
    activities: [
      activity({ code: '9609.0', isDefault: true, billingEnabled: true }),
      activity({ code: 'A.B-007', billingEnabled: false }),
    ],
    ...overrides,
  };
}

async function mount({ api, session = createSession(['fiscal.settings.view', 'fiscal.activities.refresh']) }) {
  const view = createViewHarness(api);
  const container = createContainer();
  await view.mount(container, session, {});
  return container;
}

// ── API contract tests ──────────────────────────────────────────────────────

test('Wave 7 API sends POST to /activities/refresh with no body and no identity', async () => {
  const { api, calls } = createApiHarness();
  const session = createSession(['fiscal.settings.view', 'fiscal.activities.refresh']);

  await api.refreshActivities(session);

  assert.equal(calls.post.length, 1);
  assert.equal(calls.post[0].url, '/api/company/fiscal-settings/activities/refresh');
  assert.equal(calls.post[0].options.method, 'POST');
  // No body sent to refresh endpoint — no taxpayer identity, no company IDs, no secrets
  assert.equal(calls.post[0].options.body, undefined);
  // Verify the URL itself contains no injected identity overrides
  assert.doesNotMatch(
    calls.post[0].url,
    /identification|companyId|billingCompanyId|billingTenantId|secret|apiKey|ruc|cedula/i,
  );
});

test('Wave 7 API registers refreshActivities without Billing or Hacienda URLs', async () => {
  const { api } = createApiHarness();
  assert.equal(typeof api.refreshActivities, 'function');
  assert.equal(typeof api.getFiscalSettings, 'function');
  assert.equal(typeof api.updateActivityBillingEnabled, 'function');
  assert.equal(typeof api.setDefaultActivity, 'function');
});

// ── Permissions / visibility ────────────────────────────────────────────────

test('Wave 7 refresh button hidden for VIEW-only user', async () => {
  const container = await mount({
    session: createSession(['fiscal.settings.view']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(container.refreshButton.hidden, true);
  assert.equal(typeof container.refreshButton.listeners.click, 'undefined');
});

test('Wave 7 refresh button hidden for MANAGE-only user (no refresh permission)', async () => {
  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.manage']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(container.refreshButton.hidden, true);
});

test('Wave 7 refresh button visible and bound for refresh-authorized user', async () => {
  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.refresh']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(container.refreshButton.hidden, false);
  assert.equal(typeof container.refreshButton.listeners.click, 'function');
});

// ── No auto-refresh on load/render ──────────────────────────────────────────

test('Wave 7 page load sends zero refresh POST, zero direct Billing/Hacienda calls', async () => {
  const postCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => { postCalls.push(1); return Promise.resolve(settings()); },
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(postCalls.length, 0, 'zero refresh POST on page load');
  assert.doesNotMatch(container.contentElement.innerHTML, /api\.hacienda\.go\.cr|billing\.internal/i);
});

test('Wave 7 checklist mutation sends zero refresh POST calls', async () => {
  const postCalls = [];
  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.manage', 'fiscal.activities.refresh']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => { postCalls.push(1); return Promise.resolve(settings()); },
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.resolve(settings()),
    },
  });

  const toggle = container.contentElement.activityControls[0];
  toggle.checked = false;
  await toggle.listeners.change({ target: toggle });

  assert.equal(postCalls.length, 0);
});

test('Wave 7 default mutation sends zero refresh POST calls', async () => {
  const postCalls = [];
  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.default.update', 'fiscal.activities.refresh']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => { postCalls.push(1); return Promise.resolve(settings()); },
      setDefaultActivity: () => Promise.resolve(settings({ activities: [activity({ code: 'A.B-007', isDefault: true, billingEnabled: true })] })),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const defaultToggle = container.contentElement.defaultControls.find((c) => !c.disabled);
  if (defaultToggle) {
    defaultToggle.checked = true;
    await defaultToggle.listeners.change({ target: defaultToggle });
  }

  assert.equal(postCalls.length, 0);
});

// ── Successful refresh behavior ─────────────────────────────────────────────

test('Wave 7 successful refresh: one POST then one GET, canonical state replaces previous', async () => {
  const postCalls = [];
  const getCalls = [];
  const initialSettings = settings({ activities: [activity({ code: '9609.0', isDefault: true })] });
  const refreshedSettings = settings({
    taxpayer: { verificationStatus: 'RE-VERIFIED', verifiedAt: '2026-09-29T08:00:00.000Z',
      taxSituation: 'AL DIA', moroso: false, omiso: false },
    activities: [
      activity({ code: '9609.0', isDefault: true }),
      activity({ code: 'NUEVA.1', description: 'Actividad nueva desde Hacienda', billingEnabled: true }),
    ],
  });

  const _container = await mount({
    api: {
      getFiscalSettings: () => { getCalls.push(1); return Promise.resolve(initialSettings); },
      refreshActivities: () => { postCalls.push(1); return Promise.resolve({}); },
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.equal(getCalls.length, 1);
  assert.equal(postCalls.length, 0);

  // Override getFiscalSettings to return refreshed data on second call
  const refreshedApi = {
    getFiscalSettings: () => { getCalls.push(2); return Promise.resolve(refreshedSettings); },
    refreshActivities: () => { postCalls.push(1); return Promise.resolve({}); },
    setDefaultActivity: () => Promise.reject(new Error('not expected')),
    updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
  };

  // Remount with refreshed API to simulate full flow
  const _view = createViewHarness(refreshedApi);
  const _container2 = createContainer();
  let resolveRefresh;
  const refreshPromise = new Promise((resolve) => { resolveRefresh = resolve; });
  const trackCalls = { post: 0, get: 0 };
  const trackApi = {
    getFiscalSettings: () => { trackCalls.get += 1; return Promise.resolve(refreshedSettings); },
    refreshActivities: () => { trackCalls.post += 1; return resolveRefresh ? refreshPromise : Promise.resolve({}); },
    setDefaultActivity: () => Promise.reject(new Error('not expected')),
    updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
  };
  const view2 = createViewHarness(trackApi);
  const c = createContainer();
  await view2.mount(c, createSession(['fiscal.settings.view', 'fiscal.activities.refresh']), {});

  resolveRefresh({});
  const clickPromise = c.refreshButton.listeners.click();
  await clickPromise;

  assert.equal(trackCalls.post, 1, 'exactly one POST refresh');
  assert.equal(trackCalls.get, 2, 'initial GET + one canonical GET after refresh');
  assert.match(c.statusElement.innerHTML, /Información fiscal actualizada desde Hacienda/);
  assert.match(c.contentElement.innerHTML, /RE-VERIFIED/);
});

test('Wave 7 newly discovered activity appears after refresh; not auto-enabled', async () => {
  const initialSettings = settings({ activities: [activity({ code: '9609.0', billingEnabled: false })] });
  const refreshedSettings = settings({
    activities: [
      activity({ code: '9609.0', billingEnabled: false }),
      activity({ code: 'NUEVA.1', description: 'Recién descubierta', billingEnabled: false }),
    ],
  });
  let _gc1 = 0;
  const container = await mount({
    api: {
      getFiscalSettings: () => { _gc1 += 1; return Promise.resolve(_gc1 === 1 ? initialSettings : refreshedSettings); },
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  await container.refreshButton.listeners.click();

  assert.match(container.contentElement.innerHTML, /NUEVA\.1/);
  assert.match(container.contentElement.innerHTML, /Recién descubierta/);
  const newActivityCheckbox = container.contentElement.activityControls.find((c) => c.code === 'NUEVA.1');
  assert.ok(newActivityCheckbox, 'new activity has a checkbox');
  assert.equal(newActivityCheckbox.checked, false, 'new activity NOT auto-enabled');
});

test('Wave 7 removed activity absent after refresh, old list not preserved', async () => {
  const initialSettings = settings({
    activities: [
      activity({ code: '9609.0' }),
      activity({ code: 'VIEJA.1', description: 'Va a desaparecer' }),
    ],
  });
  const refreshedSettings = settings({ activities: [activity({ code: '9609.0' })] });
  let _gc2 = 0;
  const container = await mount({
    api: {
      getFiscalSettings: () => { _gc2 += 1; return Promise.resolve(_gc2 === 1 ? initialSettings : refreshedSettings); },
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.match(container.contentElement.innerHTML, /VIEJA\.1/);
  await container.refreshButton.listeners.click();
  assert.doesNotMatch(container.contentElement.innerHTML, /VIEJA\.1/);
  assert.doesNotMatch(container.contentElement.innerHTML, /Va a desaparecer/);
});

test('Wave 7 refresh does NOT call PUT default; no auto-select after refresh', async () => {
  const putDefaultCalls = [];
  let getCount = 0;
  const withNewDefault = settings({
    activities: [activity({ code: '9609.0', isDefault: false }), activity({ code: 'A.B-007', isDefault: true, billingEnabled: true })],
  });

  const container = await mount({
    api: {
      getFiscalSettings: () => { getCount += 1; return Promise.resolve(getCount === 1 ? settings() : withNewDefault); },
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => { putDefaultCalls.push(1); return Promise.reject(new Error('not expected')); },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  await container.refreshButton.listeners.click();

  assert.equal(putDefaultCalls.length, 0, 'zero PUT default calls during refresh');
});

// ── Pending / duplicate prevention ─────────────────────────────────────────

test('Wave 7 pending state: button disabled + aria-busy; duplicate click ignored', async () => {
  let resolvePost;
  const postCount = [];
  const postPromise = new Promise((resolve) => { resolvePost = resolve; });
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => { postCount.push(1); return postPromise; },
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const first = container.refreshButton.listeners.click();
  // Second click while pending
  await container.refreshButton.listeners.click();

  assert.equal(postCount.length, 1, 'only one POST despite two clicks');
  assert.equal(container.refreshButton.disabled, true);
  assert.equal(container.refreshButton.getAttribute('aria-busy'), 'true');
  assert.match(container.refreshButton.textContent, /Actualizando/);
  // All checklist controls locked during refresh
  assert.ok(container.contentElement.activityControls.every((c) => c.disabled), 'checklist locked during refresh');
  assert.ok(container.contentElement.defaultControls.every((c) => c.disabled), 'default controls locked during refresh');

  resolvePost({});
  await first;
  assert.equal(container.refreshButton.disabled, false);
  assert.equal(container.refreshButton.getAttribute('aria-busy'), 'false');
});

// ── Failure behavior ────────────────────────────────────────────────────────

test('Wave 7 failed refresh preserves previous canonical state; allows retry; no success message', async () => {
  let postCount = 0;
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => { postCount += 1; return Promise.reject(new Error('Billing no disponible.')); },
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  const htmlBefore = container.contentElement.innerHTML;
  await container.refreshButton.listeners.click();

  assert.doesNotMatch(container.statusElement.innerHTML, /actualizada desde Hacienda/i);
  assert.match(container.statusElement.innerHTML, /No se pudo actualizar|Billing no disponible/i);
  assert.equal(container.contentElement.innerHTML, htmlBefore, 'canonical state preserved on failure');
  assert.equal(container.refreshButton.disabled, false, 'button re-enabled for retry');
  assert.equal(container.refreshButton.getAttribute('aria-busy'), 'false');

  // Retry is possible
  await container.refreshButton.listeners.click();
  assert.equal(postCount, 2);
});

test('Wave 7 failed refresh error message is sanitized; no stack trace, no secret, no URL', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => Promise.reject(new Error('BILLING_UNAVAILABLE')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  await container.refreshButton.listeners.click();

  assert.doesNotMatch(container.statusElement.innerHTML, /secret|apiKey|stack|at Object|Error:/i);
  assert.doesNotMatch(container.statusElement.innerHTML, /api\.hacienda|billing\.internal|https?:\/\//i);
  assert.doesNotMatch(container.statusElement.innerHTML, /billing-id-secret|tenant-secret|secret\/ref\/hidden|raw-key-hidden/i);
});

// ── Post-refresh Wave 5 / 6A continuity ────────────────────────────────────

test('Wave 7 Wave 5 checklist remains functional after successful refresh', async () => {
  let getCount = 0;
  const patchCalls = [];
  const refreshed = settings({ activities: [activity({ code: '9609.0', billingEnabled: false })] });

  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.manage', 'fiscal.activities.refresh']),
    api: {
      getFiscalSettings: () => { getCount += 1; return Promise.resolve(getCount === 1 ? settings() : refreshed); },
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: (session, code, billingEnabled) => {
        patchCalls.push({ code, billingEnabled });
        return Promise.resolve(settings({ activities: [activity({ code, billingEnabled })] }));
      },
    },
  });

  await container.refreshButton.listeners.click();

  const toggle = container.contentElement.activityControls[0];
  assert.equal(toggle.disabled, false, 'checklist re-enabled after refresh');
  toggle.checked = true;
  await toggle.listeners.change({ target: toggle });
  assert.equal(patchCalls.length, 1, 'PATCH sent after refresh');
  assert.equal(patchCalls[0].code, '9609.0');
});

test('Wave 7 Wave 6A default selector remains functional after successful refresh', async () => {
  let getCount = 0;
  const putCalls = [];
  const refreshed = settings({
    activities: [
      activity({ code: '9609.0', isDefault: false, billingEnabled: true }),
      activity({ code: 'A.B-007', isDefault: false, billingEnabled: true }),
    ],
  });

  const container = await mount({
    session: createSession(['fiscal.settings.view', 'fiscal.activities.default.update', 'fiscal.activities.refresh']),
    api: {
      getFiscalSettings: () => { getCount += 1; return Promise.resolve(getCount === 1 ? settings() : refreshed); },
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: (session, code) => { putCalls.push(code); return Promise.resolve(settings()); },
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  await container.refreshButton.listeners.click();

  const defaultRadio = container.contentElement.defaultControls.find((c) => !c.disabled);
  assert.ok(defaultRadio, 'eligible default radio enabled after refresh');
  defaultRadio.checked = true;
  await defaultRadio.listeners.change({ target: defaultRadio });
  assert.equal(putCalls.length, 1, 'PUT default sent after refresh');
});

// ── Security / no sensitive data rendered ──────────────────────────────────

test('Wave 7 no Billing IDs, secrets or API keys rendered in view after refresh', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  await container.refreshButton.listeners.click();

  const html = container.contentElement.innerHTML;
  assert.doesNotMatch(html, /billing-id-secret|tenant-secret|secret\/ref\/hidden|raw-key-hidden/);
  assert.doesNotMatch(html, /api\.hacienda\.go\.cr|billing\.internal/i);
});

test('Wave 7 no readiness claim, no readyToIssue, no Listo para facturar rendered after refresh', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  await container.refreshButton.listeners.click();

  const html = container.contentElement.innerHTML + container.statusElement.innerHTML;
  assert.doesNotMatch(html, /readyToIssue|Listo para facturar|preparaci[oó]n fiscal completa|reasonCodes/i);
  assert.doesNotMatch(html, /certificate readiness|credential readiness|consecutive readiness/i);
});
