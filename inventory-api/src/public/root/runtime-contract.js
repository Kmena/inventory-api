(function attachRootShellRuntimeContract(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const loaderScripts = Object.freeze([
    {
      path: '/shared/session.js',
      category: 'shared-helper',
      registers: [],
      requiresModules: [],
      requiresScripts: [],
    },
    {
      path: '/shared/auth.js',
      category: 'shared-helper',
      registers: [],
      requiresModules: [],
      requiresScripts: [],
    },
    {
      path: '/root/registry.js',
      category: 'registry',
      registers: [],
      requiresModules: [],
      requiresScripts: [],
    },
    {
      path: '/root/runtime-contract.js',
      category: 'contract',
      registers: ['runtimeContract'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/session-adapter.js',
      category: 'provider',
      registers: ['sessionAdapter'],
      requiresModules: [],
      requiresScripts: ['/shared/session.js', '/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/guards.js',
      category: 'provider',
      registers: ['guards'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/manifest.js',
      category: 'provider-consumer',
      registers: ['manifest'],
      requiresModules: ['guards'],
      requiresScripts: ['/root/registry.js', '/root/guards.js'],
    },
    {
      path: '/root/ui.js',
      category: 'provider',
      registers: ['ui'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/companies-api.js',
      category: 'provider',
      registers: ['companiesApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/roles-api.js',
      category: 'provider',
      registers: ['rolesApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/zones-api.js',
      category: 'provider',
      registers: ['zonesApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/agents-api.js',
      category: 'provider',
      registers: ['agentsApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/clients-api.js',
      category: 'provider',
      registers: ['clientsApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/routes-api.js',
      category: 'provider',
      registers: ['routesApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/products-api.js',
      category: 'provider',
      registers: ['productsApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/categories-api.js',
      category: 'provider',
      registers: ['categoriesApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/inventory-api.js',
      category: 'provider',
      registers: ['inventoryApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/warehouses-api.js',
      category: 'provider',
      registers: ['warehousesApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/views/warehouses-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.warehousesAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/warehouses-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.warehousesAdminRenderers'],
      requiresModules: ['ui'],
      requiresScripts: ['/root/registry.js', '/root/ui.js'],
    },
    {
      path: '/root/views/warehouses-admin.js',
      category: 'view-provider',
      registers: ['views.warehousesAdmin'],
      requiresModules: ['warehousesApi', 'ui', 'sessionAdapter', 'views.warehousesAdminHelpers', 'views.warehousesAdminRenderers'],
      requiresScripts: ['/root/registry.js', '/root/warehouses-api.js', '/root/ui.js', '/root/session-adapter.js', '/root/views/warehouses-admin.helpers.js', '/root/views/warehouses-admin.renderers.js'],
    },
    {
      path: '/root/views/products-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.productsAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/products-admin.state.js',
      category: 'view-provider',
      registers: ['views.productsAdminState'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/products-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.productsAdminRenderers'],
      requiresModules: ['ui', 'views.productsAdminHelpers'],
      requiresScripts: ['/root/registry.js', '/root/ui.js', '/root/views/products-admin.helpers.js'],
    },
    {
      path: '/root/views/products-admin.js',
      category: 'view-provider',
      registers: ['views.productsAdmin'],
      requiresModules: ['productsApi', 'categoriesApi', 'ui', 'sessionAdapter', 'views.productsAdminHelpers', 'views.productsAdminRenderers', 'views.productsAdminState'],
      requiresScripts: ['/root/registry.js', '/root/products-api.js', '/root/categories-api.js', '/root/ui.js', '/root/session-adapter.js', '/root/views/products-admin.helpers.js', '/root/views/products-admin.renderers.js', '/root/views/products-admin.state.js'],
    },
    {
      path: '/root/views/lots-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.lotsAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/lots-admin.state.js',
      category: 'view-provider',
      registers: ['views.lotsAdminState'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/lots-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.lotsAdminRenderers'],
      requiresModules: ['ui', 'views.lotsAdminHelpers'],
      requiresScripts: ['/root/registry.js', '/root/ui.js', '/root/views/lots-admin.helpers.js'],
    },
    {
      path: '/root/views/lots-admin.js',
      category: 'view-provider',
      registers: ['views.lotsAdmin'],
      requiresModules: ['inventoryApi', 'productsApi', 'categoriesApi', 'warehousesApi', 'ui', 'sessionAdapter', 'views.lotsAdminHelpers', 'views.lotsAdminRenderers', 'views.lotsAdminState'],
      requiresScripts: ['/root/registry.js', '/root/inventory-api.js', '/root/products-api.js', '/root/categories-api.js', '/root/warehouses-api.js', '/root/ui.js', '/root/session-adapter.js', '/root/views/lots-admin.helpers.js', '/root/views/lots-admin.renderers.js', '/root/views/lots-admin.state.js'],
    },
    {
      path: '/root/views/movements-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.movementsAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/movements-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.movementsAdminRenderers'],
      requiresModules: ['ui', 'views.movementsAdminHelpers'],
      requiresScripts: ['/root/registry.js', '/root/ui.js', '/root/views/movements-admin.helpers.js'],
    },
    {
      path: '/root/views/movements-admin.js',
      category: 'view-provider',
      registers: ['views.movementsAdmin'],
      requiresModules: ['inventoryApi', 'warehousesApi', 'ui', 'sessionAdapter', 'views.movementsAdminHelpers', 'views.movementsAdminRenderers'],
      requiresScripts: ['/root/registry.js', '/root/inventory-api.js', '/root/warehouses-api.js', '/root/ui.js', '/root/session-adapter.js', '/root/views/movements-admin.helpers.js', '/root/views/movements-admin.renderers.js'],
    },
    {
      path: '/root/views/home.js',
      category: 'view-provider',
      registers: ['views.home'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/in-process.js',
      category: 'view-provider',
      registers: ['views.inProcess'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/companies-admin.js',
      category: 'view-provider',
      registers: ['views.companiesAdmin'],
      requiresModules: ['companiesApi', 'ui'],
      requiresScripts: ['/root/registry.js', '/root/companies-api.js', '/root/ui.js'],
    },
    {
      path: '/root/views/roles-admin.js',
      category: 'view-provider',
      registers: ['views.rolesAdmin'],
      requiresModules: ['rolesApi', 'ui'],
      requiresScripts: ['/root/registry.js', '/root/roles-api.js', '/root/ui.js'],
    },
    {
      path: '/root/views/zones-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.zonesAdminHelpers'],
      requiresModules: ['ui'],
      requiresScripts: ['/root/registry.js', '/root/ui.js'],
    },
    {
      path: '/root/views/zones-admin.js',
      category: 'view-provider',
      registers: ['views.zonesAdmin'],
      requiresModules: ['zonesApi', 'ui', 'views.zonesAdminHelpers'],
      requiresScripts: ['/root/registry.js', '/root/zones-api.js', '/root/ui.js', '/root/views/zones-admin.helpers.js'],
    },
    {
      path: '/root/views/agents-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.agentsAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/agents-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.agentsAdminRenderers'],
      requiresModules: ['ui'],
      requiresScripts: ['/root/registry.js', '/root/ui.js'],
    },
    {
      path: '/root/views/agents-admin.js',
      category: 'view-provider',
      registers: ['views.agentsAdmin'],
      requiresModules: ['agentsApi', 'ui', 'views.agentsAdminHelpers', 'views.agentsAdminRenderers'],
      requiresScripts: ['/root/registry.js', '/root/agents-api.js', '/root/ui.js', '/root/views/agents-admin.helpers.js', '/root/views/agents-admin.renderers.js'],
    },
    {
      path: '/root/views/clients-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.clientsAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/clients-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.clientsAdminRenderers'],
      requiresModules: ['ui'],
      requiresScripts: ['/root/registry.js', '/root/ui.js'],
    },
    {
      path: '/root/views/clients-admin.state.js',
      category: 'view-provider',
      registers: ['views.clientsAdminState'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/clients-admin-store-dialog.js',
      category: 'view-provider',
      registers: ['views.clientsAdminStoreDialog'],
      requiresModules: ['clientsApi'],
      requiresScripts: ['/root/registry.js', '/root/clients-api.js'],
    },
    {
      path: '/root/views/clients-admin.js',
      category: 'view-provider',
      registers: ['views.clientsAdmin'],
      requiresModules: ['clientsApi', 'ui', 'views.clientsAdminHelpers', 'views.clientsAdminRenderers', 'views.clientsAdminState', 'views.clientsAdminStoreDialog'],
      requiresScripts: ['/root/registry.js', '/root/clients-api.js', '/root/ui.js', '/root/views/clients-admin.helpers.js', '/root/views/clients-admin.renderers.js', '/root/views/clients-admin.state.js', '/root/views/clients-admin-store-dialog.js'],
    },
    {
      path: '/root/views/routes-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.routesAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/routes-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.routesAdminRenderers'],
      requiresModules: ['ui', 'views.routesAdminHelpers'],
      requiresScripts: ['/root/registry.js', '/root/ui.js', '/root/views/routes-admin.helpers.js'],
    },
    {
      path: '/root/views/routes-admin.state.js',
      category: 'view-provider',
      registers: ['views.routesAdminState'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/routes-admin.js',
      category: 'view-provider',
      registers: ['views.routesAdmin'],
      requiresModules: ['routesApi', 'ui', 'views.routesAdminHelpers', 'views.routesAdminRenderers', 'views.routesAdminState'],
      requiresScripts: ['/root/registry.js', '/root/routes-api.js', '/root/ui.js', '/root/views/routes-admin.helpers.js', '/root/views/routes-admin.renderers.js', '/root/views/routes-admin.state.js'],
    },
    {
      path: '/root/orders-api.js',
      category: 'provider',
      registers: ['ordersApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/views/approvals-admin.js',
      category: 'view-provider',
      registers: ['views.approvalsAdmin'],
      requiresModules: ['ordersApi'],
      requiresScripts: ['/root/registry.js', '/root/orders-api.js'],
    },
    {
      path: '/root/billing-api.js',
      category: 'provider',
      registers: ['billingApi'],
      requiresModules: [],
      requiresScripts: ['/shared/auth.js', '/root/registry.js'],
    },
    {
      path: '/root/views/billing-admin.helpers.js',
      category: 'view-provider',
      registers: ['views.billingAdminHelpers'],
      requiresModules: [],
      requiresScripts: ['/root/registry.js'],
    },
    {
      path: '/root/views/billing-admin.renderers.js',
      category: 'view-provider',
      registers: ['views.billingAdminRenderers'],
      requiresModules: ['views.billingAdminHelpers'],
      requiresScripts: ['/root/registry.js', '/root/views/billing-admin.helpers.js'],
    },
    {
      path: '/root/views/billing-admin.js',
      category: 'view-provider',
      registers: ['views.billingAdmin'],
      requiresModules: ['billingApi', 'ui', 'views.billingAdminHelpers', 'views.billingAdminRenderers'],
      requiresScripts: ['/root/registry.js', '/root/billing-api.js', '/root/ui.js', '/root/views/billing-admin.helpers.js', '/root/views/billing-admin.renderers.js'],
    },
    {
      path: '/root/router.js',
      category: 'consumer-provider',
      registers: ['router'],
      requiresModules: ['manifest', 'guards', 'views.home', 'views.inProcess', 'views.companiesAdmin', 'views.rolesAdmin', 'views.zonesAdmin', 'views.agentsAdmin', 'views.clientsAdmin', 'views.routesAdmin', 'views.warehousesAdmin', 'views.productsAdmin', 'views.lotsAdmin', 'views.movementsAdmin', 'views.billingAdmin', 'views.approvalsAdmin'],
      requiresScripts: ['/root/registry.js', '/root/manifest.js', '/root/guards.js', '/root/views/home.js', '/root/views/in-process.js', '/root/views/companies-admin.js', '/root/views/roles-admin.js', '/root/views/zones-admin.js', '/root/views/agents-admin.js', '/root/views/clients-admin.js', '/root/views/routes-admin.js', '/root/views/warehouses-admin.js', '/root/views/products-admin.js', '/root/views/lots-admin.helpers.js', '/root/views/lots-admin.state.js', '/root/views/lots-admin.renderers.js', '/root/views/lots-admin.js', '/root/views/movements-admin.js', '/root/orders-api.js', '/root/views/approvals-admin.js', '/root/billing-api.js', '/root/views/billing-admin.helpers.js', '/root/views/billing-admin.renderers.js', '/root/views/billing-admin.js'],
    },
    {
      path: '/root/app.js',
      category: 'bootstrap-consumer',
      registers: [],
      requiresModules: ['runtimeContract'],
      requiresScripts: ['/shared/session.js', '/shared/auth.js', '/root/registry.js', '/root/runtime-contract.js', '/root/session-adapter.js', '/root/guards.js', '/root/manifest.js', '/root/router.js'],
    },
  ]);

  const bootstrapModuleNames = Object.freeze(['sessionAdapter', 'guards', 'manifest', 'router']);

  function getLoaderScriptPaths() {
    return loaderScripts.map((entry) => entry.path);
  }

  function getScriptContract(scriptPath) {
    return loaderScripts.find((entry) => entry.path === scriptPath) || null;
  }

  function requireModules(moduleNames) {
    return moduleNames.map((moduleName) => rootShell.require(moduleName));
  }

  function assertNavigationItems(items) {
    for (const item of items) {
      if (typeof item?.visibilityRule !== 'function' || !item?.routeKey) {
        throw new Error('El manifest del shell root contiene una configuracion invalida.');
      }
    }
  }

  rootShell.register('runtimeContract', Object.freeze({
    bootstrapModuleNames,
    loaderScripts,
    getLoaderScriptPaths,
    getScriptContract,
    requireModules,
    assertNavigationItems,
  }));
}(window));
