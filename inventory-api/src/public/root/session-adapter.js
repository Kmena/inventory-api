(function attachRootShellSessionAdapter(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventorySession = /** @type {any} */ (globalScope).InventorySession;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  function readSnapshot() {
    return inventorySession.read();
  }

  function hasPermission(session, permissionCode) {
    return Boolean(session?.user?.permissions?.includes(permissionCode));
  }

  function isAuthenticated(session) {
    return Boolean(session?.user?.id);
  }

  async function bootstrap() {
    return inventoryAuth.bootstrapSession({
      fallbackMessage: 'No se pudo validar la sesion del panel root.',
    });
  }

  function getActorType(session) {
    if (session?.user?.role?.code === 'root' && !session?.user?.companyId) {
      return 'root';
    }

    if (session?.user?.role?.code === 'admin' && session?.user?.companyId) {
      return 'company-admin';
    }

    // procurement_operator: company-scoped user — must see the company-admin sidebar
    if (
      session?.user?.companyId &&
      (session?.user?.permissions || []).includes('procurement.manage')
    ) {
      return 'company-admin';
    }

    return 'unknown';
  }

  rootShell.register('sessionAdapter', {
    bootstrap,
    getActorType,
    hasPermission,
    isAuthenticated,
    readSnapshot,
  });
}(window));
