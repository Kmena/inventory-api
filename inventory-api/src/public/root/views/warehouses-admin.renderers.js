(function attachRootShellWarehousesAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function renderMetricCard(label, value, estimated = false) {
    return `
      <article class="card root-card metric-card warehouses-metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
        ${estimated ? '<span class="warehouses-metric-card__hint">Estimado</span>' : '<span class="warehouses-metric-card__hint warehouses-metric-card__hint--placeholder" aria-hidden="true">&nbsp;</span>'}
      </article>
    `;
  }

  function renderMetrics(summary, estimated = false) {
    return [
      renderMetricCard('Total', summary.total, estimated),
      renderMetricCard('Activas', summary.active, estimated),
      renderMetricCard('Virtuales', summary.virtual, estimated),
      renderMetricCard('Fuentes vendibles', summary.sellable, estimated),
    ].join('');
  }

  function renderStatusTags(warehouse) {
    const badges = [
      rootShellUi.renderStatusBadge(warehouse.isActive, 'Activa', 'Inactiva'),
      warehouse.isVirtual
        ? '<span class="badge badge-warning">Virtual</span>'
        : '<span class="badge badge-success">Fisica</span>',
      warehouse.isSellableSource
        ? '<span class="badge badge-success">Vendible</span>'
        : '<span class="badge badge-warning">No vendible</span>',
    ];

    return `<div class="status-stack">${badges.join('')}</div>`;
  }

  function renderWarehousesTable(items) {
    if (!items.length) {
      return '';
    }

    return `
      <div class="table-wrapper warehouses-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Naturaleza</th>
              <th>Fuente vendible</th>
              <th>Estado</th>
              <th>Actualizada</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((warehouse) => `
              <tr>
                <td data-label="Codigo"><strong>${rootShellUi.escapeHtml(warehouse.code || 'Sin codigo')}</strong></td>
                <td data-label="Nombre">
                  <strong>${rootShellUi.escapeHtml(warehouse.name || 'Sin nombre')}</strong>
                  <div class="muted warehouses-row-detail">${rootShellUi.escapeHtml(warehouse.warehouseTypeDescription || '')}</div>
                </td>
                <td data-label="Tipo">${rootShellUi.escapeHtml(warehouse.warehouseTypeLabel || warehouse.warehouseType || 'Sin tipo')}</td>
                <td data-label="Naturaleza">${warehouse.isVirtual ? 'Virtual' : 'Fisica'}</td>
                <td data-label="Fuente vendible">${warehouse.isSellableSource ? 'Si' : 'No'}</td>
                <td data-label="Estado">${renderStatusTags(warehouse)}</td>
                <td data-label="Actualizada">${rootShellUi.formatDate(warehouse.updatedAt || warehouse.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderWarehouseState(title, description, actionLabel = '') {
    return `
      <div class="warehouses-state card root-card">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
        ${actionLabel ? `<p class="warehouses-state__meta">${rootShellUi.escapeHtml(actionLabel)}</p>` : ''}
      </div>
    `;
  }

  function renderWarehouseTypeOptions(warehouseTypes, selectedValue = '') {
    return warehouseTypes.map((warehouseType) => {
      const isSelected = warehouseType?.value === selectedValue;
      return `<option value="${rootShellUi.escapeHtml(warehouseType?.value || '')}" ${isSelected ? 'selected' : ''}>${rootShellUi.escapeHtml(warehouseType?.label || warehouseType?.value || 'Sin tipo')}</option>`;
    }).join('');
  }

  function renderTypeHelperText(typeDefinition) {
    if (!typeDefinition) {
      return '<p class="muted">Selecciona un tipo de bodega para ver su uso recomendado.</p>';
    }

    return `
      <p class="muted">${rootShellUi.escapeHtml(typeDefinition.description || 'Sin descripcion')}</p>
      ${typeDefinition.isVirtual
        ? '<p class="muted warehouses-helper warehouses-helper--warning">Las bodegas virtuales no pueden configurarse como fuente vendible.</p>'
        : ''}
    `;
  }

  rootShell.register('views.warehousesAdminRenderers', {
    renderMetrics,
    renderTypeHelperText,
    renderWarehouseState,
    renderWarehousesTable,
    renderWarehouseTypeOptions,
  });
}(window));
