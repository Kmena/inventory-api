'use strict';

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
    this.hidden = hidden; this.disabled = false; this._ariaBusy = 'false';
    this.textContent = ''; this.listeners = {};
  }
  setAttribute(name, value) { if (name === 'aria-busy') this._ariaBusy = value; }
  getAttribute(name) { return name === 'aria-busy' ? this._ariaBusy : null; }
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
  const retryReadinessButton = new FakeButton({ hidden: true });
  const readinessElement = { innerHTML: '' };
  const contentElement = {
    _innerHTML: '', activityControls: [], defaultControls: [],
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
    statusElement, contentElement, refreshButton, retryReadinessButton, readinessElement,
    querySelector(selector) {
      if (selector === '[data-fiscal-settings-status]') return statusElement;
      if (selector === '[data-fiscal-settings-content]') return contentElement;
      if (selector === '[data-fiscal-refresh-btn]') return refreshButton;
      if (selector === '[data-fiscal-readiness-content]') return readinessElement;
      if (selector === '[data-fiscal-readiness-retry-btn]') return retryReadinessButton;
      return null;
    },
  };
}

function activity(overrides = {}) {
  return {
    code: '9609.0', description: 'Servicios personales', haciendaStatus: 'A',
    haciendaKind: 'Principal', billingEnabled: true, isDefault: false, ...overrides,
  };
}

function settings(overrides = {}) {
  return {
    taxpayer: { verificationStatus: 'VERIFIED', verifiedAt: '2026-01-15T10:00:00.000Z', taxSituation: 'AL DIA', moroso: false, omiso: false },
    defaultActivityCode: null,
    activities: [activity({ code: '9609.0', isDefault: true, billingEnabled: true })],
    configuration: { hasBillingIntegration: true },
    ...overrides,
  };
}

function readiness(overrides = {}) {
  return {
    environment: 'SANDBOX',
    readyToIssue: true,
    reasonCodes: [],
    warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

const FULL_PERMISSIONS = ['fiscal.settings.view', 'fiscal.activities.refresh', 'fiscal.activities.manage', 'fiscal.activities.default.update', 'fiscal.readiness.view'];

async function mount({ api, session = createSession(FULL_PERMISSIONS) }) {
  const view = createViewHarness(api);
  const container = createContainer();
  await view.mount(container, session, {});
  return container;
}

// ── Test 34: initial load performs readiness GET ─────────────────────────────

test('Wave 6B initial page load performs readiness GET', async () => {
  const readinessCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness()); },
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(readinessCalls.length, 1, 'exactly one readiness GET on initial load');
  assert.ok(container.readinessElement.innerHTML.length > 0, 'readiness element populated');
});

// ── Test 35: initial load performs zero refresh POST ─────────────────────────

test('Wave 6B initial page load performs zero refresh POST', async () => {
  const refreshCalls = [];
  await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness()),
      refreshActivities: () => { refreshCalls.push(1); return Promise.resolve({}); },
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(refreshCalls.length, 0, 'zero refresh POST on initial load');
});

test('post-deployment UI ends readiness loading when fiscal.readiness.view is absent', async () => {
  let readinessCalls = 0;
  const container = await mount({
    session: createSession(['fiscal.settings.view']),
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls += 1; return Promise.resolve(readiness()); },
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });

  assert.equal(readinessCalls, 0);
  assert.match(container.readinessElement.innerHTML, /Permiso de consulta requerido/);
  assert.match(container.readinessElement.innerHTML, /fiscal\.readiness\.view/);
  assert.doesNotMatch(container.readinessElement.innerHTML, /Comprobando preparación fiscal/);
});

// ── Test 36: readyToIssue=true renders READY ────────────────────────────────

test('Wave 6B readyToIssue=true renders "Listo para facturar electrónicamente"', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true, reasonCodes: [], warnings: [] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /Listo para facturar electr/);
});

// ── Test 37: readyToIssue=false renders NOT READY ────────────────────────────

