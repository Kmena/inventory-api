'use strict';

// ── Wave 8 — Fiscal Settings UX / Responsive / Accessibility / Hardening ─────
// Tests: layout structure, accessibility attributes, responsive CSS classes,
// state-consistency, concurrency hardening, canonical-state preservation.
// Does NOT duplicate tests already green in Waves 1-7.

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

// readinessElement supports querySelector so we can find the retry button
function createReadinessElement() {
  const el = { _innerHTML: '' };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = v; },
  });
  el.querySelector = function (selector) {
    if (selector === '[data-fiscal-readiness-retry-btn]') {
      if (this._innerHTML.includes('data-fiscal-readiness-retry-btn')) {
        const btn = new FakeButton({ hidden: false });
        return btn;
      }
      return null;
    }
    return null;
  };
  return el;
}

function createContainer() {
  const statusElement = { innerHTML: '' };
  const refreshButton = new FakeButton({ hidden: true });
  const readinessElement = createReadinessElement();
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
    statusElement, contentElement, refreshButton, readinessElement,
    querySelector(selector) {
      if (selector === '[data-fiscal-settings-status]') return statusElement;
      if (selector === '[data-fiscal-settings-content]') return contentElement;
      if (selector === '[data-fiscal-refresh-btn]') return refreshButton;
      if (selector === '[data-fiscal-readiness-content]') return readinessElement;
      return null;
    },
  };
}

function activity(overrides = {}) {
  return {
    code: '9609.0', description: 'Servicios personales', haciendaStatus: 'A',
    haciendaKind: 'Principal', billingEnabled: true, isDefault: false,
    verifiedAt: '2026-01-15T10:00:00.000Z', lastSeenAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function settings(overrides = {}) {
  return {
    taxpayer: {
      verificationStatus: 'VERIFIED', verifiedAt: '2026-01-15T10:00:00.000Z',
      taxSituation: 'AL DIA', moroso: false, omiso: false,
    },
    defaultActivityCode: null,
    activities: [activity({ code: '9609.0', isDefault: true, billingEnabled: true })],
    configuration: { hasBillingIntegration: true },
    ...overrides,
  };
}

function readiness(overrides = {}) {
  return {
    environment: 'SANDBOX', readyToIssue: true,
    reasonCodes: [], warnings: [],
    checkedAt: '2026-09-29T10:00:00.000Z', ...overrides,
  };
}

const FULL_PERMS = [
  'fiscal.settings.view', 'fiscal.activities.refresh',
  'fiscal.activities.manage', 'fiscal.activities.default.update', 'fiscal.readiness.view',
];

async function mount({ api, session = createSession(FULL_PERMS) }) {
  const view = createViewHarness(api);
  const container = createContainer();
  await view.mount(container, session, {});
  return container;
}

function okApi(overrides = {}) {
  return {
    getFiscalSettings: () => Promise.resolve(settings()),
    getFiscalReadiness: () => Promise.resolve(readiness()),
    refreshActivities: () => Promise.resolve({}),
    setDefaultActivity: () => Promise.resolve(settings()),
    updateActivityBillingEnabled: () => Promise.resolve(settings()),
    ...overrides,
  };
}

// ── 1. fiscal-settings-page class: no commercial-page ────────────────────────

test('Wave 8 #1: rendered content uses fiscal-settings-page, not commercial-page', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /fiscal-settings-page/);
  assert.doesNotMatch(container.contentElement.innerHTML, /commercial-page/);
});

// ── 2. fiscal-summary-grid class: not commercial-layout for summary cards ─────

test('Wave 8 #2: summary cards use fiscal-summary-grid, not commercial-layout', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /fiscal-summary-grid/);
  assert.doesNotMatch(container.contentElement.innerHTML, /commercial-layout/);
});

// ── 3. activities use fiscal-activities-stack ─────────────────────────────────

test('Wave 8 #3: activities checklist uses fiscal-activities-stack, not commercial-layout', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /fiscal-activities-stack/);
});

// ── 4. each activity uses fiscal-activity-item class ─────────────────────────

test('Wave 8 #4: each activity row has fiscal-activity-item class', async () => {
  const data = settings({ activities: [activity({ code: 'A' }), activity({ code: 'B' })] });
  const container = await mount({ api: okApi({ getFiscalSettings: () => Promise.resolve(data) }) });
  const matches = container.contentElement.innerHTML.match(/fiscal-activity-item/g) || [];
  assert.equal(matches.length, 2, 'one fiscal-activity-item per activity');
});

