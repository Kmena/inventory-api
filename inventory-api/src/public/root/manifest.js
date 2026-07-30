(function attachRootShellManifest(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const guards = rootShell.require('guards');

  const items = [
    {
      id: 'home',
      label: 'Inicio',
      routeKey: 'home',
      href: '/root/#home',
      implemented: true,
      activeMatchers: ['home'],
      visibilityRule: () => true,
      dependencyTag: 'p27-local-shell',
    },
    {
      id: 'companies',
      label: 'Empresas',
      routeKey: 'companies',
      href: '/root/#companies',
      implemented: true,
      activeMatchers: ['companies'],
      visibilityRule: guards.isRootUser,
      dependencyTag: 'p37-root-companies-admin',
    },
    {
      id: 'roles-permissions',
      label: 'Roles y permisos',
      routeKey: 'roles_permissions',
      href: '/root/#roles_permissions',
      implemented: true,
      activeMatchers: ['roles_permissions'],
      visibilityRule: guards.isCompanyAdmin,
      dependencyTag: 'p37-root-roles-admin',
    },
    {
      id: 'in-process',
      label: 'Pendientes',
      routeKey: 'in_process',
      href: '/root/#in_process',
      implemented: false,
      activeMatchers: ['in_process'],
      visibilityRule: () => true,
      dependencyTag: 'p27-local-shell',
    },
  ];

  rootShell.register('manifest', {
    items,
  });
}(window));
