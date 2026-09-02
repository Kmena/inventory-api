(function attachRootShellQuotationsComparisonRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function formatCurrency(amount, currency) {
    const value = Number(amount || 0);
    if (!Number.isFinite(value)) {
      return '—';
    }

    try {
      return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: currency || 'CRC',
        minimumFractionDigits: 2,
      }).format(value);
    } catch (_error) {
      return `${currency || 'CRC'} ${value.toFixed(2)}`;
    }
  }

  function renderItemsList(items, currency) {
    if (!items || !items.length) return '<p class="muted" style="margin:0.25rem 0 0;">Sin productos detallados.</p>';
    return items.map((item) => {
      const name = item.product?.name || item.productName || `Producto #${item.productId}`;
      const qty  = Number(item.quantity || 0);
      const up   = Number(item.unitPrice || 0);
      const lead = item.leadTimeDays != null ? `${item.leadTimeDays}d` : '—';
      return `<span style="display:flex;gap:0.5rem;font-size:0.8rem;padding:0.1rem 0;">
        <strong style="flex:1;">${rootShellUi.escapeHtml(name)}</strong>
        <span class="muted">${rootShellUi.escapeHtml(String(qty))} u · ${rootShellUi.escapeHtml(formatCurrency(up, currency))}</span>
        <span class="badge" style="font-size:0.7rem;padding:0 0.3rem;">${rootShellUi.escapeHtml(lead)}</span>
      </span>`;
    }).join('');
  }

  function renderComparisonTable(quotations) {
    if (!quotations || !quotations.length) {
      return '<p class="empty-state">No hay cotizaciones con respuesta para comparar.</p>';
    }

    const rows = quotations.map((q) => {
      const supplierName = q.supplier?.name || q.supplierName || '—';
      const leadTime = q.averageLeadTimeDays != null
        ? `${Math.round(q.averageLeadTimeDays)} días`
        : '—';
      const itemsHtml = renderItemsList(q.items, q.currency);

      return `
        <tr>
          <td data-label="Proveedor">
            <strong>${rootShellUi.escapeHtml(supplierName)}</strong>
            <div style="margin-top:0.4rem;">${itemsHtml}</div>
          </td>
          <td data-label="Referencia"><span class="badge badge-info">${rootShellUi.escapeHtml(q.reference || '—')}</span></td>
          <td data-label="Moneda">${rootShellUi.escapeHtml(q.currency || '—')}</td>
          <td data-label="Precio total"><strong>${rootShellUi.escapeHtml(formatCurrency(q.totalAmount, q.currency))}</strong></td>
          <td data-label="Lead time prom.">${rootShellUi.escapeHtml(leadTime)}</td>
          <td data-label="Acción">
            <button
              type="button"
              class="quotations-select-supplier-button"
              data-quotation-id="${rootShellUi.escapeHtml(String(q.id))}"
              data-supplier-name="${rootShellUi.escapeHtml(supplierName)}"
              data-total-amount="${rootShellUi.escapeHtml(String(q.totalAmount || 0))}"
              data-currency="${rootShellUi.escapeHtml(q.currency || '')}"
              aria-label="Seleccionar a ${rootShellUi.escapeHtml(supplierName)} como proveedor"
            >Seleccionar este proveedor</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-wrapper">
        <table aria-label="Comparación de cotizaciones por proveedor">
          <thead>
            <tr>
              <th scope="col">Proveedor · Productos</th>
              <th scope="col">Referencia</th>
              <th scope="col">Moneda</th>
              <th scope="col">Precio total ↑</th>
              <th scope="col">Lead time prom.</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderCreatePoSummary(selection, items) {
    const supplierName = selection?.quotation?.supplier?.name || '—';
    const currency = selection?.currency || 'CRC';
    const totalAmount = selection?.totalAmount || 0;

    const itemRows = (items || []).map((item) => {
      const productName = item.product?.name || item.productName || 'Producto';
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const subtotal = qty * unitPrice;
      return `
        <tr>
          <td data-label="Producto"><strong>${rootShellUi.escapeHtml(productName)}</strong></td>
          <td data-label="Cantidad">${rootShellUi.escapeHtml(String(qty))}</td>
          <td data-label="Precio unitario">${rootShellUi.escapeHtml(formatCurrency(unitPrice, currency))}</td>
          <td data-label="Subtotal">${rootShellUi.escapeHtml(formatCurrency(subtotal, currency))}</td>
        </tr>
      `;
    }).join('');

    const itemsTable = items && items.length
      ? `
        <div class="table-wrapper">
          <table aria-label="Productos incluidos en la orden de compra">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Precio unitario</th>
                <th scope="col">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
      `
      : '<p class="muted">Sin ítems registrados en esta cotización.</p>';

    return `
      <div class="detail-grid">
        <div class="detail-item">
          <span>Proveedor</span>
          <strong>${rootShellUi.escapeHtml(supplierName)}</strong>
        </div>
        <div class="detail-item">
          <span>Total</span>
          <strong>${rootShellUi.escapeHtml(formatCurrency(totalAmount, currency))}</strong>
        </div>
      </div>
      <h4>Productos incluidos</h4>
      ${itemsTable}
    `;
  }

  rootShell.register('views.quotationsComparisonRenderers', {
    formatCurrency,
    renderComparisonTable,
    renderCreatePoSummary,
  });
}(window));
