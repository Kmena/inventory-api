(function attachRootShellManifest(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const guards = rootShell.require('guards');
  const isProcurementOrAdmin = (session) =>
    guards.isCompanyAdmin(session) || guards.hasProcurementAccess(session);

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
  const productsItem = createRouteItem({
    id: 'products',
    label: 'Productos',
    routeKey: 'products',
    href: '/root/#products',
    implemented: true,
    activeMatchers: ['products'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'package',
    includeInRootNav: false,
    dependencyTag: 'inventory-admin-views',
  });
  const lotsItem = createRouteItem({
    id: 'lots',
    label: 'Lotes',
    routeKey: 'lots',
    href: '/root/#lots',
    implemented: true,
    activeMatchers: ['lots'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'layers-3',
    includeInRootNav: false,
    dependencyTag: 'inventory-admin-views',
  });
  const movementsItem = createRouteItem({
    id: 'movements',
    label: 'Movimientos',
    routeKey: 'movements',
    href: '/root/#movements',
    implemented: true,
    activeMatchers: ['movements'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'arrow-left-right',
    includeInRootNav: false,
    dependencyTag: 'inventory-admin-views',
  });
  // Legacy standalone — kept for routing backward-compat (sidebar replaced by produccion-group)
  const productionItem = createAdminPendingEntry('production', 'Produccion', 'factory');

  // TASK-016: Supply/Procurement module — produccion-group sub-entries
  const recipesAdminItem = createRouteItem({
    id: 'recetas',
    label: 'Recetas',
    routeKey: 'recetas',
    href: '/root/#recetas',
    implemented: true,
    activeMatchers: ['recetas'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'flask-conical',
    includeInRootNav: false,
    dependencyTag: 'supply-inventory-entry',
  });
  const productionOrdersAdminItem = createRouteItem({
    id: 'produccion-ordenes',
    label: 'Ordenes de produccion',
    routeKey: 'produccion_ordenes',
    href: '/root/#produccion_ordenes',
    implemented: true,
    activeMatchers: ['produccion_ordenes'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'clipboard-list',
    includeInRootNav: false,
    dependencyTag: 'supply-inventory-entry',
  });
  const productionPlannerItem = createRouteItem({
    id: 'produccion-planificador',
    label: 'Planificador de produccion',
    routeKey: 'produccion_planificador',
    href: '/root/#produccion_planificador',
    implemented: true,
    activeMatchers: ['produccion_planificador'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'gauge',
    includeInRootNav: false,
    dependencyTag: 'production-planner',
  });

  // TASK-016: Supply/Procurement module — compras-group sub-entries (in procurement flow order)
  const suppliersAdminItem = createRouteItem({
    id: 'proveedores',
    label: 'Proveedores',
    routeKey: 'proveedores',
    href: '/root/#proveedores',
    implemented: true,
    activeMatchers: ['proveedores'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'truck',
    includeInRootNav: false,
    dependencyTag: 'supply-inventory-entry',
  });
  const purchaseRequestsAdminItem = createRouteItem({
    id: 'solicitudes-compra',
    label: 'Solicitudes de compra',
    routeKey: 'solicitudes_compra',
    href: '/root/#solicitudes_compra',
    implemented: true,
    activeMatchers: ['solicitudes_compra'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'file-plus',
    includeInRootNav: false,
    dependencyTag: 'purchase-orders-workspace',
  });
  const quotationsAdminItem = createRouteItem({
    id: 'cotizaciones',
    label: 'Cotizaciones',
    routeKey: 'cotizaciones',
    href: '/root/#cotizaciones',
    implemented: true,
    activeMatchers: ['cotizaciones'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'file-search',
    includeInRootNav: false,
    dependencyTag: 'supply-inventory-entry',
  });
  const rfqTrackingAdminItem = createRouteItem({
    id: 'seguimiento-cotizaciones',
    label: 'Seguimiento de cotizaciones',
    routeKey: 'seguimiento_cotizaciones',
    href: '/root/#seguimiento_cotizaciones',
    implemented: true,
    activeMatchers: ['seguimiento_cotizaciones'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'clipboard-list',
    includeInRootNav: false,
    dependencyTag: 'supplier-rfq-requests',
  });
  const purchaseOrdersAdminItem = createRouteItem({
    id: 'ordenes-compra',
    label: 'Ordenes de compra',
    routeKey: 'ordenes_compra',
    href: '/root/#ordenes_compra',
    implemented: true,
    activeMatchers: ['ordenes_compra'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'file-check-2',
    includeInRootNav: false,
    dependencyTag: 'purchase-orders-workspace',
  });
  // recepciones-fiscales-workspace: promoted to implemented
  const receiptsAdminItem = createRouteItem({
    id: 'recepciones',
    label: 'Recepciones',
    routeKey: 'recepciones',
    href: '/root/#recepciones',
    implemented: true,
    activeMatchers: ['recepciones'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'package-check',
    includeInRootNav: false,
    dependencyTag: 'recepciones-fiscales-workspace',
  });
  const fiscalRefsAdminItem = createRouteItem({
    id: 'referencias-fiscales',
    label: 'Ref. Fiscales',
    routeKey: 'referencias_fiscales',
    href: '/root/#referencias_fiscales',
    implemented: true,
    activeMatchers: ['referencias_fiscales'],
    visibilityRule: isProcurementOrAdmin,
    actorScope: 'company-admin',
    icon: 'landmark',
    includeInRootNav: false,
    dependencyTag: 'recepciones-fiscales-workspace',
  });

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
  const warehousesItem = createRouteItem({
    id: 'warehouses',
    label: 'Bodegas',
    routeKey: 'warehouses',
    href: '/root/#warehouses',
    implemented: true,
    activeMatchers: ['warehouses'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'warehouse',
    includeInRootNav: false,
    dependencyTag: 'inventory-admin-views',
  });
  // TASK-012: Billing view — client-payment-ledger feature
  const billingItem = createRouteItem({
    id: 'billing',
    label: 'Facturación',
    routeKey: 'billing',
    href: '/root/#billing',
    implemented: true,
    activeMatchers: ['billing'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'receipt',
    includeInRootNav: false,
    dependencyTag: 'client-payment-ledger',
  });
  const approvalsItem = createRouteItem({
    id: 'approvals',
    label: 'Aprobaciones',
    routeKey: 'approvals',
    href: '/root/#approvals',
    implemented: true,
    activeMatchers: ['approvals'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'badge-check',
    includeInRootNav: false,
    dependencyTag: 'order-approvals',
  });
  const reportsItem = createAdminPendingEntry('reports', 'Reportes', 'bar-chart-3');
  const usersItem = createRouteItem({
    id: 'users',
    label: 'Usuarios',
    routeKey: 'users',
    href: '/root/#users',
    implemented: true,
    activeMatchers: ['users'],
    visibilityRule: guards.isCompanyAdmin,
    actorScope: 'company-admin',
    icon: 'user-cog',
    includeInRootNav: false,
    includeInLanding: true,
    dependencyTag: 'users-admin-view',
  });
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
    // Legacy standalone kept for routing backward-compat (replaced in sidebar by produccion-group)
    productionItem,
    recipesAdminItem,
    productionOrdersAdminItem,
    productionPlannerItem,
    agentsItem,
    routesItem,
    zonesItem,
    clientsItem,
    // Legacy standalone kept for routing backward-compat (replaced in sidebar by compras-group)
    purchasesItem,
    suppliersAdminItem,
    purchaseRequestsAdminItem,
    quotationsAdminItem,
    rfqTrackingAdminItem,
    purchaseOrdersAdminItem,
    receiptsAdminItem,
    fiscalRefsAdminItem,
    warehousesItem,
    billingItem,
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
      visibilityRule: isProcurementOrAdmin,
      entries: [
        {
          type: 'group',
          id: 'inventory-group',
          label: 'Inventario',
          icon: 'boxes',
          visibilityRule: isProcurementOrAdmin,
          actorScope: 'company-admin',
          items: [
            { type: 'item', ...warehousesItem },
            { type: 'item', ...productsItem },
            { type: 'item', ...lotsItem },
            { type: 'item', ...movementsItem },
          ],
        },
        // TASK-016: produccion-group (replaces standalone productionItem in sidebar)
        {
          type: 'group',
          id: 'produccion-group',
          label: 'Produccion',
          icon: 'factory',
          visibilityRule: guards.isCompanyAdmin,
          actorScope: 'company-admin',
          items: [
            { type: 'item', ...recipesAdminItem },
            { type: 'item', ...productionOrdersAdminItem },
            { type: 'item', ...productionPlannerItem },
          ],
        },
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
        // TASK-016: compras-group (replaces standalone purchasesItem in sidebar)
        {
          type: 'group',
          id: 'compras-group',
          label: 'Compras',
          icon: 'shopping-bag',
          visibilityRule: isProcurementOrAdmin,
          actorScope: 'company-admin',
          items: [
            { type: 'item', ...suppliersAdminItem },
            { type: 'item', ...purchaseRequestsAdminItem },
            { type: 'item', ...quotationsAdminItem },
            { type: 'item', ...rfqTrackingAdminItem },
            { type: 'item', ...purchaseOrdersAdminItem },
            { type: 'item', ...receiptsAdminItem },
            { type: 'item', ...fiscalRefsAdminItem },
          ],
        },
      ],
    },
    {
      id: 'control',
      title: 'Control',
      visibilityRule: guards.isCompanyAdmin,
      entries: [
        { type: 'item', ...billingItem },
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
