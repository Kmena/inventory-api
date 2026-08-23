(() => {
const inventoryAuth = /** @type {any} */ (window).InventoryAuth;
const inventorySession = /** @type {any} */ (window).InventorySession;
const rootShell = /** @type {any} */ (window).RootShell;
const runtimeContract = rootShell.require('runtimeContract');
const [rootShellSessionAdapter, rootShellGuards, rootShellManifest, rootShellRouter] = runtimeContract.requireModules(runtimeContract.bootstrapModuleNames);

const shellElement = /** @type {HTMLElement | null} */ (document.querySelector('.root-shell'));
const statusElement = /** @type {HTMLElement | null} */ (document.getElementById('root-shell-status'));
const viewElement = /** @type {HTMLElement | null} */ (document.getElementById('root-view'));
const userNameElement = /** @type {HTMLElement | null} */ (document.getElementById('root-user-name'));
const userRoleElement = /** @type {HTMLElement | null} */ (document.getElementById('root-user-role'));
const identityBlock = /** @type {HTMLElement | null} */ (document.getElementById('root-identity-block'));
const logoutButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('root-logout-button'));
const navElement = /** @type {HTMLElement | null} */ (document.getElementById('root-nav'));
const navLinksElement = /** @type {HTMLElement | null} */ (document.getElementById('root-nav-links'));
const adminSidebar = /** @type {HTMLElement | null} */ (document.getElementById('root-admin-sidebar'));
const adminNavElement = /** @type {HTMLElement | null} */ (document.getElementById('root-admin-nav'));
const mainElement = /** @type {HTMLElement | null} */ (document.getElementById('root-main'));
const overlayElement = /** @type {HTMLElement | null} */ (document.getElementById('root-sidebar-overlay'));
const drawerButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('root-sidebar-drawer-button'));
const collapseButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('root-sidebar-collapse-button'));
const headerIdentitySlot = /** @type {HTMLElement | null} */ (document.getElementById('root-identity-slot-header'));
const sidebarIdentitySlot = /** @type {HTMLElement | null} */ (document.getElementById('root-identity-slot-sidebar'));
const rootLogoutSlot = /** @type {HTMLElement | null} */ (document.getElementById('root-logout-slot-root'));
const sidebarLogoutSlot = /** @type {HTMLElement | null} */ (document.getElementById('root-logout-slot-sidebar'));

if (!shellElement || !statusElement || !viewElement || !userNameElement || !userRoleElement || !identityBlock || !logoutButton || !navElement || !navLinksElement || !adminSidebar || !adminNavElement || !mainElement || !overlayElement || !drawerButton || !collapseButton || !headerIdentitySlot || !sidebarIdentitySlot || !rootLogoutSlot || !sidebarLogoutSlot) {
  throw new Error('No se encontraron los elementos base del shell root.');
}

let activeSession = null;
let lastDrawerFocusTarget = null;
let activeSidebarEntryId = null;
const sidebarState = {
  collapsed: false,
  drawerOpen: false,
  openGroups: new Set(['inventory-group', 'sales-group', 'produccion-group', 'compras-group']),
};

function setStatus(message, tone = 'default') {
  statusElement.textContent = message;
  statusElement.className = 'root-status';
  if (tone !== 'default') {
    statusElement.classList.add(`root-status--${tone}`);
  }
}

function getActorType(session) {
  return rootShellSessionAdapter.getActorType(session);
}

function isCompanyAdminShell(session) {
  return getActorType(session) === 'company-admin';
}

function setShellActor(session) {
  shellElement.dataset.shellActor = isCompanyAdminShell(session) ? 'company-admin' : 'root';
}

function updateIdentity(session) {
  userNameElement.textContent = session?.user?.fullName || session?.user?.username || 'Usuario';
  userRoleElement.textContent = isCompanyAdminShell(session)
    ? 'Administrador de empresa'
    : 'Acceso root';
}