// ── 5. activity head structure ────────────────────────────────────────────────

test('Wave 8 #5: activity rows contain fiscal-activity-head', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /fiscal-activity-head/);
});

// ── 6. activity controls group with role=group ────────────────────────────────

test('Wave 8 #6: activity controls have role=group aria-label', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /role="group"/);
  assert.match(container.contentElement.innerHTML, /aria-label="Controles de actividad/);
});

// ── 7. fiscal-activity-hints rendered ────────────────────────────────────────

test('Wave 8 #7: fiscal-activity-hints element rendered per activity', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /fiscal-activity-hints/);
});

// ── 8. checkbox aria-describedby points to hint ───────────────────────────────

test('Wave 8 #8: checkbox has aria-describedby pointing to hint id', async () => {
  const container = await mount({ api: okApi() });
  // checkbox id is fiscal-activity-0, hint id is fiscal-activity-0-hint
  assert.match(container.contentElement.innerHTML, /aria-describedby="fiscal-activity-0-hint"/);
  assert.match(container.contentElement.innerHTML, /id="fiscal-activity-0-hint"/);
});

// ── 9. radio aria-describedby points to hint ──────────────────────────────────

test('Wave 8 #9: radio has aria-describedby pointing to hint id', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.contentElement.innerHTML, /aria-describedby="fiscal-default-0-hint"/);
  assert.match(container.contentElement.innerHTML, /id="fiscal-default-0-hint"/);
});

// ── 10. readiness card has fiscal-readiness-card class ───────────────────────

test('Wave 8 #10: readiness card has fiscal-readiness-card class (ready state)', async () => {
  const container = await mount({ api: okApi() });
  assert.match(container.readinessElement.innerHTML, /fiscal-readiness-card/);
});

// ── 11. READY readiness gets --ready modifier ─────────────────────────────────

test('Wave 8 #11: readyToIssue=true adds fiscal-readiness-card--ready class', async () => {
  const container = await mount({
    api: okApi({ getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true })) }),
  });
  assert.match(container.readinessElement.innerHTML, /fiscal-readiness-card--ready/);
  assert.doesNotMatch(container.readinessElement.innerHTML, /fiscal-readiness-card--not-ready/);
});

// ── 12. NOT READY readiness gets --not-ready modifier ────────────────────────

test('Wave 8 #12: readyToIssue=false adds fiscal-readiness-card--not-ready class', async () => {
  const container = await mount({
    api: okApi({ getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false })) }),
  });
  assert.match(container.readinessElement.innerHTML, /fiscal-readiness-card--not-ready/);
  assert.doesNotMatch(container.readinessElement.innerHTML, /fiscal-readiness-card--ready/);
});

// ── 13. unavailable readiness has retry button inside readinessElement ────────

test('Wave 8 #13: readiness unavailable state contains retry button inside readiness area', async () => {
  const container = await mount({
    api: okApi({ getFiscalReadiness: () => Promise.reject(new Error('network error')) }),
  });
  assert.match(
    container.readinessElement.innerHTML,
    /data-fiscal-readiness-retry-btn/,
    'retry button rendered inside readiness area when unavailable',
  );
});

// ── 14. status div has aria-atomic ────────────────────────────────────────────

test('Wave 8 #14: static render HTML has aria-atomic=true on status region', () => {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', {});
  executeRootScript('views/fiscal-settings-admin.js', context);
  const view = browserWindow.RootShell.require('views.fiscalSettingsAdmin');
  const html = view.render();
  assert.match(html, /aria-atomic="true"/, 'status div has aria-atomic=true');
});

// ── 15. initial loading placeholder has fiscal-readiness-card class ───────────

test('Wave 8 #15: initial render loading placeholder has fiscal-readiness-card class', () => {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', {});
  executeRootScript('views/fiscal-settings-admin.js', context);
  const view = browserWindow.RootShell.require('views.fiscalSettingsAdmin');
  const html = view.render();
  assert.match(html, /fiscal-readiness-card/, 'loading placeholder uses fiscal-readiness-card');
});

// ── 16. READY verdict text (Wave 6B regression) ───────────────────────────────

test('Wave 8 #16: READY verdict text unchanged', async () => {
  const container = await mount({
    api: okApi({ getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: true })) }),
  });
  assert.match(container.readinessElement.innerHTML, /Listo para facturar electr/);
});

