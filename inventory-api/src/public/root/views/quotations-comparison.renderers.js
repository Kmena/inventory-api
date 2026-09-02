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

  function responseSourceBadge(source) {
    const map = {
      DIRECT_ENTRY:        { label: 'Ingresado directamente', cls: 'badge-info' },
      MANUAL_OFFICE_EMAIL: { label: 'RFQ · respuesta manual',  cls: 'badge-info' },
      PUBLIC_TOKEN:        { label: 'RFQ · respuesta pública',  cls: 'badge-success' },
    };
    const entry = map[source];
    if (entry) {
      return `<span class="badge ${rootShellUi.escapeHtml(entry.cls)}" style="font-size:0.75rem;">${rootShellUi.escapeHtml(entry.label)}</span>`;
    }
    return '<span class="badge badge-warning" style="font-size:0.75rem;">⏳ Sin respuesta del proveedor</span>';
  }

  function renderQuotationRow(q, showAction) {
    const supplierName = q.supplier?.name || q.supplierName || '—';
    const leadTime = q.averageLeadTimeDays != null
      ? `${Math.round(q.averageLeadTimeDays)} días`
      : '—';
    const itemsHtml = renderItemsList(q.items, q.currency);
    const actionCell = showAction
      ? `<button
           type="button"
           class="quotations-select-supplier-button"
           data-quotation-id="${rootShellUi.escapeHtml(String(q.id))}"
           data-supplier-name="${rootShellUi.escapeHtml(supplierName)}"
           data-total-amount="${rootShellUi.escapeHtml(String(q.totalAmount || 0))}"
           data-currency="${rootShellUi.escapeHtml(q.currency || '')}"
           aria-label="Seleccionar a ${rootShellUi.escapeHtml(supplierName)} como proveedor"
         >Seleccionar este proveedor</button>`
      : '<span class="muted" style="font-size:0.8rem;">Registrá una cotización para seleccionar</span>';

    return `
      <tr>
        <td data-label="Proveedor · Origen">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <strong>${rootShellUi.escapeHtml(supplierName)}</strong>
            ${responseSourceBadge(q.responseSource)}
          </div>
          <div style="margin-top:0.4rem;">${itemsHtml}</div>
        </td>
        <td data-label="Referencia"><span class="badge badge-info">${rootShellUi.escapeHtml(q.reference || '—')}</span></td>
        <td data-label="Moneda">${rootShellUi.escapeHtml(q.currency || '—')}</td>
        <td data-label="Precio total"><strong>${rootShellUi.escapeHtml(formatCurrency(q.totalAmount, q.currency))}</strong></td>
        <td data-label="Lead time prom.">${rootShellUi.escapeHtml(leadTime)}</td>
        <td data-label="Acción">${actionCell}</td>
      </tr>
    `;
  }

  function renderTable(rows, label) {
    return `
      <div class="table-wrapper">
        <table aria-label="${rootShellUi.escapeHtml(label)}">
          <thead>
            <tr>
              <th scope="col">Proveedor · Origen</th>
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

  function renderComparisonTable(quotations) {
    if (!quotations || !quotations.length) {
      return '<p class="empty-state">No hay cotizaciones con respuesta para comparar.</p>';
    }

    const responded = quotations.filter((q) => q.responseSource);
    const catalogOnly = quotations.filter((q) => !q.responseSource);

    const sections = [];

    if (responded.length) {
      sections.push(`
        <div class="stack-section">
          <h4 style="margin:0 0 0.5rem;">Respuestas recibidas</h4>
          <p class="muted" style="margin:0 0 0.75rem;font-size:0.85rem;">Precios confirmados por el proveedor · ordenados por precio total ascendente</p>
          ${renderTable(responded.map((q) => renderQuotationRow(q, true)).join(''), 'Respuestas de proveedores')}
        </div>
      `);
    }

    if (catalogOnly.length) {
      sections.push(`
        <div class="stack-section">
          <h4 style="margin:0 0 0.5rem;">Precio histórico de catálogo</h4>
          <p class="muted" style="margin:0 0 0.75rem;font-size:0.85rem;">Estos proveedores aún no han enviado una cotización para esta solicitud. Los precios mostrados son los últimos registrados en el sistema y no están confirmados.</p>
          ${renderTable(catalogOnly.map((q) => renderQuotationRow(q, false)).join(''), 'Precios de catálogo sin respuesta')}
        </div>
      `);
    }

    return sections.join('');
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

  /**
   * Matriz producto × proveedor con radio buttons.
   * Cada fila es un producto de la solicitud; cada columna es un proveedor que respondió.
   * El proveedor más barato por línea se pre-selecciona.
   *
   * @param {object[]} respondedQuotations - Cotizaciones con responseSource != null
   * @returns {string} HTML
   */
  /**
   * @param {any[]} respondedQuotations
   * @param {Set<string>} [lockedProductIds] - products already covered by an active OC
   */
  function renderProductMatrix(respondedQuotations, lockedProductIds = new Set()) {
    if (!respondedQuotations || !respondedQuotations.length) return '';

    // Build set of all products across all quotations
    const productMap = new Map(); // productId → { id, name }
    for (const q of respondedQuotations) {
      for (const item of (q.items || [])) {
        const pid = String(item.productId);
        if (!productMap.has(pid)) {
          productMap.set(pid, {
            id: pid,
            name: item.product?.name || item.productName || `Producto #${pid}`,
          });
        }
      }
    }

    if (!productMap.size) return '';

    // For each product, find the quotation with lowest unit price → default selection
    const cheapestByProduct = new Map(); // productId → quotationId
    for (const [pid] of productMap) {
      let bestPrice = Infinity;
      let bestQid = null;
      for (const q of respondedQuotations) {
        const item = (q.items || []).find((i) => String(i.productId) === pid);
        if (item && Number(item.unitPrice) < bestPrice) {
          bestPrice = Number(item.unitPrice);
          bestQid = String(q.id);
        }
      }
      if (bestQid) cheapestByProduct.set(pid, bestQid);
    }

    // Column headers
    const supplierHeaders = respondedQuotations.map((q) => {
      const name = rootShellUi.escapeHtml(q.supplier?.name || q.supplierName || '—');
      const badge = responseSourceBadge(q.responseSource);
      return `<th scope="col" style="text-align:center;min-width:130px;">${name}<br/>${badge}</th>`;
    }).join('');

    // Product rows
    const productRows = [...productMap.entries()].map(([pid, product]) => {
      const isLocked = lockedProductIds.has(pid);
      const rowStyle = isLocked
        ? 'opacity:0.45;background:#f3f4f6;pointer-events:none;'
        : '';
      const lockedBadge = isLocked
        ? `<span class="badge" style="font-size:0.65rem;background:#d1d5db;color:#374151;margin-left:0.4rem;" title="Ya tiene OC activa">OC activa</span>`
        : '';

      const cells = respondedQuotations.map((q) => {
        const item = (q.items || []).find((i) => String(i.productId) === pid);
        if (!item) {
          return `<td style="text-align:center;color:var(--muted-color,#9ca3af);">—</td>`;
        }
        const qid = String(q.id);
        const defaultChecked = !isLocked && cheapestByProduct.get(pid) === qid ? 'checked' : '';
        const isCheapest = cheapestByProduct.get(pid) === qid;
        const priceLabel = rootShellUi.escapeHtml(formatCurrency(item.unitPrice, q.currency));
        const leadLabel = item.leadTimeDays != null ? `${item.leadTimeDays}d` : '—';
        return `
          <td style="text-align:center;">
            <label style="display:flex;flex-direction:column;align-items:center;gap:0.2rem;${isLocked ? '' : 'cursor:pointer;'}">
              <input
                type="radio"
                name="product-${rootShellUi.escapeHtml(pid)}"
                value="${rootShellUi.escapeHtml(qid)}"
                data-product-id="${rootShellUi.escapeHtml(pid)}"
                data-quotation-id="${rootShellUi.escapeHtml(qid)}"
                data-unit-price="${rootShellUi.escapeHtml(String(item.unitPrice))}"
                data-quantity="${rootShellUi.escapeHtml(String(item.quantity))}"
                data-currency="${rootShellUi.escapeHtml(q.currency || 'CRC')}"
                class="quotations-matrix-radio"
                ${defaultChecked}
                ${isLocked ? 'disabled aria-disabled="true"' : ''}
              />
              <strong style="font-size:0.8rem;${isCheapest && !isLocked ? 'color:var(--success-color,#16a34a);' : ''}">${priceLabel}</strong>
              <span class="badge" style="font-size:0.65rem;">${rootShellUi.escapeHtml(leadLabel)}</span>
            </label>
          </td>
        `;
      }).join('');
      return `
        <tr style="${rowStyle}">
          <td style="font-weight:600;white-space:nowrap;">
            ${rootShellUi.escapeHtml(product.name)}${lockedBadge}
          </td>
          ${cells}
        </tr>
      `;
    }).join('');

    return `
      <div class="table-wrapper" style="overflow-x:auto;">
        <table id="quotations-product-matrix" aria-label="Selección de proveedor por producto">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              ${supplierHeaders}
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
        </table>
      </div>
      <p class="muted" style="font-size:0.8rem;margin:0.5rem 0 0;">El precio más bajo por producto está marcado en verde y pre-seleccionado. Cambiá la selección si preferís otro proveedor por línea.</p>
      <div id="quotations-matrix-footer" style="margin-top:1rem;"></div>
    `;
  }

  /**
   * Renderiza el pie de la matriz con subtotales por proveedor y el botón de confirmación.
   * @param {{ supplierName: string, supplierId: string, totalAmount: number, currency: string, itemCount: number }[]} groups
   */
  function renderMatrixFooter(groups) {
    if (!groups || !groups.length) return '';
    const cols = groups.map((g) => `
      <div style="flex:1;text-align:center;padding:0.5rem;border:1px solid var(--border-color,#e5e7eb);border-radius:6px;">
        <div style="font-weight:600;font-size:0.85rem;">${rootShellUi.escapeHtml(g.supplierName)}</div>
        <div style="font-size:0.9rem;margin-top:0.2rem;">${rootShellUi.escapeHtml(formatCurrency(g.totalAmount, g.currency))}</div>
        <div class="muted" style="font-size:0.75rem;">${g.itemCount} producto(s)</div>
      </div>
    `).join('');
    const orderCount = groups.length;
    return `
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">${cols}</div>
      <p class="muted" style="font-size:0.82rem;margin:0 0 0.75rem;">Se generarán <strong>${orderCount}</strong> orden(es) de compra — una por proveedor.</p>
      <button type="button" id="quotations-confirm-mixed-button">Confirmar selección mixta</button>
    `;
  }

  rootShell.register('views.quotationsComparisonRenderers', {
    formatCurrency,
    renderComparisonTable,
    renderCreatePoSummary,
    renderProductMatrix,
    renderMatrixFooter,
  });
}(window));