function moveShellFurniture(session) {
  identityBlock.hidden = false;
  logoutButton.hidden = false;

  if (isCompanyAdminShell(session)) {
    sidebarIdentitySlot.append(identityBlock);
    sidebarLogoutSlot.append(logoutButton);
    logoutButton.className = 'root-sidebar__logout';
  } else {
    headerIdentitySlot.append(identityBlock);
    rootLogoutSlot.append(logoutButton);
    logoutButton.className = 'secondary-button root-nav__logout';
  }
}

function renderNavigation(session) {
  const visibleItems = rootShellManifest.topNavItems.filter((item) => rootShellGuards.canAccessRoute(session, item));
  navLinksElement.innerHTML = visibleItems
    .map((item) => `<a class="root-nav__link" data-route-link href="${item.href}">${item.label}</a>`)
    .join('');
}

function filterVisibleAdminEntries(entries, session) {
  return entries.filter((entry) => {
    if (typeof entry.visibilityRule === 'function' && !entry.visibilityRule(session)) {
      return false;
    }

    if (entry.type === 'group') {
      const visibleChildren = filterVisibleAdminEntries(entry.items || [], session);
      return visibleChildren.length > 0;
    }

    return true;
  });
}

function normalizeTooltipId(value) {
  return `root-sidebar-tooltip-${String(value || 'item').replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function renderIcon(iconName) {
  const iconPaths = {
    'arrow-left-right': '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    'badge-check': '<path d="M16.3 9a4 4 0 1 0 0 6"/><path d="M12 3l1.9 1.9 2.7-.4.4 2.7L19 9l-1.9 1.9.4 2.7-2.7.4L13 16l-1-1"/><path d="m16 14 2 2 4-4"/>',
    'bar-chart-3': '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'boxes': '<path d="M2.97 7.27 12 2l9.03 5.27"/><path d="M3 7v10l9 5 9-5V7"/><path d="m12 22 0-10"/><path d="m7 4.5 10 5.5"/>',
    'briefcase-business': '<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v2"/><path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 12h18"/>',
    factory: '<path d="M2 20h20"/><path d="M5 20V10l5 3V8l5 3V5l4 2v13"/><path d="M9 20v-4"/><path d="M14 20v-3"/>',
    house: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    'layers-3': '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    'map-pinned': '<path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.4l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 20.6 7.04l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.72a2 2 0 0 0 2-1.62L23 6H6"/>',
    'user-cog': '<circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><path d="m19.5 10.5.6 1.1 1.2.3-.8.9.1 1.2-1.1-.5-1.1.5.1-1.2-.8-.9 1.2-.3Z"/>',
    'users-round': '<path d="M18 21a8 8 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><path d="M22 21a8 8 0 0 0-4-6.92"/><path d="M2 21a8 8 0 0 1 4-6.92"/>',
    warehouse: '<path d="M3 10 12 4l9 6v10H3V10Z"/><path d="M3 10h18"/><path d="M8 14h8"/><path d="M8 18h8"/>',
  };

  const iconMarkup = iconPaths[iconName] || '<circle cx="12" cy="12" r="8"/>';
  return `<svg class="root-sidebar__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconMarkup}</svg>`;
}

function entryMatchesRoute(entry, routeKey) {
  if (!entry) {
    return false;
  }

  const routeMatchers = Array.isArray(entry.activeMatchers) ? entry.activeMatchers : [];
  if (entry.routeKey === routeKey || routeMatchers.includes(routeKey)) {
    return true;
  }

  if (entry.type === 'group') {
    return Array.isArray(entry.items) && entry.items.some((child) => entryMatchesRoute(child, routeKey));
  }

  return false;
}

function isGroupExpanded(groupId, routeKey, groupEntry) {
  if (sidebarState.openGroups.has(groupId)) {
    return true;
  }

  return entryMatchesRoute(groupEntry, routeKey);
}

