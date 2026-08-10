/**
 * Characterization tests — agent-spa
 *
 * Verifica los contratos de los módulos de la SPA del agente sin levantar
 * servidor ni navegador. Se ejecuta en el mismo entorno Node que el resto
 * del test suite.
 *
 * REQ-001 … REQ-014 — specs/agent-spa/requirements.md
 */
'use strict';

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');

const agentPublicRoot = path.join(__dirname, '..', 'src', 'public', 'agent');

function readAgentFile(relativePath) {
  return fs.readFileSync(path.join(agentPublicRoot, relativePath), 'utf8');
}

// ─── REQ-001 / REQ-002 / REQ-003 — Archivos de infraestructura ──────────────

test('agent SPA required files exist', () => {
  const required = [
    'index.html',
    'app.js',
    'state.js',
    'helpers.js',
    'api/agent-api.js',
    'views/dashboard.js',
    'views/store-detail.js',
    'views/visit.js',
    'views/order-entry.js',
    'views/goals.js',
    'views/map.js',
    'vendor/leaflet/leaflet.js',
    'vendor/leaflet/leaflet.css',
  ];

  for (const f of required) {
    assert.ok(
      fs.existsSync(path.join(agentPublicRoot, f)),
      `${f} should exist in src/public/agent/`
    );
  }
});

// ─── REQ-006 — Leaflet vendoreado ────────────────────────────────────────────

test('Leaflet 1.9.4 is vendored locally and not truncated', () => {
  const leafletJs  = readAgentFile('vendor/leaflet/leaflet.js');
  const leafletCss = readAgentFile('vendor/leaflet/leaflet.css');

  assert.ok(leafletJs.includes('Leaflet 1.9.4'), 'leaflet.js must include the version string');
  assert.ok(leafletJs.length > 100_000, 'leaflet.js must not be truncated (>100 KB)');
  assert.ok(leafletCss.length > 5_000, 'leaflet.css must not be truncated (>5 KB)');

  // Sin referencias a CDN externo
  assert.ok(!leafletJs.includes('unpkg.com'), 'leaflet.js must not reference unpkg CDN');
});

test('index.html does not reference any CDN — all scripts are self-hosted', () => {
  const html = readAgentFile('index.html');
  assert.ok(!html.includes('unpkg.com'), 'index.html must not reference unpkg CDN');
  assert.ok(!html.includes('cdn.'), 'index.html must not reference external CDN');
});

// ─── REQ-001 — index.html: DOM fijo y orden de scripts ───────────────────────

test('index.html contains required shell DOM elements', () => {
  const html = readAgentFile('index.html');
  assert.ok(html.includes('id="agent-top-header"'),      'must have #agent-top-header');
  assert.ok(html.includes('id="agent-main"'),            'must have #agent-main');
  assert.ok(html.includes('id="agent-toast-container"'), 'must have #agent-toast-container');
  assert.ok(html.includes('aria-live="polite"'),         'toast container must have aria-live');
});

test('index.html script order is correct per REQ-001', () => {
  const html = readAgentFile('index.html');

  // REQ-001 canonical order
  const scriptOrder = [
    '/shared/session.js',
    '/shared/auth.js',
    'vendor/leaflet/leaflet.js',
    'app.js',
    'state.js',
    'helpers.js',
    'api/agent-api.js',
    'views/dashboard.js',
    'views/store-detail.js',
    'views/visit.js',
    'views/order-entry.js',
    'views/goals.js',
    'views/map.js',
  ];

  let lastIdx = -1;
  for (const script of scriptOrder) {
    const idx = html.indexOf(script);
    assert.ok(idx > lastIdx, `"${script}" must appear after previous script in index.html`);
    lastIdx = idx;
  }
});

test('index.html has Leaflet version comment and references bootstrap.js (no inline scripts)', () => {
  const html = readAgentFile('index.html');
  assert.ok(html.includes('Leaflet 1.9.4'), 'must have Leaflet version comment');
  assert.ok(html.includes('bootstrap.js'), 'must load bootstrap.js (not inline) to comply with script-src self CSP');
  assert.ok(!html.includes('<script>AgentApp'), 'must NOT have inline script — blocked by script-src self CSP');
});

test('bootstrap.js calls AgentApp.bootstrap and is self-hosted', () => {
  const src = readAgentFile('bootstrap.js');
  assert.ok(src.includes('AgentApp.bootstrap()'), 'bootstrap.js must call AgentApp.bootstrap()');
  assert.ok(fs.existsSync(path.join(agentPublicRoot, 'bootstrap.js')), 'bootstrap.js must exist as a separate file');
});

// ─── REQ-002 — app.js: AgentShell namespace y parseHashRoute ─────────────────

