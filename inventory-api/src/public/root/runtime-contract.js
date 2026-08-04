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
      path: '/root/views/clients-admin.js',
      category: 'view-provider',
      registers: ['views.clientsAdmin'],
      requiresModules: ['clientsApi', 'ui', 'views.clientsAdminHelpers', 'views.clientsAdminRenderers', 'views.clientsAdminState'],
      requiresScripts: ['/root/registry.js', '/root/clients-api.js', '/root/ui.js', '/root/views/clients-admin.helpers.js', '/root/views/clients-admin.renderers.js', '/root/views/clients-admin.state.js'],
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
      path: '/root/router.js',
      category: 'consumer-provider',
      registers: ['router'],
      requiresModules: ['manifest', 'guards', 'views.home', 'views.inProcess', 'views.companiesAdmin', 'views.rolesAdmin', 'views.zonesAdmin', 'views.agentsAdmin', 'views.clientsAdmin', 'views.routesAdmin'],
      requiresScripts: ['/root/registry.js', '/root/manifest.js', '/root/guards.js', '/root/views/home.js', '/root/views/in-process.js', '/root/views/companies-admin.js', '/root/views/roles-admin.js', '/root/views/zones-admin.js', '/root/views/agents-admin.js', '/root/views/clients-admin.js', '/root/views/routes-admin.js'],
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
