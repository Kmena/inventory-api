(function attachRootShellPurchaseOrdersAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  const STATUS_MAP = {
    PENDING: { label: 'Pendiente', badgeClass: 'badge badge-warning' },
    CONFIRMED: { label: 'Confirmada', badgeClass: 'badge badge-info' },
    RECEIVED: { label: 'Recibida', badgeClass: 'badge badge-success' },
  };

  function getStatusBadge(status) {
    const entry = STATUS_MAP[status] || { label: status || '—', badgeClass: 'badge' };
    return `<span class="${entry.badgeClass}">${rootShellUi.escapeHtml(entry.label)}</span>`;
  }

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

  function deriveOrderCurrency(order) {
    return order.currency || order.quotation?.currency || order.items?.[0]?.currency || 'CRC';
  }

  function calculateOrderTotal(order) {
    const items = order.items || [];
    return items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  }

  function renderOrderList(orders, selectedId) {
    if (!orders || !orders.length) {
      return '<p class="empty-state">No hay órdenes de compra registradas.</p>';
    }

    return orders.map((order) => {
      const isSelected = String(order.id) === String(selectedId);
      const itemClass = `rfq-tracking-sidebar-item${isSelected ? ' rfq-tracking-sidebar-item--active' : ''}`;
      const supplierName = order.supplier?.name || '—';
      const total = calculateOrderTotal(order);
      const currency = deriveOrderCurrency(order);
      const date = rootShellUi.formatDate(order.createdAt);

      return `
        <div
          class="${itemClass}"
          role="listitem"
          data-order-id="${rootShellUi.escapeHtml(String(order.id))}"
          tabindex="0"
          aria-label="Orden de compra ${rootShellUi.escapeHtml(String(order.id))}"
        >
          <div class="rfq-tracking-item-header">
            <strong>OC #${rootShellUi.escapeHtml(String(order.id))}</strong>
            ${getStatusBadge(order.status)}
          </div>
          <p class="muted">
            ${rootShellUi.escapeHtml(supplierName)} ·
            ${rootShellUi.escapeHtml(formatCurrency(total, currency))} ·
            ${rootShellUi.escapeHtml(date)}
          </p>
        </div>
      `;
    }).join('');
  }

  function renderOrderDetail(order) {
    if (!order) {
      return '<p class="empty-state">Selecciona una orden de compra para ver el detalle.</p>';
    }

    const supplierName = order.supplier?.name || '—';
    const date = rootShellUi.escapeHtml(rootShellUi.formatDate(order.createdAt));
    const statusBadge = getStatusBadge(order.status);
    const items = order.items || [];
    const currency = deriveOrderCurrency(order);
    const total = calculateOrderTotal(order);

    const itemRows = items.map((item) => {
      const productName = item.product?.name || '—';
      const productSku = item.product?.sku || '—';
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const subtotal = qty * unitPrice;

      return `
        <tr>
          <td data-label="Producto"><strong>${rootShellUi.escapeHtml(productName)}</strong></td>
          <td data-label="SKU">${rootShellUi.escapeHtml(productSku)}</td>
          <td data-label="Cantidad">${rootShellUi.escapeHtml(String(qty))}</td>
          <td data-label="Precio unitario">${rootShellUi.escapeHtml(formatCurrency(unitPrice, currency))}</td>
          <td data-label="Subtotal">${rootShellUi.escapeHtml(formatCurrency(subtotal, currency))}</td>
        </tr>
      `;
    }).join('');

    const itemsTable = items.length
      ? `
        <div class="table-wrapper">
          <table aria-label="Productos de la orden de compra">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">SKU</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Precio unitario</th>
                <th scope="col">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
      `
      : '<p class="muted">Sin productos registrados.</p>';

    const notes = order.notes
      ? `<p class="muted">${rootShellUi.escapeHtml(order.notes)}</p>`
      : '<p class="muted">Sin notas.</p>';

    return `
      <div class="page-header">
        <div>
          <h3>Orden de compra #${rootShellUi.escapeHtml(String(order.id))}</h3>
          <p class="muted">
            ${statusBadge}
            <span> · ${rootShellUi.escapeHtml(supplierName)}</span>
            <span> · ${date}</span>
          </p>
        </div>
      </div>

      <div class="stack-section">
        <div class="detail-grid">
          <div class="detail-item">
            <span>Proveedor</span>
            <strong>${rootShellUi.escapeHtml(supplierName)}</strong>
          </div>
          <div class="detail-item">
            <span>Total</span>
            <strong>${rootShellUi.escapeHtml(formatCurrency(total, currency))}</strong>
          </div>
        </div>

        <h4>Productos incluidos</h4>
        ${itemsTable}

        <h4>Notas</h4>
        ${notes}

        <div class="stack-section" data-feature="hacienda-xml-upload">
          <h4>Comprobante fiscal</h4>
          <p class="muted">[Próximamente] Adjunta el XML de la factura electrónica para registrar esta compra ante Hacienda Costa Rica.</p>
        </div>
      </div>
    `;
  }

  rootShell.register('views.purchaseOrdersAdminRenderers', {
    renderOrderList,
    renderOrderDetail,
  });
}(window));
