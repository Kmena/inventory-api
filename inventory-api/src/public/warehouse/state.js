/**
 * Warehouse SPA — Session state helpers.
 * Derives permission flags from the authenticated session.
 *
 * Permissions derived:
 *  canReceive          — receipts.inspect (warehouse operator can initiate receipt workflow)
 *  canInspect          — quality.inspect  (QA inspector can inspect items)
 *  canAccess           — warehouse.access (landing gate for all warehouse users)
 *  canExecuteProduction — production.execute
 *  canCompleteProduction — production.complete
 *  canViewProduction   — production.view
 *  canCreateProduction  — production.create
 *  canApproveProduction — production.approve
 *  canConfirm           — receipts.confirm
 *  canViewReceipts      — receipts.view (read-only, no inspect actions)
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function derivePermissions(session) {
  const permissions = session?.user?.permissions || [];
  return {
    canReceive:            permissions.includes('receipts.inspect'),
    canInspect:            permissions.includes('quality.inspect'),
    canInspectQa:          permissions.includes('quality.inspect'),   // alias explícito para gate QA de etapas
    canAccess:             permissions.includes('warehouse.access'),
    canExecuteProduction:  permissions.includes('production.execute'),
    canCompleteProduction: permissions.includes('production.complete'),
    canViewProduction:     permissions.includes('production.view'),
    canCreateProduction:   permissions.includes('production.create'),
    canApproveProduction:  permissions.includes('production.approve'),
    // TASK-007: loss registration requires production.manage permission
    canManageProduction:   permissions.includes('production.manage'),
    canCancelProduction:   permissions.includes('production.cancel'),
    canConfirm:            permissions.includes('receipts.confirm'),
    canViewReceipts:       permissions.includes('receipts.view'),
    raw:                   permissions,
  };
}

WarehouseShell.register('state', { derivePermissions });
})();