// ── 17. NOT READY verdict text (Wave 6B regression) ──────────────────────────

test('Wave 8 #17: NOT READY verdict text unchanged', async () => {
  const container = await mount({
    api: okApi({ getFiscalReadiness: () => Promise.resolve(readiness({ readyToIssue: false })) }),
  });
  assert.match(container.readinessElement.innerHTML, /Configuraci.n fiscal incompleta/);
});

// ── 18. unavailable verdict text (Wave 6B regression) ────────────────────────

test('Wave 8 #18: unavailable readiness verdict text unchanged', async () => {
  const container = await mount({
    api: okApi({ getFiscalReadiness: () => Promise.reject(new Error('timeout')) }),
  });
  assert.match(container.readinessElement.innerHTML, /No fue posible comprobar/);
});

// ── 19. zero activities empty state ──────────────────────────────────────────

test('Wave 8 #19: zero activities renders safe empty state without crashing', async () => {
  const container = await mount({
    api: okApi({
      getFiscalSettings: () => Promise.resolve(settings({ activities: [] })),
    }),
  });
  assert.match(container.contentElement.innerHTML, /No hay actividades econ/);
  assert.doesNotMatch(container.contentElement.innerHTML, /fiscal-activity-item/);
});

// ── 20. activity checkbox label is accessible ─────────────────────────────────

test('Wave 8 #20: activity checkbox has accessible aria-label', async () => {
  const container = await mount({
    api: okApi({ getFiscalSettings: () => Promise.resolve(settings({ activities: [activity({ code: 'X001' })] })) }),
  });
  assert.match(container.contentElement.innerHTML, /aria-label="Actividad X001/);
});

// ── 21. activity radio label is accessible ───────────────────────────────────

test('Wave 8 #21: activity radio has accessible aria-label', async () => {
  const container = await mount({
    api: okApi({ getFiscalSettings: () => Promise.resolve(settings({ activities: [activity({ code: 'X001' })] })) }),
  });
  assert.match(container.contentElement.innerHTML, /aria-label="Predeterminada X001/);
});

// ── 22. refresh button accessible aria-label ──────────────────────────────────

test('Wave 8 #22: refresh button has descriptive aria-label', () => {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', {});
  executeRootScript('views/fiscal-settings-admin.js', context);
  const view = browserWindow.RootShell.require('views.fiscalSettingsAdmin');
  const html = view.render();
  assert.match(html, /aria-label="Actualizar informaci.n fiscal desde Hacienda"/);
});

// ── 23. disabled checkbox renders disabled attribute ─────────────────────────

test('Wave 8 #23: inactive Hacienda activity checkbox renders as disabled', async () => {
  const inactive = activity({ code: 'INACTIVE', haciendaStatus: 'I', billingEnabled: false });
  const container = await mount({
    api: okApi({ getFiscalSettings: () => Promise.resolve(settings({ activities: [inactive] })) }),
  });
  const [checkbox] = container.contentElement.activityControls;
  assert.ok(checkbox.disabled, 'inactive activity checkbox is disabled');
});

// ── 24. disabled checkbox has hint text rendered ─────────────────────────────

test('Wave 8 #24: disabled checkbox hint text is rendered in activity hints', async () => {
  const inactive = activity({ code: 'INACTIVE', haciendaStatus: 'I', billingEnabled: false });
  const container = await mount({
    api: okApi({
      getFiscalSettings: () => Promise.resolve(settings({ activities: [inactive] })),
    }),
  });
  // Hint should explain why it's disabled
  assert.match(container.contentElement.innerHTML, /no activa ante Hacienda/);
});

// ── 25. disabled radio has hint text rendered ─────────────────────────────────

test('Wave 8 #25: disabled radio hint text is rendered in activity hints', async () => {
  const inactive = activity({ code: 'INACTIVE', haciendaStatus: 'I', billingEnabled: false });
  const container = await mount({
    api: okApi({
      getFiscalSettings: () => Promise.resolve(settings({ activities: [inactive] })),
    }),
  });
  assert.match(container.contentElement.innerHTML, /fiscal-activity-hints/);
});

// ── 26. duplicate activity mutation prevention ────────────────────────────────

test('Wave 8 #26: duplicate activity toggle while pending is prevented', async () => {
  let calls = 0;
  const container = await mount({
    api: okApi({
      updateActivityBillingEnabled: () => {
        calls++;
        return new Promise((resolve) => setTimeout(() => resolve(settings()), 50));
      },
    }),
  });
  const [toggle] = container.contentElement.activityControls;
  toggle.listeners.change({ target: toggle });
  toggle.listeners.change({ target: toggle }); // duplicate
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls, 1, 'second concurrent toggle ignored');
});

// ── 27. duplicate default mutation prevention ─────────────────────────────────

test('Wave 8 #27: duplicate default toggle while pending is prevented', async () => {
  let calls = 0;
  const two = [
    activity({ code: 'A', isDefault: false, billingEnabled: true }),
    activity({ code: 'B', isDefault: false, billingEnabled: true }),
  ];
  const container = await mount({
    api: okApi({
      getFiscalSettings: () => Promise.resolve(settings({ activities: two })),
      setDefaultActivity: () => {
        calls++;
        return new Promise((resolve) => setTimeout(() => resolve(settings()), 50));
      },
    }),
  });
  const [def1] = container.contentElement.defaultControls;
  def1.listeners.change({ target: def1 });
  def1.listeners.change({ target: def1 }); // duplicate
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls, 1, 'duplicate default mutation ignored');
});

