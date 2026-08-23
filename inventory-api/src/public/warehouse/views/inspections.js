/**
 * Warehouse SPA — Inspections view (dedicated module).
 *
 * This module handles standalone inspection workflows surfaced via the
 * bottom tab bar when the user has quality.inspect permission but navigates
 * directly to the inspections context rather than via receipts step 2.
 *
 * For TASK-017 the view provides a stub that directs the user to the
 * Recepciones workflow where inspection is integrated.
 *
 * Permission: quality.inspect
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function render(container, _session, _params) {
  const app = WarehouseShell.require('app');
  container.innerHTML = `
    <div class="warehouse-section">
      <h2 class="warehouse-section__title">Inspecciones</h2>
      <p class="warehouse-message">
        Las inspecciones de recepciones estan integradas en el flujo de Recepciones.
        Navegue a la pestana de Recepciones para inspeccionar items recibidos.
      </p>
      <button type="button" class="primary-button" id="go-to-receipts">Ir a Recepciones</button>
    </div>
  `;
  container.querySelector('#go-to-receipts')?.addEventListener('click', () => {
    app.navigate('receipts');
  });
}

WarehouseShell.register('views.inspections', { render });
})();