test('Wave 6B readyToIssue=false renders "Configuración fiscal incompleta"', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false, reasonCodes: ['FISCAL_PROFILE_MISSING'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /Configuraci.n fiscal incompleta/);
});

// ── Test 38: blockers render safe Spanish presentation messages ───────────────

test('Wave 6B blockers render safe Spanish presentation messages', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false, reasonCodes: ['ACTIVE_CERTIFICATE_MISSING', 'ISSUANCE_POINT_MISSING'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /certificado de firma activo/);
  assert.match(container.readinessElement.innerHTML, /punto de emisi/);
});

// ── Test 39: warnings render separately ──────────────────────────────────────

test('Wave 6B warnings render in a separate element from blockers', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false, reasonCodes: ['FISCAL_PROFILE_MISSING'], warnings: ['TAXPAYER_MOROSO'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /moroso/);
  assert.match(container.readinessElement.innerHTML, /perfil fiscal/);
  // Both appear but warnings section label is separate from blockers section label
  assert.match(container.readinessElement.innerHTML, /Advertencias/);
  assert.match(container.readinessElement.innerHTML, /Problemas de configuraci/);
});

// ── Test 40: warnings do not change ready state ───────────────────────────────

test('Wave 6B warnings do not change readyToIssue (Billing verdict is authoritative)', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true, reasonCodes: [], warnings: ['TAXPAYER_MOROSO'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /Listo para facturar electr/);
  assert.doesNotMatch(container.readinessElement.innerHTML, /Configuraci.n fiscal incompleta/);
});

// ── Test 41: ready=true + warning still renders READY ────────────────────────

test('Wave 6B readyToIssue=true with warning still renders READY verdict and warning separately', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true, reasonCodes: [], warnings: ['TAXPAYER_OMISO'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /Listo para facturar electr/);
  assert.match(container.readinessElement.innerHTML, /omiso/);
});

// ── Test 42: unknown reasonCode does not crash ────────────────────────────────

test('Wave 6B unknown reasonCode does not crash the view', async () => {
  let threw = false;
  try {
    await mount({
      api: {
        getFiscalSettings: () => Promise.resolve(settings()),
        getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false, reasonCodes: ['FUTURE_UNKNOWN_CODE_XYZ'] })),
        refreshActivities: () => Promise.reject(new Error('not expected')),
        setDefaultActivity: () => Promise.reject(new Error('not expected')),
        updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
      },
    });
  } catch (_e) {
    threw = true;
  }
  assert.equal(threw, false);
});

// ── Test 43: unknown reasonCode renders generic pending-configuration message ─

test('Wave 6B unknown reasonCode renders generic fallback message', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false, reasonCodes: ['FUTURE_UNKNOWN_CODE_XYZ'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /configuraci.n fiscal pendiente/i);
});

// ── Test 44: readiness request failure does not render READY ─────────────────

test('Wave 6B readiness request failure does not render READY', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.reject(new Error('Billing unavailable')),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.doesNotMatch(container.readinessElement.innerHTML, /Listo para facturar electr/);
});

// ── Test 45: readiness request failure does not render NOT READY ──────────────

test('Wave 6B readiness request failure does not render "Configuración fiscal incompleta"', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.reject(new Error('Billing unavailable')),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.doesNotMatch(container.readinessElement.innerHTML, /Configuraci.n fiscal incompleta/);
});

// ── Test 46: readiness unavailable state renders correctly ───────────────────

test('Wave 6B readiness unavailable renders "No fue posible comprobar el estado de preparación fiscal"', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.reject(new Error('Billing unavailable')),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /No fue posible comprobar el estado de preparaci/);
});

// ── Test 47: checkedAt renders safely ────────────────────────────────────────

test('Wave 6B checkedAt is rendered in the readiness section', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ checkedAt: '2026-09-29T10:00:00.000Z' })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /ltima comprobaci/);
});

