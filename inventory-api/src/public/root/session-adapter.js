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
    // Platform root global
    if (session?.user?.role?.code === 'root' && !session?.user?.companyId) {
      return 'root';
    }

    // Explicit root landing (TASK-004)
    if (session?.user?.landing?.target === 'root' && session?.user?.companyId) {
      return 'company-admin';
    }

    // Legacy fallback (DEC-007)
    if (session?.user?.role?.code === 'admin' && session?.user?.companyId) {
      return 'company-admin';
    }

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
