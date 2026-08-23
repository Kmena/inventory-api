(function attachRootShellFiscalRefsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  // FiscalReferenceStatus enum values from Prisma schema:
  // PENDING | SUBMITTED | ACCEPTED | REJECTED
  const STATUS_MAP = {
    PENDING: { label: 'Pendiente', badgeClass: 'badge badge-warning' },
    SUBMITTED: { label: 'Enviada a Hacienda', badgeClass: 'badge badge-warning' },
    ACCEPTED: { label: 'Aceptada por Hacienda', badgeClass: 'badge badge-success' },
    REJECTED: { label: 'Rechazada por Hacienda', badgeClass: 'badge badge-danger' },
  };

  const DOCUMENT_TYPE_LABELS = {
    '01': 'Factura electrónica',
    '02': 'Nota de débito electrónica',
    '03': 'Nota de crédito electrónica',
    '04': 'Tiquete electrónico',
    '08': 'Factura electrónica de compras',
    '09': 'Factura electrónica exportación',
    '12': 'Factura electrónica de compras importación',
    '13': 'Factura electrónica exportación tránsito',
  };

  function getStatusBadge(status) {
    const entry = STATUS_MAP[status] || { label: status || '—', badgeClass: 'badge' };
    return `<span class="${entry.badgeClass}">${rootShellUi.escapeHtml(entry.label)}</span>`;
  }

  function getDocumentTypeLabel(documentType) {
    return DOCUMENT_TYPE_LABELS[documentType] || `Tipo ${documentType || '—'}`;
  }

  function renderFiscalRefList(fiscalRefs, selectedId) {
    if (!fiscalRefs || !fiscalRefs.length) {
      return '<p class="empty-state">No hay referencias fiscales registradas.</p>';
    }

    return fiscalRefs.map((ref) => {
      const isSelected = String(ref.id) === String(selectedId);
      const itemClass = `rfq-tracking-sidebar-item${isSelected ? ' rfq-tracking-sidebar-item--active' : ''}`;
      const supplierName = ref.purchaseReceipt?.supplier?.name || '—';
      const docTypeLabel = getDocumentTypeLabel(ref.documentType);
      const date = rootShellUi.formatDate(ref.createdAt);

      return `
        <div
          class="${itemClass}"
          role="listitem"
          data-fiscal-ref-id="${rootShellUi.escapeHtml(String(ref.id))}"
          tabindex="0"
          aria-label="Referencia fiscal ${rootShellUi.escapeHtml(String(ref.id))}"
        >
          <div class="rfq-tracking-item-header">
            <strong>${rootShellUi.escapeHtml(docTypeLabel)}</strong>
            ${getStatusBadge(ref.status)}
          </div>
          <p class="muted">
            ${rootShellUi.escapeHtml(supplierName)} ·
            ${rootShellUi.escapeHtml(date)}
          </p>
        </div>
      `;
    }).join('');
  }

  function renderFiscalRefDetail(fiscalRef) {
    if (!fiscalRef) {
      return '<p class="empty-state">Selecciona una referencia fiscal para ver el detalle.</p>';
    }

    const docTypeLabel = getDocumentTypeLabel(fiscalRef.documentType);
    const statusBadge = getStatusBadge(fiscalRef.status);
    const supplierName = fiscalRef.purchaseReceipt?.supplier?.name || '—';
    const receiptRef = fiscalRef.purchaseReceipt
      ? `REC #${rootShellUi.escapeHtml(String(fiscalRef.purchaseReceipt.id))}`
      : '—';
    const externalReference = fiscalRef.externalReference || '—';
    const simplifiedRegime = fiscalRef.simplifiedRegime ? 'Sí' : 'No';
    const date = rootShellUi.escapeHtml(rootShellUi.formatDate(fiscalRef.createdAt));

    const notes = fiscalRef.notes
      ? `<p class="muted">${rootShellUi.escapeHtml(fiscalRef.notes)}</p>`
      : '<p class="muted">Sin notas.</p>';

    return `
      <div class="page-header">
        <div>
          <h3>${rootShellUi.escapeHtml(docTypeLabel)}</h3>
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
            <span>Tipo de documento</span>
            <strong>${rootShellUi.escapeHtml(docTypeLabel)}</strong>
          </div>
          <div class="detail-item">
            <span>Estado</span>
            <strong>${statusBadge}</strong>
          </div>
          <div class="detail-item">
            <span>Referencia externa</span>
            <strong>${rootShellUi.escapeHtml(externalReference)}</strong>
          </div>
          <div class="detail-item">
            <span>Régimen simplificado</span>
            <strong>${rootShellUi.escapeHtml(simplifiedRegime)}</strong>
          </div>
          <div class="detail-item">
            <span>Recepción de origen</span>
            <strong>${receiptRef}</strong>
          </div>
          <div class="detail-item">
            <span>Proveedor</span>
            <strong>${rootShellUi.escapeHtml(supplierName)}</strong>
          </div>
        </div>

        <h4>Notas</h4>
        ${notes}

        <div class="stack-section" data-feature="hacienda-xml-upload">
          <h4>Comprobante fiscal</h4>
          <p class="muted">[Próximamente] Procesamiento del XML de Hacienda Costa Rica.</p>
        </div>
      </div>
    `;
  }

  rootShell.register('views.fiscalRefsAdminRenderers', {
    renderFiscalRefList,
    renderFiscalRefDetail,
  });
}(window));