// ── Test 48: loading state renders correctly ─────────────────────────────────

test('Wave 6B loading state renders "Comprobando preparación fiscal" while readiness is pending', async () => {
  let resolveReadiness;
  const readinessPromise = new Promise((resolve) => { resolveReadiness = resolve; });
  const view = createViewHarness({
    getFiscalSettings: () => Promise.resolve(settings()),
    getFiscalReadiness: () => readinessPromise,
    refreshActivities: () => Promise.reject(new Error('not expected')),
    setDefaultActivity: () => Promise.reject(new Error('not expected')),
    updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
  });
  const container = createContainer();
  const mountPromise = view.mount(container, createSession(FULL_PERMISSIONS), {});
  // Yield microtasks so getFiscalSettings resolves and loadReadiness starts
  await new Promise((r) => { setTimeout(r, 0); });
  assert.match(container.readinessElement.innerHTML, /Comprobando preparaci/);
  // Finish readiness
  resolveReadiness(readiness());
  await mountPromise;
});

// ── Test 49: successful Wave 7 refresh triggers readiness reload ──────────────

test('Wave 6B successful Wave 7 refresh triggers readiness reload (2 readiness GETs total)', async () => {
  const readinessCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness()); },
      refreshActivities: () => Promise.resolve({}),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.equal(readinessCalls.length, 1, 'one readiness call on load');
  await container.refreshButton.listeners.click();
  assert.equal(readinessCalls.length, 2, 'one more readiness call after refresh');
});

// ── Test 50: failed Wave 7 refresh does not synthesize readiness ──────────────

test('Wave 6B failed Wave 7 refresh does not synthesize new readiness verdict', async () => {
  const readinessCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness({ readyToIssue: true })); },
      refreshActivities: () => Promise.reject(new Error('Hacienda unavailable')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  const callsAfterLoad = readinessCalls.length;
  await container.refreshButton.listeners.click();
  assert.equal(readinessCalls.length, callsAfterLoad, 'failed refresh must not trigger readiness reload');
  assert.match(container.readinessElement.innerHTML, /Listo para facturar electr/);
});

// ── Test 51: successful Wave 5 mutation triggers readiness reload ─────────────

test('Wave 6B successful Wave 5 activity toggle triggers readiness reload', async () => {
  const readinessCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness()); },
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.resolve(settings()),
    },
  });
  assert.equal(readinessCalls.length, 1);
  const toggle = container.contentElement.activityControls[0];
  toggle.checked = false;
  await toggle.listeners.change({ target: toggle });
  assert.equal(readinessCalls.length, 2, 'readiness reloaded after activity mutation');
});

// ── Test 52: failed Wave 5 mutation preserves readiness state ─────────────────

test('Wave 6B failed Wave 5 mutation preserves readiness state (no extra readiness call)', async () => {
  const readinessCalls = [];
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness({ readyToIssue: true })); },
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('update failed')),
    },
  });
  const callsAfterLoad = readinessCalls.length;
  const toggle = container.contentElement.activityControls[0];
  toggle.checked = false;
  await toggle.listeners.change({ target: toggle });
  assert.equal(readinessCalls.length, callsAfterLoad, 'failed mutation must not trigger readiness reload');
});

// ── Test 53: successful Wave 6A default mutation triggers readiness reload ────

test('Wave 6B successful Wave 6A default change triggers readiness reload', async () => {
  const readinessCalls = [];
  const session = createSession([...FULL_PERMISSIONS, 'fiscal.activities.default.update']);
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness()); },
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.resolve(settings()),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
    session,
  });
  assert.equal(readinessCalls.length, 1);
  const defaultToggle = container.contentElement.defaultControls.find((c) => !c.disabled);
  if (defaultToggle) {
    defaultToggle.checked = true;
    await defaultToggle.listeners.change({ target: defaultToggle });
    assert.equal(readinessCalls.length, 2, 'readiness reloaded after default change');
  }
});

