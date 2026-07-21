const ROOT_SIDEBAR_ITEMS = [
  { href: '/root/dashboard.html', label: 'Dashboard' },
  { href: '/root/users.html', label: 'Usuarios' },
  { href: '/root/roles.html', label: 'Roles' },
  { href: '/root/warehouses.html', label: 'Bodegas' },
  { href: '/root/products.html', label: 'Productos' },
  { href: '/root/zones.html', label: 'Zonas' },
  { href: '/root/routes.html', label: 'Rutas' },
  { href: '/root/clients.html', label: 'Clientes' },
  { href: '/root/invoice-inconsistencies.html', label: 'Revision de facturas' },
];

function getActiveSidebarHref(pathname) {
  if (pathname === '/root/client-detail.html') {
    return '/root/clients.html';
  }

  return pathname;
}

function renderRootSidebar() {
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (!sidebarNav) {
    return;
  }

  const activeHref = getActiveSidebarHref(window.location.pathname);
  sidebarNav.setAttribute('aria-label', 'Navegacion principal');
  sidebarNav.innerHTML = ROOT_SIDEBAR_ITEMS.map((item) => {
    const activeClass = item.href === activeHref ? ' active' : '';
    return `<a class="sidebar-link${activeClass}" href="${item.href}">${item.label}</a>`;
  }).join('');
}

renderRootSidebar();
