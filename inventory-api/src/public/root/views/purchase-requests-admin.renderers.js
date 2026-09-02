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

  /**
   * Genera el cuerpo de un machote de correo para un proveedor cuando no hay
   * invitaciones RFQ previas (machote client-side sin enlace seguro).
   *
   * @param {string} supplierName
   * @param {Array<{productName:string, quantity:number|string, unit?:string}>} items
   * @returns {string}
   */
  function buildFallbackEmailBody(supplierName, items) {
    const productLines = items
      .map((item) => `- ${item.productName}: ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`)
      .join('\n');
    return [
      `Estimado(a) ${supplierName},`,
      '',
      'Le solicitamos amablemente nos indique disponibilidad y precio para los siguientes productos:',
      '',
      productLines,
      '',
      'Quedamos atentos a su respuesta.',
      '',
      'Atentamente,',
    ].join('\n');
  }

  /**
   * Renders a single email draft card.
   *
   * @param {object} opts
   * @param {string} opts.supplierName
   * @param {string} opts.emailTo       Raw email address (unescaped).
   * @param {string} opts.subject       Raw subject string (unescaped).
   * @param {string} opts.body          Raw body string (unescaped).
   * @param {string} opts.bodyId        Unique DOM id for the textarea.
   * @returns {string}
   */
  function renderEmailDraftCard({ supplierName, emailTo, subject, body, bodyId }) {
    const safeName    = rootShellUi.escapeHtml(supplierName);
    const safeEmail   = rootShellUi.escapeHtml(emailTo);
    const safeSubject = rootShellUi.escapeHtml(subject);
    const safeId      = rootShellUi.escapeHtml(bodyId);

    const mailtoHref = emailTo
      ? `mailto:${safeEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : '';

    const emailRow = emailTo
      ? `
        <div class="purchase-request-email-draft-to">
          <span class="purchase-request-email-draft-to-label">Para:</span>
          <a href="mailto:${safeEmail}" class="purchase-request-email-draft-to-address">${safeEmail}</a>
        </div>`
      : `<p class="muted" style="font-size:.85em">⚠ Este proveedor no tiene correo electrónico registrado.</p>`;

    return `
      <div class="purchase-request-email-draft">
        <div class="purchase-request-email-draft-header">
          <strong>${safeName}</strong>
        </div>
        ${emailRow}
        <div class="purchase-request-email-draft-subject">
          <span class="purchase-request-email-draft-subject-label">Asunto:</span>
          <span>${safeSubject}</span>
        </div>
        <textarea
          id="${safeId}"
          class="purchase-request-email-body"
          readonly
          rows="8"
          aria-label="Machote de correo para ${safeName}"
        >${rootShellUi.escapeHtml(body)}</textarea>
        <div class="action-row compact-action-row" style="margin-top:.5rem">
          ${emailTo
            ? `<a href="${mailtoHref}" class="secondary-button" target="_blank" rel="noopener">✉ Abrir en cliente de correo</a>`
            : ''}
          <button
            type="button"
            class="secondary-button purchase-request-copy-email-btn"
            data-target="${safeId}"
            aria-label="Copiar texto del correo para ${safeName}"
          >Copiar texto</button>
        </div>
      </div>
    `;
  }

  /**
   * Renders the email draft section for a purchase request.
   *
   * Priority cascade:
   *   1. RFQ invitations (server-generated subject + body + emailTo)
   *   2. request.quotations — each quotation carries supplier.email
   *   3. Generic fallback (no supplier data available at all)
   *
   * @param {Array<object>} invitations - RFQ invitations (may be empty).
   * @param {object}        request     - Full purchase request object.
   * @param {string}        state       - 'loading' | 'ready' | 'error'
   * @returns {string}
   */
  function renderEmailDrafts(invitations, request, state) {
    if (state === 'loading') {
      return '<p class="muted" style="padding:.5rem 0">Cargando machotes...</p>';
    }
    if (state === 'error') {
      return '<p class="muted" style="color:var(--color-danger,#c00)">No se pudieron cargar los machotes.</p>';
    }

    const requestItems = request?.items || [];
    const normalizedItems = requestItems.map((item) => ({
      productName: item.product?.name || item.productName || `Producto #${item.productId}`,
      quantity: item.quantity || 0,
      unit: item.product?.netContentUnit || item.product?.unit || item.unit || '',
    }));

    const defaultSubject = `Solicitud de cotización: ${request?.title || `Solicitud #${request?.id}`}`;

    // ── Caso 1: invitaciones RFQ con email generado por el servidor ──
    if (Array.isArray(invitations) && invitations.length > 0) {
      const cards = invitations.map((inv, idx) => {
        const supplierName = inv.supplier?.name || 'Proveedor';
        const emailTo      = inv.emailTo || inv.supplier?.email || '';
        const subject      = inv.emailSubject || defaultSubject;
        const body         = inv.emailBody || buildFallbackEmailBody(supplierName, normalizedItems);
        const bodyId       = `pr-email-body-inv-${rootShellUi.escapeHtml(String(inv.id || idx))}`;
        return renderEmailDraftCard({ supplierName, emailTo, subject, body, bodyId });
      }).join('');

      return `<div class="purchase-request-email-drafts-list">${cards}</div>`;
    }

    // ── Caso 2: sin invitaciones pero request.quotations trae proveedores ──
    const quotations = request?.quotations || [];
    if (quotations.length > 0) {
      // Agrupar por supplierId para no repetir proveedor.
      const bySupplier = new Map();
      for (const q of quotations) {
        const supplierId = String(q.supplierId || q.supplier?.id || '');
        if (!supplierId || bySupplier.has(supplierId)) continue;
        bySupplier.set(supplierId, {
          supplier: q.supplier || { name: 'Proveedor', email: null },
          // Preferimos los items de la cotización; si no, usamos los de la solicitud.
          items: (q.items || []).length > 0
            ? (q.items || []).map((qi) => ({
                productName: qi.product?.name || qi.productName || `Producto #${qi.productId}`,
                quantity: qi.quantity || 0,
                unit: qi.product?.netContentUnit || qi.product?.unit || '',
              }))
            : normalizedItems,
        });
      }

      if (bySupplier.size > 0) {
        const notice = `
          <p class="muted" style="font-size:.85em;margin-bottom:.75rem">
            Los siguientes machotes se generaron a partir de las cotizaciones recibidas.
            No hay invitaciones RFQ activas para esta solicitud.
          </p>`;

        const cards = [...bySupplier.values()].map(({ supplier, items }, idx) => {
          const supplierName = supplier.name || 'Proveedor';
          const emailTo      = supplier.email || '';
          const body         = buildFallbackEmailBody(supplierName, items);
          const bodyId       = `pr-email-body-q-${idx}`;
          return renderEmailDraftCard({ supplierName, emailTo, subject: defaultSubject, body, bodyId });
        }).join('');

        return `${notice}<div class="purchase-request-email-drafts-list">${cards}</div>`;
      }
    }

    // ── Caso 3: sin ningún dato de proveedor disponible ──
    const genericBody = buildFallbackEmailBody('(proveedor)', normalizedItems);
    const genericBodyId = 'pr-email-body-generic';

    return `
      <p class="muted" style="font-size:.85em;margin-bottom:.75rem">
        No hay invitaciones ni cotizaciones vinculadas a esta solicitud.
        Copia el texto y completa el destinatario manualmente.
      </p>
      ${renderEmailDraftCard({
        supplierName: 'Destinatario',
        emailTo: '',
        subject: defaultSubject,
        body: genericBody,
        bodyId: genericBodyId,
      })}
    `;
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
          <button
            type="button"
            class="secondary-button purchase-requests-show-email-drafts-button"
            aria-expanded="false"
            aria-controls="purchase-requests-email-drafts-section"
            aria-label="Mostrar machotes de correo para proveedores"
          >✉ Machotes de correo</button>
          ${goToQuotationsButton}
        </div>
      </div>

      <div class="stack-section">
        <h4>Productos solicitados</h4>
        ${itemsTable}
      </div>

      <div
        id="purchase-requests-email-drafts-section"
        class="stack-section"
        aria-live="polite"
        hidden
      >
        <h4>Machotes de correo por proveedor</h4>
        <div id="purchase-requests-email-drafts-content"></div>
      </div>
    `;
  }

  rootShell.register('views.purchaseRequestsAdminRenderers', {
    renderRequestList,
    renderRequestDetail,
    renderEmailDrafts,
  });
}(window));