// ── Test 54: failed Wave 6A mutation preserves readiness state ────────────────

test('Wave 6B failed Wave 6A default change preserves readiness state', async () => {
  const readinessCalls = [];
  const session = createSession([...FULL_PERMISSIONS, 'fiscal.activities.default.update']);
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => { readinessCalls.push(1); return Promise.resolve(readiness({ readyToIssue: true })); },
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('default failed')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
    session,
  });
  const callsAfterLoad = readinessCalls.length;
  const defaultToggle = container.contentElement.defaultControls.find((c) => !c.disabled);
  if (defaultToggle) {
    defaultToggle.checked = true;
    await defaultToggle.listeners.change({ target: defaultToggle });
    assert.equal(readinessCalls.length, callsAfterLoad, 'failed default change must not reload readiness');
  }
});

// ── Test 55: no frontend readyToIssue calculation ────────────────────────────

test('Wave 6B fiscal-settings-admin.js contains no local readyToIssue calculation logic', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  // The view must not derive readyToIssue from local state
  assert.doesNotMatch(src, /\breadyToIssue\s*=(?!=)/,
    'readyToIssue must only be consumed from Billing response, not locally set');
});

// ── Test 56: no reasonCode conditions derive readyToIssue ────────────────────

test('Wave 6B fiscal-settings-admin.js does not calculate readyToIssue from reasonCodes', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  // Presence of reasonCodes must never set readyToIssue
  assert.doesNotMatch(src, /reasonCodes.*readyToIssue\s*=/,
    'reasonCodes must not be used to set readyToIssue');
  assert.doesNotMatch(src, /readyToIssue\s*=.*reasonCodes/,
    'readyToIssue must not be assigned based on reasonCodes');
});

// ── Test 57: browser performs zero Billing calls ──────────────────────────────

test('Wave 6B fiscal-settings-admin.js contains no direct Billing domain references', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  assert.doesNotMatch(src, /billing\.internal|billing-api|\/api\/v1\/companies/i,
    'View must not contain direct Billing API paths');
});

// ── Test 58: browser performs zero Hacienda calls ────────────────────────────

test('Wave 6B fiscal-settings-admin.js contains no direct Hacienda domain references', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'fiscal-settings-admin.js'), 'utf8');
  assert.doesNotMatch(src, /hacienda\.go\.cr|api\.hacienda/i,
    'View must not contain direct Hacienda URLs');
});

// ── Test 59: browser receives no Billing API key ─────────────────────────────

test('Wave 6B readiness panel HTML does not contain API key or credential fields', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.doesNotMatch(container.readinessElement.innerHTML, /apiKey|api_key|X-API-Key/i);
  assert.doesNotMatch(container.readinessElement.innerHTML, /billingCompanyId|billingTenantId/i);
});

// ── Test 60: browser receives no secretReference ─────────────────────────────

test('Wave 6B readiness panel HTML does not contain secretReference', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.doesNotMatch(container.readinessElement.innerHTML, /secretReference|credentialSecretRef|billingCredential/i);
});

// ── Tests 61–75: Reason-code presentation ────────────────────────────────────

const BLOCKER_CASES = [
  ['FISCAL_PROFILE_MISSING', /perfil fiscal/i],
  ['HACIENDA_CONNECTION_MISSING', /conexi.n con Hacienda/i],
  ['HACIENDA_CREDENTIALS_MISSING', /credenciales necesarias/i],
  ['ACTIVE_CERTIFICATE_MISSING', /certificado de firma activo/i],
  ['CERTIFICATE_EXPIRED', /certificado de firma está vencido/i],
  ['CERTIFICATE_NOT_YET_VALID', /todav.a no es v.lido/i],
  ['CERTIFICATE_IDENTITY_UNVERIFIED', /verificar la identidad del certificado/i],
  ['CERTIFICATE_IDENTITY_MISMATCH', /identidad del certificado no coincide/i],
  ['FISCAL_SIGNING_CERTIFICATE_SECRET_UNAVAILABLE', /no est. disponible actualmente/i],
  ['ISSUANCE_POINT_MISSING', /punto de emisi.n/i],
  ['TAXPAYER_VALIDATION_MISSING', /verificar la informaci.n del contribuyente/i],
  ['TAXPAYER_NOT_ACTIVE', /activo para facturaci.n electr.nica/i],
  ['ECONOMIC_ACTIVITY_MISSING', /actividades econ.micas verificadas/i],
  ['DEFAULT_ECONOMIC_ACTIVITY_MISSING', /actividad econ.mica predeterminada/i],
  ['DEFAULT_ECONOMIC_ACTIVITY_INVALID', /ya no es v.lida para facturaci.n/i],
];

