/**
 * Warehouse SPA — Session state helpers.
 * Derives permission flags from the authenticated session.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function derivePermissions(session) {
  const permissions = session?.user?.permissions || [];
  return {
    canReceive:  permissions.includes('warehouse.receive'),
    canInspect:  permissions.includes('quality.inspect'),
    canAccess:   permissions.includes('warehouse.access'),
    raw:         permissions,
  };
}

WarehouseShell.register('state', { derivePermissions });
})();
