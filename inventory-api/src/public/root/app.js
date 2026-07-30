(() => {
const inventoryAuth = /** @type {any} */ (window).InventoryAuth;
const inventorySession = /** @type {any} */ (window).InventorySession;
const rootShell = /** @type {any} */ (window).RootShell;
const rootShellSessionAdapter = rootShell.require('sessionAdapter');
const rootShellGuards = rootShell.require('guards');
const rootShellManifest = rootShell.require('manifest');
const rootShellRouter = rootShell.require('router');

const statusElement = /** @type {HTMLElement | null} */ (document.getElementById('root-shell-status'));
const viewElement = /** @type {HTMLElement | null} */ (document.getElementById('root-view'));
const userNameElement = /** @type {HTMLElement | null} */ (document.getElementById('root-user-name'));
const userRoleElement = /** @type {HTMLElement | null} */ (document.getElementById('root-user-role'));
const logoutButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('root-logout-button'));
const navLinksElement = /** @type {HTMLElement | null} */ (document.getElementById('root-nav-links'));
const mainElement = /** @type {HTMLElement | null} */ (document.getElementById('root-main'));

if (!statusElement || !viewElement || !userNameElement || !userRoleElement || !logoutButton || !navLinksElement || !mainElement) {
  throw new Error('No se encontraron los elementos base del shell root.');
}

let activeSession = null;

function setStatus(message, tone = 'default') {
  statusElement.textContent = message;
  statusElement.className = 'root-status';
  if (tone !== 'default') {
    statusElement.classList.add(`root-status--${tone}`);
  }
}

function updateIdentity(session) {
  userNameElement.textContent = session?.user?.fullName || session?.user?.username || 'Usuario';
  userRoleElement.textContent = rootShellSessionAdapter.getActorType(session) === 'company-admin'
    ? 'Administrador de empresa'
    : 'Acceso root';
}

function renderNavigation(session) {
  const visibleItems = rootShellManifest.items.filter((item) => rootShellGuards.canAccessRoute(session, item));
  navLinksElement.innerHTML = visibleItems
    .map((item) => `<a class="root-nav__link" data-route-link href="${item.href}">${item.label}</a>`)
    .join('');
}

function updateNavigation(routeKey) {
  const routeLinks = Array.from(navLinksElement.querySelectorAll('[data-route-link]'));

  for (const link of routeLinks) {
    const normalizedHref = link.getAttribute('href') || '';
    const isActive = normalizedHref.endsWith(`#${routeKey}`);
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

async function renderCurrentRoute() {
  const routeResolution = rootShellRouter.resolveRoute(window.location.hash, activeSession);
  const routeKey = routeResolution.routeKey;

  if (`#${routeKey}` !== window.location.hash) {
    window.history.replaceState(null, '', `/root/#${routeKey}`);
  }

  viewElement.innerHTML = rootShellRouter.renderRoute(routeResolution, activeSession);
  updateNavigation(routeKey);

  if (typeof routeResolution.view.mount === 'function') {
    await routeResolution.view.mount(viewElement, activeSession, {
      setShellStatus: setStatus,
    });
  }

  const routeHeading = viewElement.querySelector('#root-view-title');
  if (routeHeading instanceof HTMLElement) {
    routeHeading.setAttribute('tabindex', '-1');
    routeHeading.focus();
  } else {
    mainElement.focus();
  }
}

function redirectForAccess(accessResolution) {
  if (accessResolution.redirect === '/') {
    inventorySession.redirectToLogin(accessResolution.reason);
    return;
  }

  window.location.href = accessResolution.redirect;
}

async function bootstrapRootShell() {
  const snapshotSession = rootShellSessionAdapter.readSnapshot();
  if (snapshotSession?.user) {
    updateIdentity(snapshotSession);
  }

  setStatus('Validando sesion...');

  let bootstrappedSession = null;
  try {
    bootstrappedSession = await rootShellSessionAdapter.bootstrap();
  } catch (error) {
    setStatus(error.message || 'No se pudo validar la sesion del panel root.', 'error');
    return;
  }

  const effectiveSession = bootstrappedSession || snapshotSession;
  const accessResolution = rootShellGuards.resolveShellAccess(effectiveSession);
  if (!accessResolution.allowed) {
    redirectForAccess(accessResolution);
    return;
  }

  activeSession = effectiveSession;
  updateIdentity(effectiveSession);
  renderNavigation(effectiveSession);
  setStatus('Sesion lista.');
  await renderCurrentRoute();
}

window.addEventListener('hashchange', async () => {
  if (!activeSession) {
    return;
  }

  await renderCurrentRoute();
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Cerrando sesion...';
  await inventoryAuth.logout(activeSession, {
    headers: {
      'X-Inventory-Browser-Session': 'cookie',
    },
  });
});

for (const item of rootShellManifest.items) {
  if (typeof item.visibilityRule !== 'function' || !item.routeKey) {
    throw new Error('El manifest del shell root contiene una configuracion invalida.');
  }
}

bootstrapRootShell();
})();