for (const [code, pattern] of BLOCKER_CASES) {
  test(`Wave 6B reason code ${code} renders correct Spanish presentation message`, async () => {
    const container = await mount({
      api: {
        getFiscalSettings: () => Promise.resolve(settings()),
        getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false, reasonCodes: [code] })),
        refreshActivities: () => Promise.reject(new Error('not expected')),
        setDefaultActivity: () => Promise.reject(new Error('not expected')),
        updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
      },
    });
    assert.match(container.readinessElement.innerHTML, pattern,
      `Expected Spanish message for ${code}`);
  });
}

// ── Tests 76–80: Warning presentation ────────────────────────────────────────

const WARNING_CASES = [
  ['TAXPAYER_MOROSO', /moroso/i],
  ['TAXPAYER_OMISO', /omiso/i],
  ['ECONOMIC_ACTIVITY_VERIFICATION_STALE', /verificada hace m.s de 30 d.as/i],
];

for (const [code, pattern] of WARNING_CASES) {
  test(`Wave 6B warning ${code} renders correct Spanish presentation message`, async () => {
    const container = await mount({
      api: {
        getFiscalSettings: () => Promise.resolve(settings()),
        getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true, reasonCodes: [], warnings: [code] })),
        refreshActivities: () => Promise.reject(new Error('not expected')),
        setDefaultActivity: () => Promise.reject(new Error('not expected')),
        updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
      },
    });
    assert.match(container.readinessElement.innerHTML, pattern,
      `Expected Spanish message for warning ${code}`);
  });
}

test('Wave 6B warning does not derive readyToIssue — READY verdict preserved alongside warning', async () => {
  const container = await mount({
    api: {
      getFiscalSettings: () => Promise.resolve(settings()),
      getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true, reasonCodes: [], warnings: ['TAXPAYER_MOROSO'] })),
      refreshActivities: () => Promise.reject(new Error('not expected')),
      setDefaultActivity: () => Promise.reject(new Error('not expected')),
      updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
    },
  });
  assert.match(container.readinessElement.innerHTML, /Listo para facturar electr/);
  assert.doesNotMatch(container.readinessElement.innerHTML, /Configuraci.n fiscal incompleta/);
});

test('Wave 6B multiple warnings render safely without crash', async () => {
  let threw = false;
  try {
    const container = await mount({
      api: {
        getFiscalSettings: () => Promise.resolve(settings()),
        getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true, reasonCodes: [], warnings: ['TAXPAYER_MOROSO', 'TAXPAYER_OMISO', 'ECONOMIC_ACTIVITY_VERIFICATION_STALE'] })),
        refreshActivities: () => Promise.reject(new Error('not expected')),
        setDefaultActivity: () => Promise.reject(new Error('not expected')),
        updateActivityBillingEnabled: () => Promise.reject(new Error('not expected')),
      },
    });
    assert.match(container.readinessElement.innerHTML, /moroso/i);
    assert.match(container.readinessElement.innerHTML, /omiso/i);
    assert.match(container.readinessElement.innerHTML, /30 d/i);
  } catch (_e) {
    threw = true;
  }
  assert.equal(threw, false);
});
