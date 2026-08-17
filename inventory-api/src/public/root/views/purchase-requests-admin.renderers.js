(function attachRootShellPurchaseRequestsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  const STATUS_MAP = {
    OPEN: { label: 'Abierta', badgeClass: 'badge badge-info' },
    CLOSED: { label: 'Cerrada', badgeClass: 'badge badge-success' },
    CANCELLED: { label: 'Cancelada', badgeClass: 'badge badge-danger' },
  };

  function getStatusBadge(status) {
    const entry = STATUS_MAP[status] || { label: status || '—', badgeClass: 'badge' };
    return `<span class="${entry.badgeClass}">${rootShellUi.escapeHtml(entry.label)}</span>`;
  }

  function renderRequestList(requests, selectedId) {
    if (!requests || !requests.length) {
      return '<p class="empty-state">No hay solicitudes de compra registradas.</p>';
    }

    return requests.map((req) => {
      const isSelected = String(req.id) === String(selectedId);
      const itemClass = `rfq-tracking-sidebar-item${isSelected ? ' rfq-tracking-sidebar-item--active' : ''}`;
      const itemCount = req.items?.length || req.itemCount || 0;
      const respondedCount = Number(req.respondedInvitationCount || 0);
      const hasPo = Boolean(req.purchaseOrders?.length || req.hasPurchaseOrder);
      const title = rootShellUi.escapeHtml(req.title || `Solicitud #${req.id}`);
      const date = rootShellUi.formatDate(req.createdAt);

      return `
        <div
          class="${itemClass}"
          role="listitem"
          data-request-id="${rootShellUi.escapeHtml(String(req.id))}"
          tabindex="0"
          aria-label="Solicitud ${title}"
        >
          <div class="rfq-tracking-item-header">
            <strong>${title}</strong>
            ${getStatusBadge(req.status)}
            ${hasPo ? '<span class="badge badge-success">OC emitida</span>' : ''}
          </div>
          <p class="muted">
            ${rootShellUi.escapeHtml(String(itemCount))} producto(s) ·
            ${rootShellUi.escapeHtml(String(respondedCount))} cotización(es) recibida(s) ·
            ${rootShellUi.escapeHtml(date)}
          </p>
        </div>
      `;
    }).join('');
  }

  function renderRequestDetail(request) {
    if (!request) {
      return '<p class="empty-state">Selecciona una solicitud para ver el detalle.</p>';
    }

    const title = rootShellUi.escapeHtml(request.title || `Solicitud #${request.id}`);
    const date = rootShellUi.escapeHtml(rootShellUi.formatDate(request.createdAt));
    const statusBadge = getStatusBadge(request.status);
    const items = request.items || [];
    const respondedCount = Number(request.respondedInvitationCount || 0);

    const itemRows = items.map((item) => {
      const productName = item.product?.name || item.productName || '—';
      return `
        <tr>
          <td data-label="Producto"><strong>${rootShellUi.escapeHtml(productName)}</strong></td>
          <td data-label="SKU">${rootShellUi.escapeHtml(item.product?.sku || '—')}</td>
          <td data-label="Cantidad">${rootShellUi.escapeHtml(String(item.quantity || 0))}</td>
          <td data-label="Notas">${rootShellUi.escapeHtml(item.notes || '—')}</td>
        </tr>
      `;
    }).join('');

    const itemsTable = items.length
      ? `
        <div class="table-wrapper">
          <table aria-label="Productos solicitados">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">SKU</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Notas</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
      `
      : '<p class="muted">Sin productos registrados.</p>';

    const goToQuotationsButton = request.status === 'OPEN'
      ? `
        <button
          type="button"
          class="secondary-button purchase-requests-go-to-quotations-button"
          aria-label="Ver esta solicitud en el workspace de cotizaciones"
        >Ver en workspace de cotizaciones</button>
      `
      : '';

    return `
      <div class="page-header">
        <div>
          <h3>${title}</h3>
          <p class="muted">
            ${statusBadge}
            <span> · Creada el ${date}</span>
            <span> · ${rootShellUi.escapeHtml(String(items.length))} producto(s)</span>
            <span> · ${rootShellUi.escapeHtml(String(respondedCount))} cotización(es) recibida(s)</span>
          </p>
        </div>
        <div class="action-row compact-action-row">
          ${goToQuotationsButton}
        </div>
      </div>

      <div class="stack-section">
        <h4>Productos solicitados</h4>
        ${itemsTable}
      </div>
    `;
  }

  rootShell.register('views.purchaseRequestsAdminRenderers', {
    renderRequestList,
    renderRequestDetail,
  });
}(window));