// ── 28. duplicate refresh prevention ─────────────────────────────────────────

test('Wave 8 #28: duplicate refresh while pending is prevented', async () => {
  let calls = 0;
  const container = await mount({
    api: okApi({
      refreshActivities: () => {
        calls++;
        return new Promise((resolve) => setTimeout(() => resolve({}), 50));
      },
    }),
  });
  container.refreshButton.hidden = false;
  container.refreshButton.listeners.click();
  container.refreshButton.listeners.click(); // duplicate
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls, 1, 'duplicate refresh ignored');
});

// ── 29. refresh concurrency: activity controls disabled during refresh ─────────

test('Wave 8 #29: activity controls disabled during refresh (concurrency protection)', async () => {
  let activityToggle;
  let refreshResolve;
  const refreshDone = new Promise((r) => { refreshResolve = r; });

  const container = await mount({
    api: okApi({
      refreshActivities: () => refreshDone,
    }),
  });

  container.refreshButton.hidden = false;
  container.refreshButton.listeners.click();
  // During refresh, re-render has refreshPending=true → activity controls disabled
  const [toggle] = container.contentElement.activityControls;
  activityToggle = toggle;
  assert.ok(activityToggle.disabled, 'activity toggle disabled during refresh');

  refreshResolve({});
  await new Promise((r) => setTimeout(r, 20));
});

// ── 30. no commercial-layout in rendered page ─────────────────────────────────

test('Wave 8 #30: no commercial-layout class in fiscal settings content', async () => {
  const container = await mount({ api: okApi() });
  assert.doesNotMatch(
    container.contentElement.innerHTML,
    /commercial-layout/,
    'fiscal settings page does not use commercial-layout',
  );
});

// ── 31. no local readiness synthesis ─────────────────────────────────────────

test('Wave 8 #31: readyToIssue is consumed directly — no local recalculation', async () => {
  // Even with no blockers and active activities, if Billing says not ready → NOT READY
  const container = await mount({
    api: okApi({
      getFiscalReadiness: () => Promise.resolve(readiness({
        readyToIssue: false, reasonCodes: [], warnings: [],
      })),
    }),
  });
  assert.match(container.readinessElement.innerHTML, /Configuraci.n fiscal incompleta/);
  assert.doesNotMatch(container.readinessElement.innerHTML, /Listo para facturar electr/);
});

// ── 32. successful activity mutation reloads readiness ────────────────────────

test('Wave 8 #32: successful activity mutation triggers readiness reload', async () => {
  let readinessCalls = 0;
  const container = await mount({
    api: okApi({
      getFiscalReadiness: () => { readinessCalls++; return Promise.resolve(readiness()); },
      updateActivityBillingEnabled: () => Promise.resolve(settings()),
    }),
  });
  const countAfterMount = readinessCalls;
  const [toggle] = container.contentElement.activityControls;
  toggle.listeners.change({ target: toggle });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(readinessCalls > countAfterMount, 'readiness reloaded after activity mutation');
});

// ── 33. successful default mutation reloads readiness ─────────────────────────

