(function attachRootShellMovementsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const movementsHelpers = rootShell.require('views.movementsAdminHelpers');

  function renderMetricCard(label, value) {
    return `
      <article class="card root-card metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderMetrics(items) {
    const latestMovement = items[0] || null;
    return [
      renderMetricCard('Movimientos visibles', items.length),
      renderMetricCard('Entradas', movementsHelpers.countMovementsByType(items, 'IN')),
      renderMetricCard('Ajustes', movementsHelpers.countMovementsByType(items, 'ADJUSTMENT')),
      renderMetricCard('Ultimo evento', latestMovement ? movementsHelpers.formatDateTime(latestMovement.createdAt) : '-'),
    ].join('');
  }

  function renderWarehouseOptions(warehouses, selectedWarehouseId = '') {
    return ['<option value="">Todas</option>']
      .concat((warehouses || []).map((warehouse) => `<option value="${rootShellUi.escapeHtml(warehouse.id)}" ${String(warehouse.id) === String(selectedWarehouseId) ? 'selected' : ''}>${rootShellUi.escapeHtml(warehouse.name || warehouse.code || 'Bodega')}</option>`))
      .join('');
  }

  function renderState(title, description) {
    return `
      <div class="warehouses-state card root-card">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
      </div>
    `;
  }

  function renderMovementsTable(items) {
    if (!items.length) {
      return '';
    }

    return `
      <div class="table-wrapper movements-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fecha/hora</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Lote</th>
              <th>Bodega</th>
              <th>Cambio</th>
              <th>Actor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((movement) => `
              <tr>
                <td data-label="Fecha/hora">${rootShellUi.escapeHtml(movementsHelpers.formatDateTime(movement.createdAt))}</td>
                <td data-label="Tipo"><span class="badge">${rootShellUi.escapeHtml(movement.movementType || 'Sin tipo')}</span></td>
                <td data-label="Producto">
                  <strong>${rootShellUi.escapeHtml(movement.product?.name || 'Producto sin nombre')}</strong>
                  <div class="muted warehouses-row-detail">${rootShellUi.escapeHtml(movement.product?.code || 'Sin codigo visible')}</div>
                </td>
                <td data-label="Lote">${rootShellUi.escapeHtml(movementsHelpers.resolveMovementLotLabel(movement))}</td>
                <td data-label="Bodega">${rootShellUi.escapeHtml(movement.warehouse?.name || 'Sin bodega visible')}</td>
                <td data-label="Cambio">${rootShellUi.escapeHtml(movementsHelpers.buildMovementChangeLabel(movement))}</td>
                <td data-label="Actor">${rootShellUi.escapeHtml(movementsHelpers.resolveMovementActor(movement))}</td>
                <td data-label="Acciones"><button class="secondary-button" type="button" data-movement-detail="${rootShellUi.escapeHtml(movement.id)}">Ver detalle</button></td>
              </tr>
            `).join('')}
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
        <button id="movements-previous-page-button" class="secondary-button" type="button" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <p class="muted" aria-live="polite">Pagina ${rootShellUi.escapeHtml(String(currentPage))} de ${rootShellUi.escapeHtml(String(totalPages))}</p>
        <button id="movements-next-page-button" class="secondary-button" type="button" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    `;
  }

  function renderDetail(movement) {
    if (!movement) {
      return '<p class="empty-state">Selecciona un movimiento del listado para revisar su trazabilidad.</p>';
    }

    const quantityLabel = movementsHelpers.formatQuantity(movement.quantity);
    const beforeAfterLabel = movement.quantityBefore === undefined || movement.quantityBefore === null || movement.quantityAfter === undefined || movement.quantityAfter === null
      ? quantityLabel
      : `${movementsHelpers.formatQuantity(movement.quantityBefore)} -> ${movementsHelpers.formatQuantity(movement.quantityAfter)}`;

    return `
      <div class="stack-section">
        <div class="detail-grid">
          <article class="detail-item"><span>Fecha y hora</span><strong>${rootShellUi.escapeHtml(movementsHelpers.formatDateTime(movement.createdAt))}</strong></article>
          <article class="detail-item"><span>Tipo</span><strong>${rootShellUi.escapeHtml(movement.movementType || 'Sin tipo')}</strong></article>
          <article class="detail-item"><span>Producto</span><strong>${rootShellUi.escapeHtml(movement.product?.name || 'Producto sin nombre')}</strong></article>
          <article class="detail-item"><span>Bodega</span><strong>${rootShellUi.escapeHtml(movement.warehouse?.name || 'Sin bodega visible')}</strong></article>
          <article class="detail-item"><span>Lote</span><strong>${rootShellUi.escapeHtml(movementsHelpers.resolveMovementLotLabel(movement))}</strong></article>
          <article class="detail-item"><span>Cambio</span><strong>${rootShellUi.escapeHtml(beforeAfterLabel)}</strong></article>
          <article class="detail-item"><span>Registrado por</span><strong>${rootShellUi.escapeHtml(movementsHelpers.resolveMovementActor(movement))}</strong></article>
          <article class="detail-item"><span>Reason code</span><strong>${rootShellUi.escapeHtml(movement.reasonCode || 'Sin reason code')}</strong></article>
          <article class="detail-item"><span>Source type</span><strong>${rootShellUi.escapeHtml(movement.sourceType || 'Sin source type')}</strong></article>
          <article class="detail-item"><span>Source ID</span><strong>${rootShellUi.escapeHtml(movement.sourceId ?? 'Sin source ID')}</strong></article>
          <article class="detail-item"><span>Grupo de movimiento</span><strong>${rootShellUi.escapeHtml(movement.movementGroupId || 'Sin grupo visible')}</strong></article>
          <article class="detail-item"><span>Referencia visible</span><strong>${rootShellUi.escapeHtml(movementsHelpers.buildMovementReference(movement))}</strong></article>
        </div>
        ${movement.note ? `<article class="detail-item"><span>Nota</span><strong>${rootShellUi.escapeHtml(movement.note)}</strong></article>` : ''}
      </div>
    `;
  }

  rootShell.register('views.movementsAdminRenderers', {
    renderDetail,
    renderMetrics,
    renderMovementsTable,
    renderPagination,
    renderState,
    renderWarehouseOptions,
  });
}(window));
