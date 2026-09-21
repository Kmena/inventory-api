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
              <th></th>
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
                <td data-label="Acciones"><button class="secondary-button" type="button" data-warehouse-detail="${rootShellUi.escapeHtml(warehouse.id)}">Ver detalle</button></td>
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

  function isLegacyVirtualWarehouse(warehouse) {
    const code = String(warehouse?.code || '').toUpperCase();
    return code === 'COURSES_VIRTUAL' || code === 'AFFILIATIONS_VIRTUAL';
  }

  function renderWarehouseDetail(warehouse, canManage) {
    if (!warehouse) {
      return renderWarehouseState('Selecciona una ubicación', 'Abre el detalle para revisar, editar o cambiar estado con validación del backend.');
    }
    const legacyBadge = isLegacyVirtualWarehouse(warehouse)
      ? '<span class="badge badge-warning" title="Ubicación heredada conservada por compatibilidad. No usar para nuevos flujos no físicos.">Virtual legacy</span>'
      : '';
    return `
      <article class="card root-card warehouses-detail-card" id="warehouses-detail-card">
        <div class="page-header">
          <div>
            <h3>${rootShellUi.escapeHtml(warehouse.name || 'Ubicación')}</h3>
            <p class="muted">${rootShellUi.escapeHtml(warehouse.code || 'Sin codigo')} · ${rootShellUi.escapeHtml(warehouse.warehouseTypeLabel || warehouse.warehouseType || 'Sin tipo')}</p>
          </div>
          <div class="status-stack">${renderStatusTags(warehouse)}${legacyBadge}</div>
        </div>
        <div id="warehouses-detail-message" aria-live="polite"></div>
        <form id="warehouses-edit-form" class="root-form root-form--compact" data-warehouse-id="${rootShellUi.escapeHtml(warehouse.id)}">
          <div class="root-form-grid">
            <label><span>Codigo *</span><input name="code" type="text" required minlength="2" maxlength="40" value="${rootShellUi.escapeHtml(warehouse.code || '')}" ${canManage ? '' : 'disabled'} /></label>
            <label><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="120" value="${rootShellUi.escapeHtml(warehouse.name || '')}" ${canManage ? '' : 'disabled'} /></label>
            <label><span>Fuente vendible</span><input name="isSellableSource" type="checkbox" ${warehouse.isSellableSource ? 'checked' : ''} ${canManage && !warehouse.isVirtual ? '' : 'disabled'} /></label>
            <label><span>Activa</span><input name="isActive" type="checkbox" ${warehouse.isActive ? 'checked' : ''} ${canManage ? '' : 'disabled'} /></label>
          </div>
          ${canManage ? `<div class="action-row compact-action-row"><button type="submit">Guardar ubicación</button><button class="secondary-button" type="button" data-warehouse-toggle-status="${rootShellUi.escapeHtml(warehouse.id)}" data-next-active="${warehouse.isActive ? 'false' : 'true'}">${warehouse.isActive ? 'Desactivar ubicación' : 'Activar ubicación'}</button></div>` : ''}
        </form>
      </article>
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
    renderWarehouseDetail,
    renderWarehouseState,
    renderWarehousesTable,
    renderWarehouseTypeOptions,
  });
}(window));
