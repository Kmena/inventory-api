(function attachRootShellSuppliersAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const suppliersHelpers = rootShell.require('views.suppliersAdminHelpers');

  function renderMetricCard(label, value) {
    return `
      <article class="card root-card metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderMetrics(metrics) {
    return [
      renderMetricCard('Total', metrics.total),
      renderMetricCard('Con productos', metrics.withProducts),
      renderMetricCard('Sin productos', metrics.withoutProducts),
    ].join('');
  }

  function renderSuppliersTable(suppliers) {
    if (!suppliers.length) {
      return '';
    }

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Telefono</th>
              <th>Pais</th>
              <th>Productos</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            ${suppliers.map((supplier) => `
              <tr data-supplier-id="${rootShellUi.escapeHtml(String(supplier.id))}" class="clickable-row" role="button" tabindex="0">
                <td data-label="Nombre"><strong>${rootShellUi.escapeHtml(supplier.name || 'Sin nombre')}</strong></td>
                <td data-label="Email">${rootShellUi.escapeHtml(supplier.email || '—')}</td>
                <td data-label="Telefono">${rootShellUi.escapeHtml(supplier.phone || '—')}</td>
                <td data-label="Pais">${rootShellUi.escapeHtml(supplier.country || '—')}</td>
                <td data-label="Productos">${rootShellUi.escapeHtml(String(supplier.productCount || 0))}</td>
                <td data-label="Creado">${suppliersHelpers.formatDate(supplier.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEmptyState(title, description) {
    return `
      <div class="card root-card">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
      </div>
    `;
  }

  function renderSupplierDetailProducts(products, options = {}) {
    if (!products || !products.length) {
      return '<p class="muted">Este proveedor no tiene productos asignados.</p>';
    }

    const canManage = options.canManage !== false;

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Producto</th>
              <th>SKU proveedor</th>
              <th>Precio</th>
              <th>Moneda</th>
              <th>Preferido</th>
              <th>Tiempo entrega</th>
              <th>Min. orden</th>
              <th>Notas</th>
              ${canManage ? '<th>Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${products.map((p) => `
              <tr>
                <td data-label="Codigo">${rootShellUi.escapeHtml(p.productCode || '—')}</td>
                <td data-label="Producto"><strong>${rootShellUi.escapeHtml(p.productName || '—')}</strong></td>
                <td data-label="SKU proveedor">${rootShellUi.escapeHtml(p.supplierSku || '—')}</td>
                <td data-label="Precio">${p.unitPrice != null ? rootShellUi.escapeHtml(String(p.unitPrice)) : '—'}</td>
                <td data-label="Moneda">${rootShellUi.escapeHtml(p.currency || '—')}</td>
                <td data-label="Preferido">${p.isPreferred ? 'Si' : 'No'}</td>
                <td data-label="Tiempo entrega">${p.leadTimeDays != null ? rootShellUi.escapeHtml(String(p.leadTimeDays)) + ' dias' : '—'}</td>
                <td data-label="Min. orden">${p.minimumOrderQuantity != null ? rootShellUi.escapeHtml(String(p.minimumOrderQuantity)) : '—'}</td>
                <td data-label="Notas">${rootShellUi.escapeHtml(p.notes || '—')}</td>
                ${canManage ? `<td data-label="Acciones">
                  <button class="secondary-button suppliers-remove-product-button" type="button" data-product-id="${rootShellUi.escapeHtml(String(p.productId))}">Remover</button>
                </td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProductOptions(products, alreadyAssigned) {
    const assignedIds = new Set((alreadyAssigned || []).map((p) => String(p.productId)));
    const available = (products || []).filter((p) => !assignedIds.has(String(p.id)));

    if (!available.length) {
      return '<option value="">No hay productos disponibles</option>';
    }

    return ['<option value="">Seleccionar producto...</option>']
      .concat(available.map((p) => `<option value="${rootShellUi.escapeHtml(String(p.id))}">${rootShellUi.escapeHtml(p.code || '')} — ${rootShellUi.escapeHtml(p.name || '')}</option>`))
      .join('');
  }

  function renderFilteredProductOptions(filteredProducts, allAvailableCount) {
    if (allAvailableCount === 0) {
      return '<option value="">Todos los productos ya estan asignados</option>';
    }

    if (!filteredProducts.length) {
      return '<option value="">Sin resultados para el filtro actual</option>';
    }

    return ['<option value="">Seleccionar producto...</option>']
      .concat(filteredProducts.map((p) => `<option value="${rootShellUi.escapeHtml(String(p.id))}">${rootShellUi.escapeHtml(p.code || '')} — ${rootShellUi.escapeHtml(p.name || '')}</option>`))
      .join('');
  }

  rootShell.register('views.suppliersAdminRenderers', {
    renderMetrics,
    renderSuppliersTable,
    renderEmptyState,
    renderSupplierDetailProducts,
    renderProductOptions,
    renderFilteredProductOptions,
  });
}(window));