test('app.js defines AgentShell and AgentApp via IIFE', () => {
  const src = readAgentFile('app.js');
  assert.ok(src.includes('AgentShell'), 'app.js must define AgentShell');
  assert.ok(src.includes('register'), 'AgentShell must have register()');
  assert.ok(src.includes('require'),  'AgentShell must have require()');
  assert.ok(src.includes('AgentApp'), 'app.js must expose AgentApp');
  assert.ok(src.includes('bootstrap'), 'AgentApp must have bootstrap()');
});

test('app.js parseHashRoute handles query params', () => {
  const src = readAgentFile('app.js');
  // Debe usar URLSearchParams para parsear los parámetros del hash
  assert.ok(src.includes('URLSearchParams'), 'parseHashRoute must use URLSearchParams');
  assert.ok(src.includes('parseHashRoute'), 'function parseHashRoute must be defined');
});

test('app.js navigate function uses window.location.hash', () => {
  const src = readAgentFile('app.js');
  assert.ok(src.includes('navigate'), 'navigate function must exist');
  assert.ok(src.includes('window.location.hash'), 'navigate must update window.location.hash');
});

test('app.js redirects to / when session is invalid', () => {
  const src = readAgentFile('app.js');
  assert.ok(src.includes("window.location.href = '/'"), 'must redirect to / on invalid session');
  assert.ok(src.includes('companyId'), 'must check for companyId in session');
});

// ─── REQ-003 — state.js ──────────────────────────────────────────────────────

test('state.js registers all required getters and setters', () => {
  const src = readAgentFile('state.js');
  const required = [
    'getSession', 'setSession',
    'getStores',  'setStores',
    'getGoals',   'setGoals',
    'getSelectedStoreId', 'setSelectedStoreId',
  ];
  for (const fn of required) {
    assert.ok(src.includes(fn), `state.js must expose ${fn}`);
  }
  assert.ok(src.includes("AgentShell.register('state'"), "state.js must register as 'state'");
});

// ─── REQ-004 — helpers.js ────────────────────────────────────────────────────

test('helpers.js exposes all required utility functions', () => {
  const src = readAgentFile('helpers.js');
  const fns = ['currency', 'sortStores', 'escapeHtml', 'formatDate', 'buildStatusBadge', 'showToast'];
  for (const fn of fns) {
    assert.ok(src.includes(fn), `helpers.js must define ${fn}`);
  }
  assert.ok(src.includes("AgentShell.register('helpers'"), "helpers.js must register as 'helpers'");
});

test('helpers.js sortStores uses STATUS_ORDER with VENCIDA=0', () => {
  const src = readAgentFile('helpers.js');
  assert.ok(src.includes('VENCIDA'),          'must define VENCIDA status');
  assert.ok(src.includes('PROXIMA_A_VENCER'), 'must define PROXIMA_A_VENCER status');
  assert.ok(src.includes('daysSinceReference'), 'must use daysSinceReference for tiebreaking');
});

test('helpers.js escapeHtml handles &, <, >, quote chars', () => {
  const src = readAgentFile('helpers.js');
  assert.ok(src.includes('&amp;'),  'must escape & to &amp;');
  assert.ok(src.includes('&lt;'),   'must escape < to &lt;');
  assert.ok(src.includes('&gt;'),   'must escape > to &gt;');
  assert.ok(src.includes('&quot;'), 'must escape " to &quot;');
  assert.ok(src.includes('&#39;'),  "must escape ' to &#39;");
});

test('helpers.js showToast inserts element with role=status and removes it after timeout', () => {
  const src = readAgentFile('helpers.js');
  assert.ok(src.includes('role'), 'showToast must set role attribute');
  assert.ok(src.includes('status'), 'showToast element must have role=status');
  assert.ok(src.includes('setTimeout'), 'showToast must use setTimeout to remove the element');
});

// ─── REQ-005 — api/agent-api.js ──────────────────────────────────────────────

test('agent-api.js exposes all required fetch functions', () => {
  const src = readAgentFile('api/agent-api.js');
  const fns = [
    'fetchDashboard', 'fetchStores', 'fetchGoals',
    'fetchStoreDetail', 'fetchOrderContext',
    'postVisit', 'postOrder',
  ];
  for (const fn of fns) {
    assert.ok(src.includes(fn), `agent-api.js must define ${fn}`);
  }
  assert.ok(src.includes("AgentShell.register('api.agentApi'"), "must register as 'api.agentApi'");
});

