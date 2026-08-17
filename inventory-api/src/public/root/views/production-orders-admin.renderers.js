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
      <div class="table-wrapper products-table-wrapper">
        <table class="products-admin-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Producto</th>
              <th>Receta</th>
              <th>Version</th>
              <th>Estado</th>
              <th>Fecha plan.</th>
              <th>Responsable</th>
              <th class="products-action-cell"></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((order) => {
              const isSelected = String(order?.id) === String(selectedOrderId);
              return `
                <tr ${isSelected ? 'class="is-selected"' : ''}>
                  <td data-label="Orden"><strong>${rootShellUi.escapeHtml(order?.orderId || `ORD-${order?.id || ''}`)}</strong><br/><span>${rootShellUi.escapeHtml(order?.productionLotCode || 'Sin lote visible')}</span></td>
                  <td data-label="Producto">${rootShellUi.escapeHtml(order?.product?.name || 'Sin producto visible')}</td>
                  <td data-label="Receta">${rootShellUi.escapeHtml(order?.recipe?.name || 'Sin receta visible')}</td>
                  <td data-label="Version">${rootShellUi.escapeHtml(productionOrdersState.resolveVersionLabel(order))}</td>
                  <td data-label="Estado">${productionOrdersState.renderStatusBadge(order, rootShellUi)}</td>
                  <td data-label="Fecha plan.">${rootShellUi.escapeHtml(rootShellUi.formatDate(order?.plannedDate))}</td>
                  <td data-label="Responsable">${rootShellUi.escapeHtml(productionOrdersState.resolveResponsibleLabel(order))}</td>
                  <td class="products-action-cell" data-label="Acciones"><button class="secondary-button" type="button" data-production-order-detail="${rootShellUi.escapeHtml(order?.id)}">${isSelected ? 'Detalle abierto' : 'Ver detalle'}</button></td>
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

  function renderStageExecutions(stageExecutions) {
    if (!Array.isArray(stageExecutions) || !stageExecutions.length) {
      return '<p class="empty-state">No hay etapas registradas todavia en esta orden.</p>';
    }

    return `
      <div class="stack-section">
        ${stageExecutions.map((stageExecution) => `
          <article class="products-entry-state">
            <div class="page-header">
              <div>
                <h4>${rootShellUi.escapeHtml(stageExecution?.stageName || `Etapa ${stageExecution?.stageOrder || ''}`)}</h4>
                <p class="muted">Orden ${rootShellUi.escapeHtml(String(stageExecution?.stageOrder ?? ''))}</p>
              </div>
              <span class="badge">Registrada</span>
            </div>
            <div class="detail-grid">
              <article class="detail-item"><span>Inicio</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(stageExecution?.startedAt))}</strong></article>
              <article class="detail-item"><span>Fin</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(stageExecution?.endedAt))}</strong></article>
              <article class="detail-item"><span>Consumos</span><strong>${rootShellUi.escapeHtml(String((stageExecution?.consumptions || []).length))}</strong></article>
              <article class="detail-item"><span>Mermas</span><strong>${rootShellUi.escapeHtml(String((stageExecution?.wastes || []).length))}</strong></article>
            </div>
            ${stageExecution?.notes ? `<article class="detail-item"><span>Notas</span><strong>${rootShellUi.escapeHtml(stageExecution.notes)}</strong></article>` : ''}
          </article>
        `).join('')}
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

        <article class="detail-item"><span>Contexto</span><strong>Vista read-only de supervision. La operacion diaria ocurre en /warehouse/.</strong></article>

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

        <article class="detail-item"><span>Etapas registradas</span></article>
        ${renderStageExecutions(order?.stageExecutions || [])}
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
