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

  /**
   * Misma lógica que compareSupplierQuotations del backend:
   * el responseSource se deriva de evidence._source o rfqInvitations,
   * NO del campo responseSource crudo del quotation (que puede ser null).
   */
  function deriveResponseSource(q) {
    if (Array.isArray(q.rfqInvitations) && q.rfqInvitations.length > 0) {
      return q.rfqInvitations[0].responseSource || 'MANUAL_OFFICE_EMAIL';
    }
    const evidence = q.evidence && typeof q.evidence === 'object' && !Array.isArray(q.evidence)
      ? q.evidence : null;
    if (evidence && evidence._source === 'DIRECT_ENTRY') return 'DIRECT_ENTRY';
    return null;
  }

  function computeQuotationTotal(q) {
    return (q.items || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  }

  function renderQuotationsSection(quotations) {
    if (!quotations || !quotations.length) {
      return '<p class="muted" style="font-size:0.85rem;">Sin cotizaciones registradas aún.</p>';
    }

    // Agrupar por proveedor (mismo algoritmo que el backend) para eliminar duplicados
    // y resolver responseSource correctamente desde evidence._source o rfqInvitations.
    const bySupplier = new Map();
    for (const q of quotations) {
      const key = String(q.supplierId || q.supplier?.id || '');
      const responseSource = deriveResponseSource(q);
      const actual = responseSource !== null;
      if (!bySupplier.has(key)) {
        bySupplier.set(key, { name: q.supplier?.name || '—', currency: q.currency || 'CRC', quotations: [], hasActual: false });
      }
      const bucket = bySupplier.get(key);
      bucket.quotations.push({ q, responseSource, actual });
      if (actual) bucket.hasActual = true;
    }

    // Colapsar a una entrada por proveedor: si tiene respuesta real, descartar las de catálogo.
    const merged = [];
    for (const [, bucket] of bySupplier) {
      const keep = bucket.hasActual ? bucket.quotations.filter((e) => e.actual) : bucket.quotations;
      const entry = keep.reduce((acc, { q, responseSource }) => {
        const itemTotal = computeQuotationTotal(q);
        if (!acc) {
          return {
            name: bucket.name,
            currency: q.currency || bucket.currency,
            responseSource,
            items: [...(q.items || [])],
            total: itemTotal,
          };
        }
        acc.items = [...acc.items, ...(q.items || [])];
        acc.total += itemTotal;
        if (!acc.responseSource && responseSource) acc.responseSource = responseSource;
        return acc;
      }, null);
      if (entry) merged.push(entry);
    }

    const sourceLabel = (src) => {
      if (src === 'DIRECT_ENTRY') return { text: 'Ingresada directamente', cls: 'badge-success' };
      if (src === 'MANUAL_OFFICE_EMAIL') return { text: 'Respuesta manual', cls: 'badge-success' };
      if (src === 'PUBLIC_TOKEN') return { text: 'Respuesta pública (RFQ)', cls: 'badge-success' };
      return { text: '⏳ Sin respuesta', cls: '' };
    };

    const formatTotal = (total, currency) => {
      try {
        return Number(total).toLocaleString('es-CR', { style: 'currency', currency: currency || 'CRC', minimumFractionDigits: 2 });
      } catch (_e) {
        return `${currency} ${Number(total).toFixed(2)}`;
      }
    };

    const responded = merged.filter((e) => e.responseSource);
    const catalogOnly = merged.filter((e) => !e.responseSource);

    const buildRow = (entry) => {
      const src = sourceLabel(entry.responseSource);
      const name = rootShellUi.escapeHtml(entry.name);
      const totalStr = rootShellUi.escapeHtml(formatTotal(entry.total, entry.currency));
      const currency = rootShellUi.escapeHtml(entry.currency || 'CRC');
      const productList = entry.items.map((i) => {
        const pname = rootShellUi.escapeHtml(i.product?.name || i.productName || `#${i.productId}`);
        const qty = rootShellUi.escapeHtml(String(i.quantity || 0));
        const up = rootShellUi.escapeHtml(formatTotal(i.unitPrice || 0, entry.currency));
        return `<span style="font-size:0.78rem;display:block;">${pname}: ${qty} u · ${up}</span>`;
      }).join('');
      return `<tr>
        <td data-label="Proveedor"><strong>${name}</strong><div style="margin-top:0.25rem;">${productList}</div></td>
        <td data-label="Origen"><span class="badge ${rootShellUi.escapeHtml(src.cls)}">${rootShellUi.escapeHtml(src.text)}</span></td>
        <td data-label="Total"><strong>${totalStr}</strong></td>
        <td data-label="Moneda">${currency}</td>
      </tr>`;
    };

    const tableHead = `<thead><tr>
      <th scope="col">Proveedor · Productos</th>
      <th scope="col">Origen</th>
      <th scope="col">Total</th>
      <th scope="col">Moneda</th>
    </tr></thead>`;

    const sections = [];
    if (responded.length) {
      sections.push(`
        <p class="muted" style="font-size:0.8rem;margin:0 0 0.4rem;">Respuestas confirmadas</p>
        <div class="table-wrapper" style="margin-bottom:0.75rem;">
          <table aria-label="Cotizaciones recibidas">${tableHead}<tbody>${responded.map(buildRow).join('')}</tbody></table>
        </div>`);
    }
    if (catalogOnly.length) {
      sections.push(`
        <p class="muted" style="font-size:0.8rem;margin:0 0 0.4rem;">Solo precio histórico (sin respuesta confirmada)</p>
        <div class="table-wrapper">
          <table aria-label="Proveedores sin respuesta">${tableHead}<tbody>${catalogOnly.map(buildRow).join('')}</tbody></table>
        </div>`);
    }
    return sections.join('');
  }

  function renderSelectionsSection(selections) {
    if (!selections || !selections.length) {
      return '<p class="muted" style="font-size:0.85rem;">Sin selección de proveedor registrada.</p>';
    }

    // Deduplicar por quotationId — pueden existir duplicados si se seleccionó más de una vez.
    const seen = new Set();
    const unique = selections.filter((sel) => {
      const key = String(sel.quotationId || sel.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const formatTotal = (total, currency) => {
      try {
        return Number(total || 0).toLocaleString('es-CR', { style: 'currency', currency: currency || 'CRC', minimumFractionDigits: 2 });
      } catch (_e) { return `${currency} ${Number(total || 0).toFixed(2)}`; }
    };

    const rows = unique.map((sel) => {
      const name = rootShellUi.escapeHtml(sel.quotation?.supplier?.name || '—');
      const approvalBadge = sel.approvalRequired
        ? (sel.approvalStatus === 'APPROVED'
          ? '<span class="badge badge-success">Aprobada</span>'
          : '<span class="badge badge-warning">Pendiente aprobación</span>')
        : '<span class="badge badge-info">Directa</span>';
      const products = (sel.quotation?.items || []).map((i) =>
        rootShellUi.escapeHtml(i.product?.name || i.productName || `#${i.productId}`)).join(', ');
      const totalStr = rootShellUi.escapeHtml(formatTotal(sel.totalAmount, sel.currency));
      return `<tr>
        <td data-label="Proveedor"><strong>${name}</strong></td>
        <td data-label="Aprobación">${approvalBadge}</td>
        <td data-label="Total">${totalStr}</td>
        <td data-label="Productos">${products || '—'}</td>
      </tr>`;
    }).join('');

    return `<div class="table-wrapper">
      <table aria-label="Selección de proveedores">
        <thead><tr>
          <th scope="col">Proveedor</th>
          <th scope="col">Aprobación</th>
          <th scope="col">Total</th>
          <th scope="col">Productos</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderPurchaseOrdersSection(purchaseOrders) {
    if (!purchaseOrders || !purchaseOrders.length) {
      return '<p class="muted" style="font-size:0.85rem;">Sin órdenes de compra generadas.</p>';
    }

    const formatTotal = (total, currency) => {
      try {
        return Number(total || 0).toLocaleString('es-CR', { style: 'currency', currency: currency || 'CRC', minimumFractionDigits: 2 });
      } catch (_e) { return `${currency} ${Number(total || 0).toFixed(2)}`; }
    };

    const rows = purchaseOrders.map((po) => {
      const name = rootShellUi.escapeHtml(po.supplier?.name || '—');
      // Siempre calcular desde ítems — el campo totalAmount almacenado puede ser 0.
      const computedTotal = (po.items || []).reduce(
        (s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0,
      );
      const currency = po.currency || po.items?.[0]?.currency || 'CRC';
      const total = rootShellUi.escapeHtml(formatTotal(computedTotal, currency));
      const products = (po.items || []).map((i) =>
        rootShellUi.escapeHtml(i.product?.name || i.productName || `#${i.productId}`)).join(', ');
      const PO_STATUS = {
        PENDING:   '<span class="badge badge-info">Pendiente</span>',
        ISSUED:    '<span class="badge badge-success">Emitida</span>',
        RECEIVED:  '<span class="badge badge-success">Recibida</span>',
        CANCELLED: '<span class="badge badge-danger">Cancelada</span>',
      };
      const statusBadge = PO_STATUS[po.status] || `<span class="badge">${rootShellUi.escapeHtml(po.status || '—')}</span>`;
      return `<tr>
        <td data-label="OC #"><strong>#${rootShellUi.escapeHtml(String(po.id))}</strong></td>
        <td data-label="Proveedor">${name}</td>
        <td data-label="Total">${total}</td>
        <td data-label="Estado">${statusBadge}</td>
        <td data-label="Productos">${products || '—'}</td>
      </tr>`;
    }).join('');

    return `<div class="table-wrapper">
      <table aria-label="Órdenes de compra">
        <thead><tr>
          <th scope="col">OC #</th>
          <th scope="col">Proveedor</th>
          <th scope="col">Total</th>
          <th scope="col">Estado</th>
          <th scope="col">Productos</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderRequestDetail(request) {
    if (!request) {
      return '<p class="empty-state">Selecciona una solicitud para ver el detalle.</p>';
    }

    const title = rootShellUi.escapeHtml(request.title || `Solicitud #${request.id}`);
    const date = rootShellUi.escapeHtml(rootShellUi.formatDate(request.createdAt));
    const statusBadge = getStatusBadge(request.status);
    const items = request.items || [];
    const quotations = request.quotations || [];
    const selections = request.selections || [];
    const purchaseOrders = request.purchaseOrders || [];

    // Contar respuestas reales: cotizaciones con responseSource (directas o RFQ)
    const respondedCount = quotations.filter((q) => q.responseSource).length;

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
            ${purchaseOrders.length ? `<span> · <strong>${rootShellUi.escapeHtml(String(purchaseOrders.length))} OC generada(s)</strong></span>` : ''}
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

      <div class="stack-section">
        <h4>Cotizaciones (${rootShellUi.escapeHtml(String(quotations.length))} proveedor(es))</h4>
        ${renderQuotationsSection(quotations)}
      </div>

      ${selections.length ? `
      <div class="stack-section">
        <h4>Selección de proveedor</h4>
        ${renderSelectionsSection(selections)}
      </div>` : ''}

      ${purchaseOrders.length ? `
      <div class="stack-section">
        <h4>Órdenes de compra</h4>
        ${renderPurchaseOrdersSection(purchaseOrders)}
      </div>` : ''}

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
    renderQuotationsSection,
    renderSelectionsSection,
    renderPurchaseOrdersSection,
  });
}(window));
