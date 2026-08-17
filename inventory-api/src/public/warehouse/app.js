/**
 * Warehouse/QA SPA — Shell and router.
 *
 * Responsibilities:
 *  - Register the WarehouseShell namespace (register / require).
 *  - Bootstrap authentication and session validation.
 *  - Render the permission-aware tab bar.
 *  - Handle hash-based routing.
 *  - Expose navigate() for views.
 *
 * Permissions used:
 *  - warehouse.access  — landing gate (all warehouse users)
 *  - warehouse.receive — receipt confirmation, stock operations
 *  - quality.inspect   — QA inspection workflows
 */
(() => {
const inventorySession = /** @type {any} */ (window).InventorySession;
const inventoryAuth = /** @type {any} */ (window).InventoryAuth;

const NO_ACCESS_PATH = '/no-access.html';
const LOGIN_PATH = '/';

// -----------------------------------------------------------------------
// WarehouseShell bounded registry
// -----------------------------------------------------------------------

const _registry = new Map();

const WarehouseShell = {
  register(name, module) {
    _registry.set(name, module);
  },
  require(name) {
    if (!_registry.has(name)) {
      throw new Error(`[WarehouseShell] Falta la dependencia requerida: "${name}"`);
    }
    return _registry.get(name);
  },
  has(name) {
    return _registry.has(name);
  },
};

/** @type {any} */ (window).WarehouseShell = WarehouseShell;

// -----------------------------------------------------------------------
// DOM elements
// -----------------------------------------------------------------------

const headerEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-header'));
const viewTitleEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-view-title'));
const statusEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-status'));
const viewEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-view'));
const tabBarEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-tab-bar'));
const identitySlotEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-identity-slot'));
const toastContainerEl = /** @type {HTMLElement} */ (document.getElementById('warehouse-toast-container'));

if (!headerEl || !viewTitleEl || !statusEl || !viewEl || !tabBarEl || !identitySlotEl || !toastContainerEl) {
  throw new Error('[WarehouseShell] Elementos DOM base no encontrados.');
}

// -----------------------------------------------------------------------
// View → module key mapping
// -----------------------------------------------------------------------

const VIEW_MODULE_KEYS = /** @type {Record<string, string>} */ ({
  'receipts':            'views.receipts',
  'inspections':         'views.inspections',
  'production':          'views.production',
  'recipe-consultation': 'views.recipeConsultation',
  'inventory':           'views.inventoryStub',
});

const TAB_DEFINITIONS = [
  {
    view:       'receipts',
    label:      'Recepciones',
    icon:       '📦',
    /** @param {string[]} p */ permission: (p) => p.includes('warehouse.receive') || p.includes('quality.inspect'),
  },
  {
    view:       'production',
    label:      'Produccion',
    icon:       '🏭',
    /** @param {string[]} p */ permission: (p) => p.includes('warehouse.receive') || p.includes('quality.inspect'),
  },
  {
    view:       'recipe-consultation',
    label:      'Recetas',
    icon:       '📋',
    /** @param {string[]} p */ permission: (p) => p.includes('warehouse.access'),
  },
  {
    view:       'inventory',
    label:      'Inventario',
    icon:       '📊',
    stub:       true,
    /** @param {string[]} p */ permission: (p) => p.includes('warehouse.receive'),
  },
];

const VIEW_LABELS = /** @type {Record<string, string>} */ ({
  'receipts':            'Recepciones',
  'inspections':         'Inspecciones',
  'production':          'Produccion',
  'recipe-consultation': 'Recetas (solo lectura)',
  'inventory':           'Inventario',
});

// -----------------------------------------------------------------------
// Routing
// -----------------------------------------------------------------------

function parseHashRoute(hash) {
  const raw = String(hash || '').replace(/^#/, '').trim();
  const [view, queryString] = raw.split('?');
  const params = {};
  if (queryString) {
    for (const part of queryString.split('&')) {
      const [k, v] = part.split('=');
      if (k) { params[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
    }
  }
  return { view: view || '', params };
}

function buildHashPath(view, params = {}) {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `#${view}${queryString ? `?${queryString}` : ''}`;
}

function navigate(view, params = {}) {
  window.location.hash = buildHashPath(view, params);
}

function resolveView(hash, session) {
  const { view, params } = parseHashRoute(hash);
  const permissions = session?.user?.permissions || [];

  if (view && VIEW_MODULE_KEYS[view]) {
    const tabDef = TAB_DEFINITIONS.find((t) => t.view === view);
    if (!tabDef || tabDef.permission(permissions)) {
      return { view, params };
    }
  }

  // Default to first accessible tab
  const firstTab = TAB_DEFINITIONS.find((t) => t.permission(permissions));
  return { view: firstTab ? firstTab.view : 'receipts', params: {} };
}

let _currentSession = null;

function handleRoute(hash) {
  if (!_currentSession) { return; }
  const { view, params } = resolveView(hash, _currentSession);

  viewTitleEl.textContent = VIEW_LABELS[view] || 'Bodega / QA';
  viewEl.innerHTML = '';

  const moduleKey = VIEW_MODULE_KEYS[view];
  if (!moduleKey || !WarehouseShell.has(moduleKey)) {
    viewEl.innerHTML = '<p class="warehouse-message">Vista no disponible.</p>';
    return;
  }

  try {
    const viewModule = WarehouseShell.require(moduleKey);
    viewModule.render(viewEl, _currentSession, params);
  } catch (_renderErr) {
    viewEl.innerHTML = '<p class="warehouse-error">Error al cargar la vista. Recargue la pagina.</p>';
  }

  updateTabBarActive(view);
}

// -----------------------------------------------------------------------
// Tab bar rendering
// -----------------------------------------------------------------------

function renderTabBar(session) {
  const permissions = session?.user?.permissions || [];
  tabBarEl.innerHTML = '';

  for (const tab of TAB_DEFINITIONS) {
    if (!tab.permission(permissions)) { continue; }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'warehouse-tab';
    btn.dataset.view = tab.view;
    btn.setAttribute('aria-current', 'false');
    btn.innerHTML = `<span class="warehouse-tab__icon" aria-hidden="true">${tab.icon}</span><span class="warehouse-tab__label">${tab.label}</span>`;
    btn.addEventListener('click', () => { navigate(tab.view); });
    tabBarEl.append(btn);
  }

  tabBarEl.hidden = false;
}

function updateTabBarActive(activeView) {
  /** @type {NodeListOf<HTMLButtonElement>} */ (tabBarEl.querySelectorAll('.warehouse-tab')).forEach((btn) => {
    btn.setAttribute('aria-current', btn.dataset.view === activeView ? 'true' : 'false');
  });
}

// -----------------------------------------------------------------------
// Identity slot
// -----------------------------------------------------------------------

function renderIdentity(session) {
  const userName = session?.user?.fullName || session?.user?.username || 'Usuario';
  identitySlotEl.innerHTML = `
    <span class="warehouse-identity__name">${escapeHtml(userName)}</span>
    <button type="button" class="warehouse-identity__logout" id="warehouse-logout-button">Salir</button>
  `;
  identitySlotEl.hidden = false;

  const logoutBtn = document.getElementById('warehouse-logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      inventoryAuth.fetchJson(session, '/api/auth/logout', { method: 'POST' })
        .catch(() => { /* ignore logout errors */ })
        .finally(() => { inventorySession.clearAndRedirectToLogin(); });
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -----------------------------------------------------------------------
// Toast notifications
// -----------------------------------------------------------------------

function showToast(message, tone = 'success') {
  const toast = document.createElement('div');
  toast.className = `warehouse-toast warehouse-toast--${tone}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  toastContainerEl.append(toast);
  setTimeout(() => { toast.remove(); }, 4000);
}

// -----------------------------------------------------------------------
// Status helpers
// -----------------------------------------------------------------------

function setStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = '';
}

// -----------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------

async function bootstrap() {
  setStatus('Validando sesion...');

  let session = null;
  try {
    session = await inventoryAuth.bootstrapSession();
  } catch (_err) {
    window.location.replace(LOGIN_PATH);
    return;
  }

  if (!session) {
    window.location.replace(LOGIN_PATH);
    return;
  }

  const permissions = session?.user?.permissions || [];
  if (!permissions.includes('warehouse.access')) {
    window.location.replace(NO_ACCESS_PATH);
    return;
  }

  _currentSession = session;
  clearStatus();
  renderIdentity(session);
  renderTabBar(session);
  handleRoute(window.location.hash);

  window.addEventListener('hashchange', () => { handleRoute(window.location.hash); });
}

// -----------------------------------------------------------------------
// Public API registered in the shell
// -----------------------------------------------------------------------

WarehouseShell.register('app', {
  navigate,
  showToast,
  escapeHtml,
  bootstrap,
  getCurrentSession: () => _currentSession,
});

})(/* self-contained IIFE */);