function renderAdminNavEntry(entry, routeKey, depth = 0) {
  if (entry.type === 'group') {
    const groupId = entry.id;
    const expanded = isGroupExpanded(groupId, routeKey, entry);
    const visibleChildren = filterVisibleAdminEntries(entry.items || [], activeSession);
    const childMarkup = visibleChildren.map((child) => renderAdminNavEntry(child, routeKey, depth + 1)).join('');
    const tooltipId = normalizeTooltipId(groupId);

    return `
      <div class="root-sidebar__group ${expanded ? 'expanded' : ''}" data-sidebar-group="${groupId}">
        <button class="root-sidebar__link root-sidebar__link--group" type="button" data-sidebar-group-toggle="${groupId}" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${groupId}-panel" aria-label="${entry.label}">
          <span class="root-sidebar__icon">${renderIcon(entry.icon)}</span>
          <span class="root-sidebar__label">${entry.label}</span>
          <span class="root-sidebar__chevron" aria-hidden="true">▾</span>
          <span id="${tooltipId}" class="root-sidebar__tooltip" role="tooltip" aria-hidden="true">${entry.label}</span>
        </button>
        <div id="${groupId}-panel" class="root-sidebar__subnav" ${expanded ? '' : 'hidden'}>
          ${childMarkup}
        </div>
      </div>
    `;
  }

  const routeMatchers = Array.isArray(entry.activeMatchers) ? entry.activeMatchers : [];
  const isActive = entry.routeKey === routeKey || routeMatchers.includes(routeKey) || activeSidebarEntryId === entry.id;
  const tooltipId = normalizeTooltipId(entry.id);
  const linkClasses = ['root-sidebar__link'];
  if (depth > 0) {
    linkClasses.push('root-sidebar__link--child');
  }
  if (isActive) {
    linkClasses.push('active');
  }
  if (!entry.implemented) {
    linkClasses.push('root-sidebar__link--pending');
  }

  return `
    <a class="${linkClasses.join(' ')}" data-sidebar-entry-id="${entry.id}" data-sidebar-route-key="${entry.routeKey}" data-route-link href="${entry.href}" ${isActive ? 'aria-current="page"' : ''} aria-label="${entry.label}">
      <span class="root-sidebar__icon">${renderIcon(entry.icon)}</span>
      <span class="root-sidebar__label">${entry.label}</span>
      <span id="${tooltipId}" class="root-sidebar__tooltip" role="tooltip">${entry.label}</span>
    </a>
  `;
}

