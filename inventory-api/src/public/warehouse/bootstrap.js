/**
 * Warehouse SPA — Bootstrap entry point.
 * Calls app.bootstrap() after all modules are loaded.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;
const app = WarehouseShell.require('app');
app.bootstrap();
})();
