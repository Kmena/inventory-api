(function attachRootShellReceiptsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  const STATUS_MAP = {
    PENDING_INSPECTION: { label: 'Pendiente de inspección', badgeClass: 'badge badge-warning' },
    ACCEPTED: { label: 'Aceptada', badgeClass: 'badge badge-success' },
    PARTIALLY_ACCEPTED: { label: 'Parcialmente aceptada', badgeClass: 'badge badge-warning' },
    REJECTED: { label: 'Rechazada', badgeClass: 'badge badge-danger' },
    CONFIRMED: { label: 'Confirmada', badgeClass: 'badge badge-success' },
    REVERSED: { label: 'Revertida', badgeClass: 'badge' },
  };

  function getStatusBadge(status) {
    const entry = STATUS_MAP[status] || { label: status || '—', badgeClass: 'badge' };
    return `<span class="${entry.badgeClass}">${rootShellUi.escapeHtml(entry.label)}</span>`;
  }

  function renderReceiptList(receipts, selectedId) {
    if (!receipts || !receipts.length) {
      return '<p class="empty-state">No hay recepciones registradas.</p>';
    }

    return receipts.map((receipt) => {
      const isSelected = String(receipt.id) === String(selectedId);
      const itemClass = `rfq-tracking-sidebar-item${isSelected ? ' rfq-tracking-sidebar-item--active' : ''}`;
      const supplierName = receipt.supplier?.name || '—';
      const date = rootShellUi.formatDate(receipt.createdAt);

      return `
        <div
          class="${itemClass}"
          role="listitem"
          data-receipt-id="${rootShellUi.escapeHtml(String(receipt.id))}"
          tabindex="0"
          aria-label="Recepción ${rootShellUi.escapeHtml(String(receipt.id))}"
        >
          <div class="rfq-tracking-item-header">
            <strong>REC #${rootShellUi.escapeHtml(String(receipt.id))}</strong>
            ${getStatusBadge(receipt.status)}
          </div>
          <p class="muted">
            ${rootShellUi.escapeHtml(supplierName)} ·
            ${rootShellUi.escapeHtml(date)}
          </p>
        </div>
      `;
    }).join('');
  }

  function renderReceiptDetail(receipt) {
    if (!receipt) {
      return '<p class="empty-state">Selecciona una recepción para ver el detalle.</p>';
    }

    const supplierName = receipt.supplier?.name || '—';
    const warehouseName = receipt.warehouse?.name || '—';
    const purchaseOrderRef = receipt.purchaseOrder
      ? `OC #${rootShellUi.escapeHtml(String(receipt.purchaseOrder.id))}`
      : '—';
    const date = rootShellUi.escapeHtml(rootShellUi.formatDate(receipt.receivedAt || receipt.createdAt));
    const statusBadge = getStatusBadge(receipt.status);
    const items = receipt.items || [];
    const inspections = receipt.inspections || [];

    const itemRows = items.map((item) => {
      const productName = item.product?.name || '—';
      const productSku = item.product?.sku || '—';
      const lotNumber = item.lotNumber || '—';
      const unitCost = item.unitCost != null ? `₡${Number(item.unitCost).toLocaleString('es-CR')}` : '—';

      return `
        <tr>
          <td data-label="Producto"><strong>${rootShellUi.escapeHtml(productName)}</strong></td>
          <td data-label="SKU">${rootShellUi.escapeHtml(productSku)}</td>
          <td data-label="Solicitada">${rootShellUi.escapeHtml(String(item.requestedQuantity ?? 0))}</td>
          <td data-label="Recibida">${rootShellUi.escapeHtml(String(item.receivedQuantity ?? 0))}</td>
          <td data-label="Rechazada">${rootShellUi.escapeHtml(String(item.rejectedQuantity ?? 0))}</td>
          <td data-label="Lote">${rootShellUi.escapeHtml(lotNumber)}</td>
          <td data-label="Costo unitario">${rootShellUi.escapeHtml(unitCost)}</td>
        </tr>
      `;
    }).join('');

    const itemsTable = items.length
      ? `
        <div class="table-wrapper">
          <table aria-label="Ítems de la recepción">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">SKU</th>
                <th scope="col">Solicitada</th>
                <th scope="col">Recibida</th>
                <th scope="col">Rechazada</th>
                <th scope="col">Lote</th>
                <th scope="col">Costo unitario</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
      `
      : '<p class="muted">Sin ítems registrados.</p>';

    const INSPECTION_RESULT_MAP = {
      ACCEPTED: 'Aceptado',
      PARTIALLY_ACCEPTED: 'Parcialmente aceptado',
      REJECTED: 'Rechazado',
    };

    const inspectionRows = inspections.map((insp) => `
      <li class="muted">
        ${rootShellUi.escapeHtml(INSPECTION_RESULT_MAP[insp.result] || insp.result)} —
        Aceptada: ${rootShellUi.escapeHtml(String(insp.quantityAccepted ?? 0))},
        Rechazada: ${rootShellUi.escapeHtml(String(insp.quantityRejected ?? 0))}
        ${insp.observations ? ` — ${rootShellUi.escapeHtml(insp.observations)}` : ''}
      </li>
    `).join('');

    const inspectionsSection = inspections.length
      ? `
        <h4>Inspecciones</h4>
        <ul>${inspectionRows}</ul>
      `
      : '';

    const notes = receipt.notes
      ? `<p class="muted">${rootShellUi.escapeHtml(receipt.notes)}</p>`
      : '<p class="muted">Sin notas.</p>';

    return `
      <div class="page-header">
        <div>
          <h3>Recepción #${rootShellUi.escapeHtml(String(receipt.id))}</h3>
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
            <span>Bodega</span>
            <strong>${rootShellUi.escapeHtml(warehouseName)}</strong>
          </div>
          <div class="detail-item">
            <span>Orden de compra</span>
            <strong>${purchaseOrderRef}</strong>
          </div>
          <div class="detail-item">
            <span>Estado</span>
            <strong>${statusBadge}</strong>
          </div>
          <div class="detail-item">
            <span>Fecha de recepción</span>
            <strong>${date}</strong>
          </div>
        </div>

        <h4>Ítems recibidos</h4>
        ${itemsTable}

        ${inspectionsSection}

        <h4>Notas</h4>
        ${notes}
      </div>
    `;
  }

  rootShell.register('views.receiptsAdminRenderers', {
    renderReceiptList,
    renderReceiptDetail,
  });
}(window));