test('Wave 8 #33: successful default mutation triggers readiness reload', async () => {
  let readinessCalls = 0;
  const two = [
    activity({ code: 'A', isDefault: false, billingEnabled: true }),
    activity({ code: 'B', isDefault: false, billingEnabled: true }),
  ];
  const container = await mount({
    api: okApi({
      getFiscalSettings: () => Promise.resolve(settings({ activities: two })),
      getFiscalReadiness: () => { readinessCalls++; return Promise.resolve(readiness()); },
      setDefaultActivity: () => Promise.resolve(settings()),
    }),
  });
  const countAfterMount = readinessCalls;
  const [def] = container.contentElement.defaultControls;
  def.listeners.change({ target: def });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(readinessCalls > countAfterMount, 'readiness reloaded after default mutation');
});

// ── 34. successful refresh reloads readiness ──────────────────────────────────

test('Wave 8 #34: successful refresh triggers readiness reload', async () => {
  let readinessCalls = 0;
  const container = await mount({
    api: okApi({
      getFiscalReadiness: () => { readinessCalls++; return Promise.resolve(readiness()); },
      refreshActivities: () => Promise.resolve({}),
    }),
  });
  const countAfterMount = readinessCalls;
  container.refreshButton.hidden = false;
  container.refreshButton.listeners.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(readinessCalls > countAfterMount, 'readiness reloaded after successful refresh');
});

// ── 35. failed activity mutation does NOT reload readiness ────────────────────

test('Wave 8 #35: failed activity mutation does NOT reload readiness', async () => {
  let readinessCalls = 0;
  const container = await mount({
    api: okApi({
      getFiscalReadiness: () => { readinessCalls++; return Promise.resolve(readiness()); },
      updateActivityBillingEnabled: () => Promise.reject(new Error('server error')),
    }),
  });
  const countAfterMount = readinessCalls;
  const [toggle] = container.contentElement.activityControls;
  toggle.listeners.change({ target: toggle });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(readinessCalls, countAfterMount, 'readiness NOT reloaded after failed mutation');
});

// ── 36. no Billing URL in rendered HTML ───────────────────────────────────────

test('Wave 8 #36: no direct Billing URL appears in content HTML', async () => {
  const container = await mount({ api: okApi() });
  const combined = container.contentElement.innerHTML + container.readinessElement.innerHTML;
  assert.doesNotMatch(combined, /billing[^"]*\/api/i, 'no Billing API path in rendered HTML');
  assert.doesNotMatch(combined, /localhost:3000/i, 'no Billing localhost URL in rendered HTML');
});

// ── 37. no Hacienda URL in rendered HTML ──────────────────────────────────────

test('Wave 8 #37: no direct Hacienda URL in rendered HTML', async () => {
  const container = await mount({ api: okApi() });
  const combined = container.contentElement.innerHTML + container.readinessElement.innerHTML;
  assert.doesNotMatch(combined, /hacienda\.go\.cr/i, 'no Hacienda URL in rendered HTML');
});

// ── 38. isDefault + !billingEnabled renders remediation warning ───────────────

test('Wave 8 #38: default activity with billing disabled renders remediation warning', async () => {
  const data = settings({
    activities: [activity({ code: 'X', isDefault: true, billingEnabled: false, haciendaStatus: 'A' })],
  });
  const container = await mount({ api: okApi({ getFiscalSettings: () => Promise.resolve(data) }) });
  assert.match(container.contentElement.innerHTML, /predeterminada aunque la facturaci/);
});

// ── 39. no default empty state when no eligible activities ────────────────────

test('Wave 8 #39: shows default-empty-state when activities exist but none eligible', async () => {
  const data = settings({
    activities: [activity({ code: 'NOPE', haciendaStatus: 'I', billingEnabled: false })],
  });
  const container = await mount({ api: okApi({ getFiscalSettings: () => Promise.resolve(data) }) });
  assert.match(container.contentElement.innerHTML, /No hay actividades habilitadas/);
});

// ── 40. status div has aria-live polite (no regression) ───────────────────────

test('Wave 8 #40: static render HTML has aria-live polite on status div', () => {
  const { browserWindow, context } = createContext();
  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);
  browserWindow.RootShell.register('fiscalSettingsApi', {});
  executeRootScript('views/fiscal-settings-admin.js', context);
  const view = browserWindow.RootShell.require('views.fiscalSettingsAdmin');
  const html = view.render();
  assert.match(html, /aria-live="polite"/, 'status region has aria-live=polite');
});
