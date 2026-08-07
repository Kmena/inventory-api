(() => {
'use strict';

const inventoryAuth = /** @type {any} */ (window).InventoryAuth;

// ─── Namespace AgentShell ────────────────────────────────────────────────────

const _registry = Object.create(null);

const AgentShell = {
  /**
   * Registra un módulo con el nombre dado.
   * @param {string} name
   * @param {any} module
   */
  register(name, module) {
    _registry[name] = module;
  },

  /**
   * Retorna un módulo registrado o lanza un error descriptivo.
   * @param {string} name
   * @returns {any}
   */
  require(name) {
    if (!(name in _registry)) {
      throw new Error(`AgentShell: módulo "${name}" no está registrado. Verifica el orden de scripts en index.html.`);
    }
    return _registry[name];
  },
};

/** @type {any} */ (window).AgentShell = AgentShell;

// ─── Router de hash ──────────────────────────────────────────────────────────

/**
 * Parsea el hash de la URL al formato { view, params }.
 * Ejemplo: "#store-detail?storeId=99" → { view: "store-detail", params: { storeId: "99" } }
 * @param {string} hash
 * @returns {{ view: string, params: Record<string, string> }}
 */
function parseHashRoute(hash) {
  const withoutHash = (hash || '').replace(/^#/, '');
  const [viewPart, queryPart] = withoutHash.split('?');
  const view = viewPart || 'dashboard';
  const params = queryPart ? Object.fromEntries(new URLSearchParams(queryPart)) : {};
  return { view, params };
}

/**
 * Navega a una vista con parámetros opcionales actualizando el hash.
 * @param {string} view
 * @param {Record<string, string|number>} [params]
 */
function navigate(view, params = {}) {
  const entries = Object.entries(params);
  const query = entries.length > 0 ? '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  window.location.hash = `#${view}${query}`;
}

AgentShell.register('navigate', navigate);

// ─── Mapa de nombres de hash a claves de módulo ──────────────────────────────

const VIEW_MODULE_KEYS = {
  'dashboard':     'views.dashboard',
  'store-detail':  'views.storeDetail',
  'visit':         'views.visit',
  'order':         'views.orderEntry',
  'goals':         'views.goals',
  'map':           'views.map',
};

// ─── Manejador de ruta ───────────────────────────────────────────────────────

/**
 * Resuelve el hash actual, limpia el contenedor y monta la vista correspondiente.
 * @param {any} session
 */
async function handleRoute(session) {
  const { view, params } = parseHashRoute(window.location.hash);
  const moduleKey = VIEW_MODULE_KEYS[view] || VIEW_MODULE_KEYS['dashboard'];

  const container = /** @type {HTMLElement} */ (document.getElementById('agent-main'));
  if (!container) {
    return;
  }

  container.innerHTML = '';

  let viewModule;
  try {
    viewModule = AgentShell.require(moduleKey);
  } catch (_err) {
    // Hash desconocido: carga el Dashboard sin error
    viewModule = AgentShell.require('views.dashboard');
  }

  await viewModule.render(container, session, params);
}

// ─── Bootstrapper ────────────────────────────────────────────────────────────

async function bootstrap() {
  const session = await inventoryAuth.bootstrapSession();

  if (!session || !session.user || !session.user.companyId) {
    window.location.href = '/';
    return;
  }

  // Persiste la sesión en el módulo de estado (state.js se registra después de app.js)
  try {
    const state = AgentShell.require('state');
    state.setSession(session);
  } catch (_err) {
    // state.js puede no estar registrado aún en el orden de carga (no bloqueante)
  }

  await handleRoute(session);
}

window.addEventListener('hashchange', async () => {
  let session;
  try {
    const state = AgentShell.require('state');
    session = state.getSession();
  } catch (_err) {
    session = null;
  }

  if (!session) {
    window.location.href = '/';
    return;
  }

  await handleRoute(session);
});

// ─── Exposición pública ───────────────────────────────────────────────────────

/** @type {any} */ (window).AgentApp = { bootstrap };

})();
