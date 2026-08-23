(function attachRootShellRfqTrackingRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function mapStatus(status) {
    switch (status) {
      case 'PREPARED': return { label: 'Preparada', badgeClass: 'badge badge-info' };
      case 'RESPONDED': return { label: 'Respondida', badgeClass: 'badge badge-success' };
      case 'EXPIRED': return { label: 'Expirada', badgeClass: 'badge badge-warning' };
      case 'CANCELLED': return { label: 'Cancelada', badgeClass: 'badge badge-danger' };
      default: return { label: 'Pendiente', badgeClass: 'badge' };
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderEmptyState(title, description) {
    return `
      <div class="card root-card">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
      </div>
    `;
  }

  function deriveRequestOperationalState(request) {
    if (!request?.hasInvitations) {
      return { label: 'Pendiente de invitar', badgeClass: 'badge badge-info', description: 'Esta solicitud sigue abierta y aún no tiene invitaciones RFQ generadas.' };
    }
    if (Number(request?.respondedInvitationCount || 0) > 0) {
      return { label: 'Con respuestas', badgeClass: 'badge badge-success', description: 'Ya se recibieron respuestas para esta solicitud.' };
    }
    return { label: 'En seguimiento', badgeClass: 'badge', description: 'Hay invitaciones activas esperando respuesta.' };
  }

  function renderItemsSection(request) {
    const items = request?.items || [];
    if (!items.length) {
      return `
        <div class="stack-section">
          <h4>Qué se está cotizando</h4>
          <p class="muted">Sin productos registrados en esta solicitud.</p>
        </div>
      `;
    }
    return `
      <div class="stack-section">
        <h4>Qué se está cotizando</h4>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Unidad</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td data-label="Producto"><strong>${rootShellUi.escapeHtml(item.productName || `Producto #${item.productId}`)}</strong></td>
                  <td data-label="Cantidad">${rootShellUi.escapeHtml(String(item.quantity || 0))}</td>
                  <td data-label="Unidad">${rootShellUi.escapeHtml(item.unit || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderPendingResponseSection(invitations, request, canManage) {
    if (!canManage) {
      return '';
    }
    const pending = (invitations || []).filter((inv) => inv.status === 'PREPARED');
    if (!pending.length) {
      return '';
    }
    return `
      <div class="stack-section">
        <h4>Pendientes de respuesta manual</h4>
        <p class="muted">${rootShellUi.escapeHtml(String(pending.length))} proveedor(es) con invitación activa esperan respuesta.</p>
        ${pending.map((inv) => `
          <div class="rfq-pending-card">
            <div class="rfq-pending-card__info">
              <strong>${rootShellUi.escapeHtml(inv.supplierName || 'Proveedor')}</strong>
              <span class="muted" style="font-size:0.9rem">${rootShellUi.escapeHtml(inv.supplierEmail || '—')} · Expira: ${rootShellUi.escapeHtml(formatDate(inv.expiresAt))}</span>
            </div>
            <button
              class="rfq-tracking-manual-response-button"
              type="button"
              data-invitation-id="${rootShellUi.escapeHtml(String(inv.id))}"
              data-purchase-request-id="${rootShellUi.escapeHtml(String(request.purchaseRequestId))}"
              data-supplier-name="${rootShellUi.escapeHtml(inv.supplierName || 'Proveedor')}"
            >Registrar respuesta</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCloseSection(request) {
    const hasResponses = Number(request?.respondedInvitationCount || 0) > 0;
    const safeTitle = rootShellUi.escapeHtml(request.title || `Solicitud #${request.purchaseRequestId}`);
    const safeId = rootShellUi.escapeHtml(String(request.purchaseRequestId));
    const goToQuotationsButton = hasResponses
      ? `<button type="button" id="rfq-tracking-go-to-quotations-button" data-purchase-request-id="${safeId}">Ir a cotizaciones →</button>`
      : '';
    const description = hasResponses
      ? 'Ya se recibieron respuestas. Ve a Cotizaciones para seleccionar un proveedor y generar la orden de compra.'
      : 'Aún no se han recibido respuestas. Puedes cancelar si la compra ya no es necesaria.';
    return `
      <div class="stack-section">
        <h4>Cerrar solicitud</h4>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
        <div class="action-row">
          ${goToQuotationsButton}
          <button
            class="secondary-button danger-button"
            type="button"
            id="rfq-tracking-cancel-request-button"
            data-purchase-request-id="${safeId}"
            data-request-title="${safeTitle}"
          >Cancelar solicitud</button>
        </div>
      </div>
    `;
  }

  function renderInvitationsTable(invitations) {
    return `
      <div class="stack-section">
        <h4>Invitaciones</h4>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Respondida</th>
                <th>Expira</th>
              </tr>
            </thead>
            <tbody>
              ${invitations.map((inv) => {
                const status = mapStatus(inv.status);
                return `
                  <tr>
                    <td data-label="Proveedor"><strong>${rootShellUi.escapeHtml(inv.supplierName || 'Proveedor')}</strong></td>
                    <td data-label="Email">${rootShellUi.escapeHtml(inv.supplierEmail || '—')}</td>
                    <td data-label="Estado"><span class="${rootShellUi.escapeHtml(status.badgeClass)}">${rootShellUi.escapeHtml(status.label)}</span></td>
                    <td data-label="Respondida">${rootShellUi.escapeHtml(formatDate(inv.respondedAt))}</td>
                    <td data-label="Expira">${rootShellUi.escapeHtml(formatDate(inv.expiresAt))}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderResponseDetails(request) {
    const quotations = (request?.quotations || []).filter((q) => q?.responseSource != null);
    if (!quotations.length) {
      return '';
    }

    return `
      <div class="stack-section">
        <h4>Detalle de respuestas</h4>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Lead time</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              ${quotations.flatMap((quotation) => (quotation.items || []).map((item) => `
                <tr>
                  <td data-label="Proveedor"><strong>${rootShellUi.escapeHtml(quotation.supplierName || 'Proveedor')}</strong></td>
                  <td data-label="Producto">${rootShellUi.escapeHtml(item.productName || 'Producto')}</td>
                  <td data-label="Cantidad">${rootShellUi.escapeHtml(String(item.quantity || 0))}</td>
                  <td data-label="Precio unitario">${rootShellUi.escapeHtml(String(item.unitPrice || '—'))}</td>
                  <td data-label="Lead time">${item.leadTimeDays != null ? rootShellUi.escapeHtml(String(item.leadTimeDays)) + ' días' : '—'}</td>
                  <td data-label="Origen">${rootShellUi.escapeHtml(quotation.responseSource || '—')}</td>
                </tr>
              `)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderRequestListItem(request) {
    const requestState = deriveRequestOperationalState(request);
    const invitations = request.invitations || [];
    return `
      <button
        class="commercial-list-item"
        type="button"
        role="listitem"
        data-request-id="${rootShellUi.escapeHtml(String(request.purchaseRequestId))}"
        aria-pressed="false"
      >
        <span class="commercial-list-item__title">
          ${rootShellUi.escapeHtml(request.title || `Solicitud #${request.purchaseRequestId}`)}
        </span>
        <span class="commercial-list-item__meta">
          ${rootShellUi.escapeHtml(String(request.itemCount || 0))} producto(s) · Creada ${rootShellUi.escapeHtml(formatDate(request.createdAt))}
        </span>
        <span class="commercial-list-item__badges">
          <span class="${rootShellUi.escapeHtml(requestState.badgeClass)}">${rootShellUi.escapeHtml(requestState.label)}</span>
          <span class="badge">${rootShellUi.escapeHtml(String(invitations.length))} inv.</span>
        </span>
      </button>
    `;
  }

  function renderDetailPlaceholder() {
    return `
      <div class="empty-state" style="padding: 48px 0;">
        <p class="muted">← Selecciona una solicitud de la lista para ver su detalle.</p>
      </div>
    `;
  }

  function renderRequestDetail(request, canManage) {
    const requestState = deriveRequestOperationalState(request);
    const invitations = request.invitations || [];
    return `
      <div class="page-header">
        <div>
          <h3>${rootShellUi.escapeHtml(request.title || `Solicitud #${request.purchaseRequestId}`)}</h3>
          <p class="muted">Creada: ${rootShellUi.escapeHtml(formatDate(request.createdAt))} · ${rootShellUi.escapeHtml(String(request.itemCount || 0))} producto(s)</p>
        </div>
        <span class="${rootShellUi.escapeHtml(requestState.badgeClass)}">${rootShellUi.escapeHtml(requestState.label)}</span>
      </div>
      <div class="tag-list">
        <span class="badge">${rootShellUi.escapeHtml(`Invitaciones: ${invitations.length}`)}</span>
        <span class="badge">${rootShellUi.escapeHtml(`Cotizaciones: ${request.quotationCount || 0}`)}</span>
        <span class="badge badge-success">${rootShellUi.escapeHtml(`Respondidas: ${request.respondedInvitationCount || 0}`)}</span>
        <span class="badge">${rootShellUi.escapeHtml(`Manuales: ${request.manualResponseCount || 0}`)}</span>
        <span class="badge">${rootShellUi.escapeHtml(`Públicas: ${request.publicResponseCount || 0}`)}</span>
      </div>
      ${renderItemsSection(request)}
      ${renderPendingResponseSection(invitations, request, canManage)}
      <div class="stack-section">
        <h4>Estado del request</h4>
        <p class="muted">${rootShellUi.escapeHtml(requestState.description)}</p>
      </div>
      ${invitations.length ? renderInvitationsTable(invitations) : '<div class="empty-state"><p class="muted">Pendiente de invitar proveedores.</p></div>'}
      ${renderResponseDetails(request)}
      ${canManage ? renderCloseSection(request) : ''}
    `;
  }

  function renderManualResponseDialog(invitation, request) {
    const items = request?.items || [];
    return `
      <fieldset class="root-form__section">
        <legend>Datos generales</legend>
        <div class="root-form-grid">
          <label>
            <span>Moneda *</span>
            <select id="rfq-tracking-manual-currency" name="currency" required>
              <option value="CRC">CRC — Colón</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </label>
          <label>
            <span>Notas</span>
            <textarea id="rfq-tracking-manual-notes" name="notes" maxlength="2000" rows="2"></textarea>
          </label>
        </div>
      </fieldset>
      <fieldset class="root-form__section">
        <legend>Productos de la solicitud</legend>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad *</th>
                <th>Precio unitario *</th>
                <th>Lead time</th>
              </tr>
            </thead>
            <tbody id="rfq-tracking-manual-items-body">
              ${items.map((item) => `
                <tr data-product-id="${rootShellUi.escapeHtml(String(item.productId))}">
                  <td data-label="Producto"><strong>${rootShellUi.escapeHtml(item.productName || 'Producto')}</strong></td>
                  <td data-label="Cantidad"><input type="number" name="quantity" min="0.01" step="0.01" value="${rootShellUi.escapeHtml(String(item.quantity || ''))}" required /></td>
                  <td data-label="Precio unitario"><input type="number" name="unitPrice" min="0.01" step="0.01" required /></td>
                  <td data-label="Lead time"><input type="number" name="leadTimeDays" min="0" step="1" /></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </fieldset>
    `;
  }

  rootShell.register('views.rfqTrackingAdminRenderers', {
    renderEmptyState,
    renderDetailPlaceholder,
    renderRequestListItem,
    renderRequestDetail,
    renderManualResponseDialog,
  });
}(window));
