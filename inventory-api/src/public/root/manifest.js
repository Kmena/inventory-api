(function attachRootShellManifest(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const guards = rootShell.require('guards');

  function createRouteItem({
    id,
    label,
    routeKey,
    href,
    implemented,
    activeMatchers = [],
    visibilityRule,
    actorScope,
    destination = implemented ? 'implemented' : 'in_process',
    icon = null,
    notification = null,
    disabled = false,
    includeInRootNav = false,
    includeInLanding = true,
    dependencyTag = 'sidebar-rebrand-permissions',
  }) {
    return {
      id,
      label,
      routeKey,
      href,
      implemented,
      activeMatchers,
      visibilityRule,
      actorScope,
      destination,
      icon,
      notification,
      disabled,
      includeInRootNav,
      includeInLanding,
      dependencyTag,
    };
  }

  function createAdminPendingEntry(id, label, icon, options = {}) {
    const routeKey = options.routeKey || id.replaceAll('-', '_');
    return createRouteItem({
      id,
      label,
      routeKey,
      href: `/root/#${routeKey}`,
      implemented: false,
      activeMatchers: [routeKey],
      visibilityRule: guards.isCompanyAdmin,
      actorScope: 'company-admin',
      icon,
      disabled: false,
      notification: null,
      includeInRootNav: false,
      includeInLanding: true,
      ...options,
    });
  }

  const homeItem = createRouteItem({
    id: 'home',
    label: 'Inicio',
    routeKey: 'home',
    href: '/root/#home',
    implemented: true,
    activeMatchers: ['home'],
    visibilityRule: guards.isRootUser,
    actorScope: 'root-global',
    includeInRootNav: true,
    dependencyTag: 'p27-local-shell',
  });

  const companiesItem = createRouteItem({
    id: 'companies',
    label: 'Empresas',
    routeKey: 'companies',
    href: '/root/#companies',
    implemented: true,
    activeMatchers: ['companies'],
    visibilityRule: guards.isRootUser,
    actorScope: 'root-global',
    includeInRootNav: true,
    dependencyTag: 'p37-root-companies-admin',
  });

  const adminHomeItem = createAdminPendingEntry('admin-home', 'Inicio', 'house', {
    routeKey: 'admin_home',
  });
  const productsItem = createAdminPendingEntry('products', 'Productos', 'package');
  const lotsItem = createAdminPendingEntry('lots', 'Lotes', 'layers-3');
  const movementsItem = createAdminPendingEntry('movements', 'Movimientos', 'arrow-left-right');
  const productionItem = createAdminPendingEntry('production', 'Produccion', 'factory');
  const agentsItem = createRouteItem({
    id: 'agents',
    label: 'Agentes',
    routeKey: 'agents',
    href: '/root/#agents',
    implemented: true,
    activeMatchers: ['agents'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'users-round',
    includeInRootNav: false,
    dependencyTag: 'root-shell-commercial-views',
  });
  const routesItem = createRouteItem({
    id: 'routes',
    label: 'Rutas',
    routeKey: 'routes',
    href: '/root/#routes',
    implemented: true,
    activeMatchers: ['routes'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'map',
    includeInRootNav: false,
    dependencyTag: 'root-shell-commercial-views',
  });
  const zonesItem = createRouteItem({
    id: 'zones',
    label: 'Zonas',
    routeKey: 'zones',
    href: '/root/#zones',
    implemented: true,
    activeMatchers: ['zones'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'map-pinned',
    includeInRootNav: false,
    dependencyTag: 'zones-view',
  });
  const clientsItem = createRouteItem({
    id: 'clients',
    label: 'Clientes',
    routeKey: 'clients',
    href: '/root/#clients',
    implemented: true,
    activeMatchers: ['clients'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'briefcase-business',
    includeInRootNav: false,
    dependencyTag: 'root-shell-commercial-views',
  });
  const purchasesItem = createAdminPendingEntry('purchases', 'Compras', 'shopping-bag');
  const warehousesItem = createAdminPendingEntry('warehouses', 'Bodegas', 'warehouse');
  const approvalsItem = createAdminPendingEntry('approvals', 'Aprobaciones', 'badge-check');
  const reportsItem = createAdminPendingEntry('reports', 'Reportes', 'bar-chart-3');
  const usersItem = createAdminPendingEntry('users', 'Usuarios', 'user-cog');
  const settingsItem = createAdminPendingEntry('settings', 'Configuracion', 'settings');

  const rolesPermissionsItem = createRouteItem({
    id: 'roles-permissions',
    label: 'Roles y permisos',
    routeKey: 'roles_permissions',
    href: '/root/#roles_permissions',
    implemented: true,
    activeMatchers: ['roles_permissions'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'shield-check',
    includeInRootNav: false,
    dependencyTag: 'p37-root-roles-admin',
  });

  const genericInProcessItem = createRouteItem({
    id: 'in-process',
    label: 'Pendientes',
    routeKey: 'in_process',
    href: '/root/#in_process',
    implemented: false,
    activeMatchers: ['in_process'],
    visibilityRule: guards.isEligibleRootShellSession,
    actorScope: 'shared-shell',
    includeInRootNav: false,
    includeInLanding: false,
    dependencyTag: 'p27-local-shell',
  });

  const items = [
    homeItem,
    companiesItem,
    adminHomeItem,
    productsItem,
    lotsItem,
    movementsItem,
    productionItem,
    agentsItem,
    routesItem,
    zonesItem,
    clientsItem,
    purchasesItem,
    warehousesItem,
    approvalsItem,
    reportsItem,
    usersItem,
    rolesPermissionsItem,
    settingsItem,
    genericInProcessItem,
  ];

  const topNavItems = [homeItem, companiesItem];

  const adminSidebarSections = [
    {
      id: 'home',
      title: null,
      visibilityRule: guards.isCompanyAdmin,
      entries: [
        {
          type: 'item',
          ...adminHomeItem,
        },
      ],
    },
    {
      id: 'operations',
      title: 'Operacion',
      visibilityRule: guards.isCompanyAdmin,
      entries: [
        {
          type: 'group',
          id: 'inventory-group',
          label: 'Inventario',
          icon: 'boxes',
          visibilityRule: guards.isCompanyAdmin,
          actorScope: 'company-admin',
          items: [
            { type: 'item', ...productsItem },
            { type: 'item', ...lotsItem },
            { type: 'item', ...movementsItem },
          ],
        },
        { type: 'item', ...productionItem },
        {
          type: 'group',
          id: 'sales-group',
          label: 'Ventas',
          icon: 'shopping-cart',
          visibilityRule: guards.isCompanyAdmin,
          actorScope: 'company-admin',
          items: [
            { type: 'item', ...agentsItem },
            { type: 'item', ...routesItem },
            { type: 'item', ...zonesItem },
            { type: 'item', ...clientsItem },
          ],
        },
        { type: 'item', ...purchasesItem },
      ],
    },
    {
      id: 'control',
      title: 'Control',
      visibilityRule: guards.isCompanyAdmin,
      entries: [
        { type: 'item', ...warehousesItem },
        { type: 'item', ...approvalsItem },
        { type: 'item', ...reportsItem },
      ],
    },
    {
      id: 'administration',
      title: 'Administracion',
      visibilityRule: guards.isCompanyAdmin,
      entries: [
        { type: 'item', ...usersItem },
        { type: 'item', ...rolesPermissionsItem },
        { type: 'item', ...settingsItem },
      ],
    },
  ];

  rootShell.register('manifest', {
    adminSidebarSections,
    items,
    topNavItems,
  });
}(window));