function renderAdminNavigation(session, routeKey) {
  const visibleSections = rootShellManifest.adminSidebarSections.filter((section) => {
    return typeof section.visibilityRule !== 'function' || section.visibilityRule(session);
  });

  adminNavElement.innerHTML = visibleSections.map((section) => {
    const visibleEntries = filterVisibleAdminEntries(section.entries || [], session);
    if (!visibleEntries.length) {
      return '';
    }

    return `
      <section class="root-sidebar__section" data-sidebar-section="${section.id}">
        ${section.title ? `<p class="root-sidebar__section-title">${section.title}</p>` : ''}
        <div class="root-sidebar__section-body">
          ${visibleEntries.map((entry) => renderAdminNavEntry(entry, routeKey)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function closeDrawer(options = {}) {
  const { restoreFocus = true } = options;
  sidebarState.drawerOpen = false;
  shellElement.dataset.drawerOpen = 'false';
  overlayElement.hidden = true;
  drawerButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('root-page--drawer-open');

  if (restoreFocus && lastDrawerFocusTarget instanceof HTMLElement) {
    lastDrawerFocusTarget.focus();
  }
}

function openDrawer() {
  lastDrawerFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : drawerButton;
  sidebarState.drawerOpen = true;
  shellElement.dataset.drawerOpen = 'true';
  overlayElement.hidden = false;
  drawerButton.setAttribute('aria-expanded', 'true');
  document.body.classList.add('root-page--drawer-open');

  const firstFocusable = adminNavElement.querySelector('a,button');
  if (firstFocusable instanceof HTMLElement) {
    firstFocusable.focus();
  }
}

function syncSidebarState() {
  shellElement.dataset.sidebarState = sidebarState.collapsed ? 'collapsed' : 'expanded';
  collapseButton.setAttribute('aria-expanded', sidebarState.collapsed ? 'false' : 'true');
  collapseButton.setAttribute('aria-label', sidebarState.collapsed ? 'Expandir navegacion lateral' : 'Colapsar navegacion lateral');
  collapseButton.innerHTML = `<span aria-hidden="true">${sidebarState.collapsed ? '▶' : '◀'}</span>`;
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

  if (activeSession && isCompanyAdminShell(activeSession)) {
    renderAdminNavigation(activeSession, routeKey);
  }
}

async function renderCurrentRoute() {
  const routeResolution = rootShellRouter.resolveRoute(window.location.hash, activeSession);

  if (routeResolution.allowed === false) {
    viewElement.innerHTML = `
      <section class="root-hero" aria-labelledby="root-view-title">
        <h2 id="root-view-title">Sin acceso</h2>
        <p class="muted">No tienes permiso para ver esta sección.</p>
      </section>
    `;
    const accessDeniedHeading = viewElement.querySelector('#root-view-title');
    if (accessDeniedHeading instanceof HTMLElement) {
      accessDeniedHeading.setAttribute('tabindex', '-1');
      accessDeniedHeading.focus();
    }
    return;
  }

  const routeKey = routeResolution.routeKey;
  activeSidebarEntryId = routeResolution.item?.id || null;

  if (`#${routeKey}` !== window.location.hash) {
    window.history.replaceState(null, '', `/root/#${routeKey}`);
  }

  viewElement.dataset.routeKey = routeKey;
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

function bindSidebarInteractions() {
  collapseButton.addEventListener('click', () => {
    if (!activeSession || !isCompanyAdminShell(activeSession)) {
      return;
    }

    sidebarState.collapsed = !sidebarState.collapsed;
    syncSidebarState();
  });

  drawerButton.addEventListener('click', () => {
    if (!activeSession || !isCompanyAdminShell(activeSession)) {
      return;
    }

    if (sidebarState.drawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer();
  });

  overlayElement.addEventListener('click', () => {
    closeDrawer();
  });

  adminNavElement.addEventListener('click', async (event) => {
    const target = event.target;
    const groupToggle = target instanceof HTMLElement ? target.closest('[data-sidebar-group-toggle]') : null;
    if (groupToggle instanceof window.HTMLButtonElement) {
      const groupId = groupToggle.getAttribute('data-sidebar-group-toggle');
      if (!groupId) {
        return;
      }

      if (shellElement.dataset.sidebarState === 'collapsed' && window.matchMedia('(min-width: 768px)').matches) {
        sidebarState.collapsed = false;
        sidebarState.openGroups.add(groupId);
        syncSidebarState();
        updateNavigation(rootShellRouter.resolveRoute(window.location.hash, activeSession).routeKey);
        return;
      }

      if (sidebarState.openGroups.has(groupId)) {
        sidebarState.openGroups.delete(groupId);
      } else {
        sidebarState.openGroups.add(groupId);
      }

      updateNavigation(rootShellRouter.resolveRoute(window.location.hash, activeSession).routeKey);
      return;
    }

    const navLink = target instanceof HTMLElement ? target.closest('[data-sidebar-entry-id]') : null;
    if (!(navLink instanceof window.HTMLAnchorElement)) {
      return;
    }

    activeSidebarEntryId = navLink.getAttribute('data-sidebar-entry-id');
    if (window.matchMedia('(max-width: 767px)').matches) {
      closeDrawer({ restoreFocus: false });
    }

    await Promise.resolve();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebarState.drawerOpen) {
      closeDrawer();
    }
  });
}

function configureShellForActor(session) {
  setShellActor(session);
  moveShellFurniture(session);

  if (isCompanyAdminShell(session)) {
    adminSidebar.hidden = false;
    navElement.hidden = true;
    drawerButton.hidden = false;
    syncSidebarState();
    renderAdminNavigation(session, rootShellRouter.resolveRoute(window.location.hash, session).routeKey);
    return;
  }

  adminSidebar.hidden = true;
  navElement.hidden = false;
  drawerButton.hidden = true;
  closeDrawer({ restoreFocus: false });
  renderNavigation(session);
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
  configureShellForActor(effectiveSession);
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

runtimeContract.assertNavigationItems(rootShellManifest.items);

bindSidebarInteractions();
bootstrapRootShell();
})();