test('agent-api.js postVisit sends clientStoreId in body, not in path', () => {
  const src = readAgentFile('api/agent-api.js');
  // El URL de postVisit no debe incluir storeId como path param
  const postVisitIdx = src.indexOf('postVisit');
  const postVisitSection = src.slice(postVisitIdx, postVisitIdx + 400);
  assert.ok(postVisitSection.includes('/visits'), 'postVisit must call /api/agent/visits');
  assert.ok(!postVisitSection.includes('/${storeId}'), 'postVisit must NOT include storeId in path');
  assert.ok(src.includes('clientStoreId'), 'postVisit payload must include clientStoreId');
});

test('agent-api.js postOrder uses /stores/:storeId/orders path', () => {
  const src = readAgentFile('api/agent-api.js');
  assert.ok(src.includes('/orders'), 'postOrder must call /stores/:storeId/orders');
  assert.ok(src.includes('encodeURIComponent(storeId)'), 'postOrder must encode storeId in path');
});

test('agent-api.js uses InventoryAuth.fetchJson for all calls', () => {
  const src = readAgentFile('api/agent-api.js');
  assert.ok(src.includes('inventoryAuth.fetchJson'), 'all calls must use InventoryAuth.fetchJson');
  assert.ok(src.includes("credentials: 'same-origin'"), 'must use same-origin credentials');
});

// ─── REQ-007 — CSP en app.js ─────────────────────────────────────────────────

test('app.js CSP branch adds OpenStreetMap domains for /agent/ routes', () => {
  const appSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'app.js'), 'utf8'
  );
  assert.ok(appSrc.includes("pathName.startsWith('/agent/')"), "must check pathName.startsWith('/agent/')");
  assert.ok(appSrc.includes('tile.openstreetmap.org'), 'CSP must include tile.openstreetmap.org');
  assert.ok(appSrc.includes('img-src'), 'agent CSP must have img-src directive');
  assert.ok(appSrc.includes('connect-src'), 'agent CSP must have connect-src directive');
});

// ─── REQ-009..014 — Vistas: registros y patrones de seguridad ────────────────

test('dashboard.js registers views.dashboard and uses escapeHtml', () => {
  const src = readAgentFile('views/dashboard.js');
  assert.ok(src.includes("AgentShell.register('views.dashboard'"), 'must register views.dashboard');
  assert.ok(src.includes('escapeHtml'), 'must use escapeHtml for server data in innerHTML');
  assert.ok(src.includes('Promise.allSettled'), 'must use Promise.allSettled for parallel loads (ADR-007)');
  assert.ok(src.includes('sortStores'), 'must apply sortStores before first render');
  assert.ok(src.includes('state.setStores'), 'must persist stores in shared state');
});

test('dashboard.js filters locally without re-fetch', () => {
  const src = readAgentFile('views/dashboard.js');
  assert.ok(src.includes("addEventListener('input'"), 'must bind input listener for local filtering');
  // El listener no debe llamar a fetchStores de nuevo
  const filterFnIdx = src.indexOf('applyFilter');
  assert.ok(filterFnIdx > -1, 'must define applyFilter function');
  // La función de filtro no debería hacer fetch
  const filterFnSrc = src.slice(filterFnIdx, filterFnIdx + 200);
  assert.ok(!filterFnSrc.includes('fetchStores'), 'applyFilter must not call fetchStores');
});

test('store-detail.js registers views.storeDetail with 404 and network error handling', () => {
  const src = readAgentFile('views/store-detail.js');
  assert.ok(src.includes("AgentShell.register('views.storeDetail'"), 'must register views.storeDetail');
  assert.ok(src.includes('cobertura'), 'must show coverage-specific 404 message');
  assert.ok(src.includes('Reintentar'), 'must have retry CTA for network errors');
  assert.ok(src.includes('<details open>') || src.includes("details open") || src.includes('"open"'), 'Contactos accordion must be open by default');
  assert.ok(src.includes('tel:'), 'phones must render as tel: links');
  assert.ok(src.includes('escapeHtml'), 'must use escapeHtml');
});

test('visit.js registers views.visit with ButtonGroups and saving state', () => {
  const src = readAgentFile('views/visit.js');
  assert.ok(src.includes("AgentShell.register('views.visit'"), 'must register views.visit');
  assert.ok(src.includes('role="group"'), 'ButtonGroups must use role=group');
  assert.ok(src.includes('aria-labelledby'), 'ButtonGroups must have aria-labelledby');
  assert.ok(src.includes('pointerEvents'), 'must set pointerEvents during saving state');
  assert.ok(src.includes('opacity'), 'must set opacity during saving state');
  assert.ok(src.includes('REPROGRAMADA'), 'must handle REPROGRAMADA result type');
  assert.ok(src.includes('suggestedNextVisitAt'), 'must handle suggestedNextVisitAt field');
  assert.ok(src.includes('clientStoreId'), 'POST payload must include clientStoreId');
  assert.ok(src.includes('/api/agent/visits') || src.includes('postVisit'), 'must call correct endpoint');
  assert.ok(src.includes('font-size:16px'), 'text inputs must have font-size 16px (iOS zoom prevention)');
});

