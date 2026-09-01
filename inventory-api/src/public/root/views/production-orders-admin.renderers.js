(function attachRootShellProductionOrdersAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const productionOrdersState = rootShell.require('views.productionOrdersAdminState');

  function renderMetricCard(label, value) {
    return `
      <article class="card root-card metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderMetrics(orders) {
    const metrics = productionOrdersState.buildOrderMetrics(orders);
    return [
      renderMetricCard('Borrador', metrics.draftCount),
      renderMetricCard('Pend. aprobación', metrics.pendingApprovalCount),
      renderMetricCard('Aprobadas', metrics.approvedCount),
      renderMetricCard('En progreso', metrics.inProgressCount),
      renderMetricCard('QA Hold', metrics.qaHoldCount),
      renderMetricCard('Completadas', metrics.completedCount),
    ].join('');
  }

  function renderState(title, description) {
    return `
      <div class="products-empty-panel">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
      </div>
    `;
  }

  function renderOptionList(items, selectedValue = '', placeholder = 'Todos') {
    return [`<option value="">${rootShellUi.escapeHtml(placeholder)}</option>`]
      .concat((items || []).map((item) => {
        const isSelected = String(item?.value) === String(selectedValue);
        return `<option value="${rootShellUi.escapeHtml(String(item?.value || ''))}" ${isSelected ? 'selected' : ''}>${rootShellUi.escapeHtml(item?.label || '')}</option>`;
      }))
      .join('');
  }

  function renderOrdersTable(items, selectedOrderId) {
    if (!items.length) {
      return '';
    }

    return `
      <div class="table-wrapper">
        <table style="min-width:0;width:100%">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Estado</th>
              <th>Fecha plan.</th>
              <th class="products-action-cell"></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((order) => {
              const isSelected = String(order?.id) === String(selectedOrderId);
              return `
                <tr ${isSelected ? 'class="is-selected"' : ''}>
                  <td>
                    <strong>${rootShellUi.escapeHtml(order?.orderId || `ORD-${order?.id || ''}`)}</strong><br>
                    <span class="muted" style="font-size:0.8rem">${rootShellUi.escapeHtml(order?.product?.name || '—')}${order?.recipe?.name ? ` · ${rootShellUi.escapeHtml(order.recipe.name)}` : ''}</span>
                  </td>
                  <td>${productionOrdersState.renderStatusBadge(order, rootShellUi)}</td>
                  <td style="white-space:nowrap;font-size:0.85rem">${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.plannedDate))}</td>
                  <td class="products-action-cell">
                    <button class="secondary-button" type="button"
                            data-production-order-detail="${rootShellUi.escapeHtml(order?.id)}"
                            style="padding:0.2rem 0.6rem;font-size:0.8rem">
                      ${isSelected ? 'Detalle abierto' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPagination(pagination) {
    const totalPages = Number(pagination?.totalPages) || 0;
    const currentPage = Number(pagination?.page) || 1;
    const totalItems = Number(pagination?.totalItems) || 0;

    if (!totalItems || totalPages <= 1) {
      return '';
    }

    return `
      <div class="movements-pagination">
        <button id="production-orders-previous-page-button" class="secondary-button" type="button" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <p class="muted" aria-live="polite">Pagina ${rootShellUi.escapeHtml(String(currentPage))} de ${rootShellUi.escapeHtml(String(totalPages))}</p>
        <button id="production-orders-next-page-button" class="secondary-button" type="button" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    `;
  }

  function renderMaterialRequirements(order) {
    const requirements = Array.isArray(order?.materialRequirements) ? order.materialRequirements : [];
    if (!requirements.length) { return ''; }

    return `
      <article class="detail-item">
        <span>Requerimientos de material</span>
        <div class="table-wrapper products-table-wrapper" style="margin-top:0.5rem">
          <table class="products-admin-table">
            <thead><tr>
              <th>Producto</th><th>Requerido</th><th>Unidad</th>
              <th>Disponible al crear</th><th>Deficit al crear</th>
            </tr></thead>
            <tbody>
              ${requirements.map((r) => `
                <tr>
                  <td>${rootShellUi.escapeHtml(String(r.productId))}</td>
                  <td>${rootShellUi.escapeHtml(String(r.requiredQuantity ?? r.required ?? '?'))}</td>
                  <td>${rootShellUi.escapeHtml(r.unit || '—')}</td>
                  <td>${rootShellUi.escapeHtml(String(r.availableAtCreation ?? '—'))}</td>
                  <td style="${Number(r.shortageAtCreation ?? 0) > 0 ? 'color:var(--color-danger,#c00)' : ''}">
                    ${rootShellUi.escapeHtml(String(r.shortageAtCreation ?? '0'))}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  function renderOverrideBlock(order) {
    const snapshot = order?.recipeVersionSnapshot;
    const overrideJustification = snapshot?.override?.justification || order?.overrideJustification || null;
    if (!overrideJustification) { return ''; }

    return `
      <article class="detail-item" style="border-left:3px solid var(--color-warning,#b86000);padding-left:0.5rem">
        <span>Override — Justificacion de desviacion</span>
        <strong>${rootShellUi.escapeHtml(overrideJustification)}</strong>
      </article>
    `;
  }

  /**
   * Builds a productId → { name, unit } lookup from order.materialRequirements,
   * which DO have the product relation joined.
   * @param {any} order
   * @returns {Map<string, {name:string, unit:string}>}
   */
  function buildProductMap(order) {
    const map = new Map();
    for (const r of (order.materialRequirements || [])) {
      const id = String(r.productId ?? r.product?.id ?? '');
      if (id) {
        map.set(id, { name: r.product?.name || id, unit: r.unit || r.product?.unit || '' });
      }
    }
    return map;
  }

  function resolveProductName(productMap, productId) {
    return productMap.get(String(productId || ''))?.name || String(productId || '—');
  }

  function resolveProductUnit(productMap, productId, fallbackUnit) {
    return fallbackUnit || productMap.get(String(productId || ''))?.unit || '—';
  }

  function renderConsumptionRows(items, productMap) {
    if (!items.length) { return ''; }
    return `
      <details>
        <summary style="cursor:pointer;font-weight:600">Consumos (${rootShellUi.escapeHtml(String(items.length))})</summary>
        <div class="table-wrapper products-table-wrapper">
          <table class="products-admin-table">
            <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Unidad</th></tr></thead>
            <tbody>
              ${items.map((c) => `
                <tr>
                  <td>${rootShellUi.escapeHtml(resolveProductName(productMap, c.productId))}</td>
                  <td>${rootShellUi.escapeHtml(c.lot?.internalLotNumber || String(c.lotId || '—'))}</td>
                  <td>${rootShellUi.escapeHtml(String(c.quantity ?? '—'))}</td>
                  <td>${rootShellUi.escapeHtml(resolveProductUnit(productMap, c.productId, c.unit))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>`;
  }

  function renderWasteRows(items, productMap) {
    if (!items.length) { return ''; }
    return `
      <details>
        <summary style="cursor:pointer;font-weight:600;color:var(--color-warning,#b86000)">Mermas (${rootShellUi.escapeHtml(String(items.length))})</summary>
        <div class="table-wrapper products-table-wrapper">
          <table class="products-admin-table">
            <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Unidad</th><th>Razón</th></tr></thead>
            <tbody>
              ${items.map((w) => `
                <tr>
                  <td>${rootShellUi.escapeHtml(resolveProductName(productMap, w.productId))}</td>
                  <td>${rootShellUi.escapeHtml(w.lot?.internalLotNumber || String(w.lotId || '—'))}</td>
                  <td>${rootShellUi.escapeHtml(String(w.quantity ?? '—'))}</td>
                  <td>${rootShellUi.escapeHtml(resolveProductUnit(productMap, w.productId, w.unit))}</td>
                  <td>${rootShellUi.escapeHtml(w.reasonCode || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>`;
  }

  function renderLossRows(items, productMap) {
    if (!items.length) { return ''; }
    return `
      <details open>
        <summary style="cursor:pointer;font-weight:600;color:var(--color-danger,#c00)">Pérdidas post-rechazo QA (${rootShellUi.escapeHtml(String(items.length))})</summary>
        <div class="table-wrapper products-table-wrapper">
          <table class="products-admin-table">
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Razón</th><th>Nota</th></tr></thead>
            <tbody>
              ${items.map((l) => `
                <tr>
                  <td>${rootShellUi.escapeHtml(resolveProductName(productMap, l.productId))}</td>
                  <td style="color:var(--color-danger,#c00);font-weight:600">${rootShellUi.escapeHtml(String(l.quantity ?? '—'))}</td>
                  <td>${rootShellUi.escapeHtml(resolveProductUnit(productMap, l.productId, l.unit))}</td>
                  <td>${rootShellUi.escapeHtml(l.reasonCode || '—')}</td>
                  <td>${rootShellUi.escapeHtml(l.note || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>`;
  }

  function renderTotalConsumptionSummary(stageExecutions, productMap) {
    /** @type {Map<string, {name: string, quantity: number, unit: string}>} */
    const totals = new Map();
    for (const ex of stageExecutions) {
      for (const c of (ex.consumptions || [])) {
        const key = String(c.productId || '');
        if (!key) { continue; }
        const entry = totals.get(key) || {
          name: resolveProductName(productMap, c.productId),
          quantity: 0,
          unit: resolveProductUnit(productMap, c.productId, c.unit),
        };
        entry.quantity += Number(c.quantity || 0);
        totals.set(key, entry);
      }
    }
    if (!totals.size) { return ''; }
    return `
      <article class="detail-item">
        <span>Consumo total de materia prima</span>
        <div class="table-wrapper products-table-wrapper">
          <table class="products-admin-table">
            <thead><tr><th>Producto</th><th>Total consumido</th><th>Unidad</th></tr></thead>
            <tbody>
              ${[...totals.values()].map((row) => `
                <tr>
                  <td><strong>${rootShellUi.escapeHtml(row.name)}</strong></td>
                  <td>${rootShellUi.escapeHtml(String(Math.round(row.quantity * 1000) / 1000))}</td>
                  <td>${rootShellUi.escapeHtml(row.unit)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>`;
  }

  function renderStageExecutions(stageExecutions, order) {
    if (!Array.isArray(stageExecutions) || !stageExecutions.length) {
      return '<p class="empty-state">No hay etapas registradas todavia en esta orden.</p>';
    }

    // Build productId → {name, unit} map from materialRequirements (which has product join)
    const productMap = buildProductMap(order || {});
    const STATUS_LABEL = { COMPLETED: 'Completada', QA_REJECTED: 'Rechazada QA', IN_PROGRESS: 'En progreso' };

    return `
      <div class="stack-section">
        ${renderTotalConsumptionSummary(stageExecutions, productMap)}
        ${stageExecutions.map((ex) => {
          const consumptions = ex.consumptions || [];
          const wastes = ex.wastes || [];
          const losses = ex.losses || [];
          const statusLabel = STATUS_LABEL[ex.status] || ex.status || 'Registrada';
          const isRejected = ex.status === 'QA_REJECTED';
          return `
            <article class="products-entry-state">
              <div class="page-header">
                <div>
                  <h4>${rootShellUi.escapeHtml(ex.stageName || `Etapa ${ex.stageOrder || ''}`)}</h4>
                  <p class="muted">Orden de etapa: ${rootShellUi.escapeHtml(String(ex.stageOrder ?? ''))}</p>
                </div>
                <span class="badge${isRejected ? ' badge-warning' : ''}">${rootShellUi.escapeHtml(statusLabel)}</span>
              </div>
              <div class="detail-grid">
                <article class="detail-item"><span>Inicio</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(ex.startedAt))}</strong></article>
                <article class="detail-item"><span>Fin</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(ex.endedAt))}</strong></article>
              </div>
              ${ex.notes ? `<article class="detail-item"><span>Notas</span><strong>${rootShellUi.escapeHtml(ex.notes)}</strong></article>` : ''}
              ${renderConsumptionRows(consumptions, productMap)}
              ${renderWasteRows(wastes, productMap)}
              ${renderLossRows(losses, productMap)}
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderOrderDetail(order, options = {}) {
    const detailState = options.detailState || 'idle';

    if (detailState === 'loading') {
      return '<p class="empty-state">Cargando detalle de la orden de produccion...</p>';
    }

    if (detailState === 'error') {
      return renderState('No se pudo cargar el detalle', 'Intenta nuevamente seleccionando la orden desde el listado.');
    }

    if (!order) {
      return '<p class="empty-state">Selecciona una orden del listado para revisar su detalle de supervision.</p>';
    }

    const snapshotVisible = Boolean(order?.recipeVersionSnapshot?.recipeVersion);

    return `
      <div class="stack-section">
        <div class="page-header">
          <div>
            <h3>${rootShellUi.escapeHtml(order?.orderId || `ORD-${order?.id || ''}`)}</h3>
            <p class="muted">${rootShellUi.escapeHtml(order?.productionLotCode || 'Sin lote visible')} · ${rootShellUi.escapeHtml(order?.product?.name || 'Sin producto visible')}</p>
          </div>
          <div class="action-row compact-action-row">
            ${productionOrdersState.renderStatusBadge(order, rootShellUi)}
            <span class="badge">${rootShellUi.escapeHtml(snapshotVisible ? 'Snapshot congelado' : 'Snapshot no visible')}</span>
          </div>
        </div>

        ${order?.status === 'DRAFT' && options.canSubmitProduction
          ? `<div class="action-row compact-action-row" style="margin-bottom:1rem">
               <button type="button" class="secondary-button production-submit-btn"
                       data-order-id="${rootShellUi.escapeHtml(String(order?.id || ''))}">📤 Enviar a aprobacion</button>
               <p class="production-submit-error" style="color:var(--color-danger,#c00);font-size:0.85rem" hidden
                  role="alert" aria-live="assertive"></p>
             </div>`
          : ''}
        ${order?.status === 'PENDING_APPROVAL' && options.canApproveProduction
          ? `<div class="action-row compact-action-row" style="margin-bottom:1rem">
               <button type="button" class="primary-button production-approve-btn"
                       data-order-id="${rootShellUi.escapeHtml(String(order?.id || ''))}"
                       style="background:var(--color-success,#16A34A)">✓ Aprobar orden</button>
               <p class="production-approve-error" style="color:var(--color-danger,#c00);font-size:0.85rem" hidden
                  role="alert" aria-live="assertive"></p>
             </div>`
          : ''}
        ${order?.status !== 'DRAFT' && order?.status !== 'PENDING_APPROVAL'
          ? '<article class="detail-item"><span>Contexto</span><strong>Vista read-only de supervision. La operacion diaria ocurre en /warehouse/.</strong></article>'
          : ''}

        <div class="detail-grid">
          <article class="detail-item"><span>Producto</span><strong>${rootShellUi.escapeHtml(order?.product?.name || 'Sin producto visible')}</strong></article>
          <article class="detail-item"><span>Receta</span><strong>${rootShellUi.escapeHtml(order?.recipe?.name || order?.recipeVersionSnapshot?.recipe?.name || 'Sin receta visible')}</strong></article>
          <article class="detail-item"><span>Version</span><strong>${rootShellUi.escapeHtml(productionOrdersState.resolveVersionLabel(order))}</strong></article>
          <article class="detail-item"><span>Cantidad planificada</span><strong>${rootShellUi.escapeHtml(String(order?.quantity ?? 'No visible'))}</strong></article>
          <article class="detail-item"><span>Bodega origen</span><strong>${rootShellUi.escapeHtml(order?.originWarehouse?.name || 'No visible')}</strong></article>
          <article class="detail-item"><span>Bodega destino</span><strong>${rootShellUi.escapeHtml(order?.destinationWarehouse?.name || 'No visible')}</strong></article>
          <article class="detail-item"><span>Responsable</span><strong>${rootShellUi.escapeHtml(productionOrdersState.resolveResponsibleLabel(order))}</strong></article>
          <article class="detail-item"><span>Fecha planificada</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.plannedDate))}</strong></article>
          <article class="detail-item"><span>Creada</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.createdAt))}</strong></article>
          <article class="detail-item"><span>Aprobada</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.approvedAt))}</strong></article>
          <article class="detail-item"><span>Inicio</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.startedAt))}</strong></article>
          <article class="detail-item"><span>Cancelada</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.cancelledAt))}</strong></article>
        </div>

        ${renderMaterialRequirements(order)}
        ${renderOverrideBlock(order)}
        <article class="detail-item"><span>Etapas registradas</span></article>
        ${renderStageExecutions(order?.stageExecutions || [], order)}
      </div>
    `;
  }

  rootShell.register('views.productionOrdersAdminRenderers', {
    renderMetrics,
    renderOptionList,
    renderOrderDetail,
    renderOrdersTable,
    renderPagination,
    renderState,
  });
}(window));