test('visit.js preserves form data on POST error and prepends new visit on success', () => {
  const src = readAgentFile('views/visit.js');
  assert.ok(src.includes('visitHistory'), 'must manage visitHistory array');
  assert.ok(src.includes('response?.visit') || src.includes('newVisit'), 'must prepend new visit from response');
  assert.ok(src.includes('agent-field-error') || src.includes('field-error'), 'must show inline validation errors');
});

test('order-entry.js registers views.orderEntry with Map qty source and SuccessOverlay', () => {
  const src = readAgentFile('views/order-entry.js');
  assert.ok(src.includes("AgentShell.register('views.orderEntry'"), 'must register views.orderEntry');
  assert.ok(src.includes('new Map()') || src.includes('Map()'), 'must use Map<productId, qty> as source of truth');
  assert.ok(src.includes('agent-success-overlay'), 'must render SuccessOverlay');
  assert.ok(src.includes('discountPercent') && src.includes('0'), 'must send discount fields as 0');
  assert.ok(src.includes('font-size:16px'), 'text inputs must have font-size 16px');
  assert.ok(src.includes('orderNumber'), 'SuccessOverlay must show order number');
});

test('order-entry.js SuccessOverlay is not closeable with Escape', () => {
  const src = readAgentFile('views/order-entry.js');
  assert.ok(src.includes('Escape') && src.includes('preventDefault'), 'must prevent Escape key from closing overlay (ADR-006)');
});

test('goals.js registers views.goals and reuses state without re-fetch', () => {
  const src = readAgentFile('views/goals.js');
  assert.ok(src.includes("AgentShell.register('views.goals'"), 'must register views.goals');
  assert.ok(src.includes('state.getGoals()'), 'must check state.getGoals() before fetching');
  assert.ok(src.includes('currentAmount') && src.includes('targetAmount'), 'must compare amounts for meta-alcanzada badge');
  assert.ok(src.includes('role="progressbar"'), 'must have role=progressbar');
  assert.ok(src.includes('aria-valuenow'), 'progressbar must have aria-valuenow');
  assert.ok(src.includes('¡Meta alcanzada!'), 'must show meta alcanzada badge');
  assert.ok(src.includes('#DC2626'), 'must include red color for 0-30%');
  assert.ok(src.includes('#16A34A'), 'must include green color for 71-100%');
});

test('map.js registers views.map with Leaflet divIcon and invalidateSize', () => {
  const src = readAgentFile('views/map.js');
  assert.ok(src.includes("AgentShell.register('views.map'"), 'must register views.map');
  assert.ok(src.includes('L.divIcon'), 'must use L.divIcon for status markers');
  assert.ok(src.includes('L.layerGroup'), 'must use L.layerGroup for marker management');
  assert.ok(src.includes('invalidateSize'), 'must call invalidateSize (RISK-004)');
  assert.ok(src.includes('setTimeout'), 'invalidateSize must be in setTimeout');
  assert.ok(src.includes('fitBounds'), 'must use fitBounds when multiple stores have coords');
  assert.ok(src.includes('COSTA_RICA_CENTER'), 'must define COSTA_RICA_CENTER fallback');
  assert.ok(src.includes('getCurrentPosition'), 'must call geolocation.getCurrentPosition');
  assert.ok(src.includes('state.getStores()'), 'must reuse stores from state without re-fetch');
  assert.ok(src.includes('agent-map-marker--'), 'markers must use CSS class per status');
});

// ─── REQ-013 — login.js redirect para agentes ────────────────────────────────

test('login.js getHomeForSession redirects operational agents to /agent/', () => {
  const loginSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'public', 'login.js'), 'utf8'
  );
  assert.ok(loginSrc.includes("'/agent/'"), "must return '/agent/' for operational agents");
  assert.ok(loginSrc.includes('isOperationalAgentSession'), 'must use isOperationalAgentSession check');
  assert.ok(loginSrc.includes('POST_LOGIN_TRANSITION_PATH'), 'must keep POST_LOGIN_TRANSITION_PATH for other roles');
  // Verifica que la rama del agente esté ANTES de la del supervisor
  const agentIdx = loginSrc.indexOf("'/agent/'");
  const supervisorIdx = loginSrc.indexOf("'sales_supervisor'");
  assert.ok(agentIdx < supervisorIdx, 'agent redirect branch must come before sales_supervisor branch');
});
