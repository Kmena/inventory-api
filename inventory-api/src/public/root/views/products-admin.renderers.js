(function attachRootShellProductsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const productsHelpers = rootShell.require('views.productsAdminHelpers');

  function renderMetricCard(label, value) {
    return `
      <article class="card root-card metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderMetrics(items, categories) {
    const metrics = productsHelpers.buildProductsMetrics(items, categories);
    return [
      renderMetricCard('Productos visibles', metrics.visibleProducts),
      renderMetricCard('Categorias visibles', metrics.visibleCategories),
      renderMetricCard('Activos en pagina', metrics.visibleActiveProducts),
      renderMetricCard(metrics.hasInventoryData ? 'Bajo stock en pagina' : 'Stock visible', metrics.hasInventoryData ? metrics.visibleLowStockProducts : 'No disponible'),
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

  /**
   * Renders <option>/<optgroup> elements for subcategory selects.
   * categories = array of { id, name, categoryType, subcategories: [...] }
   * selectedSubcategoryId = the currently selected subcategory id
   */
  function renderCategoryOptions(categories, selectedSubcategoryId = '', includeAllLabel = 'Todas') {
    const baseOption = `<option value="">${rootShellUi.escapeHtml(includeAllLabel)}</option>`;
    const groupedOptions = (categories || []).map((category) => {
      const subcategoryOptions = (category.subcategories || []).map((sub) => {
        const isSelected = String(sub.id) === String(selectedSubcategoryId);
        return `<option value="${rootShellUi.escapeHtml(String(sub.id))}" ${isSelected ? 'selected' : ''}>${rootShellUi.escapeHtml(sub.name)}</option>`;
      }).join('');
      if (!subcategoryOptions) {
        return `<optgroup label="${rootShellUi.escapeHtml(category.name)} — sin subcategorias" disabled></optgroup>`;
      }
      return `<optgroup label="${rootShellUi.escapeHtml(category.name)}">${subcategoryOptions}</optgroup>`;
    }).join('');
    return `${baseOption}${groupedOptions}`;
  }

  /**
   * Renders <option> elements for category (parent) selects used in the subcategory creation form.
   * categories = array of { id, name, categoryType }
   */
  function renderParentCategoryOptions(categories, selectedCategoryId = '') {
    return (categories || []).map((category) => {
      const isSelected = String(category.id) === String(selectedCategoryId);
      return `<option value="${rootShellUi.escapeHtml(String(category.id))}" ${isSelected ? 'selected' : ''}>${rootShellUi.escapeHtml(category.name)}</option>`;
    }).join('');
  }

  function renderProductsTable(items, selectedProductId) {
    if (!items.length) {
      return '';
    }

    return `
      <div class="table-wrapper products-table-wrapper">
        <table class="products-admin-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoria</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th class="products-action-cell"></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((product) => {
              const isSelected = String(product?.id) === String(selectedProductId);
              const priceLabel = productsHelpers.formatCurrency(product?.price, product?.currency || 'CRC');
              const inventoryLabel = productsHelpers.resolveInventoryVisible(product)
                ? `${productsHelpers.formatNumber(product?.quantity || 0)} disponible · ${productsHelpers.formatNumber(product?.reservedQuantity || 0)} reservado`
                : 'No visible';
              return `
                <tr ${isSelected ? 'class="is-selected"' : ''}>
                  <td data-label="Producto">
                    <div class="product-name-cell">
                      <strong>${rootShellUi.escapeHtml(product?.name || 'Producto sin nombre')}</strong>
                      <span>${rootShellUi.escapeHtml(product?.code || 'Sin codigo visible')}</span>
                    </div>
                  </td>
                  <td data-label="Subcategoria">${rootShellUi.escapeHtml(product?.subcategory?.name || product?.category?.name || 'Sin categoria')}</td>
                  <td data-label="Precio">${rootShellUi.escapeHtml(priceLabel)}</td>
                  <td data-label="Stock">${rootShellUi.escapeHtml(inventoryLabel)}</td>
                  <td data-label="Estado">${rootShellUi.renderStatusBadge(product?.isActive !== false, 'Activo', 'Inactivo')}</td>
                  <td class="products-action-cell" data-label="Acciones"><button class="secondary-button" type="button" data-product-detail="${rootShellUi.escapeHtml(product?.id)}">${isSelected ? 'Detalle abierto' : 'Ver detalle'}</button></td>
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
        <button id="products-previous-page-button" class="secondary-button" type="button" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <p class="muted" aria-live="polite">Pagina ${rootShellUi.escapeHtml(String(currentPage))} de ${rootShellUi.escapeHtml(String(totalPages))}</p>
        <button id="products-next-page-button" class="secondary-button" type="button" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    `;
  }

  function renderDetail(product, options = {}) {
    const canManageProducts = Boolean(options.canManageProducts);
    const detailState = options.detailState || 'ready';

    if (detailState === 'loading') {
      return '<p class="empty-state">Cargando detalle del producto...</p>';
    }

    if (detailState === 'error') {
      return renderState('No se pudo cargar el detalle del producto', 'Intenta nuevamente desde el listado para recuperar la superficie contextual.');
    }

    if (!product) {
      return '<p class="empty-state">Selecciona un producto del listado para revisar su detalle contextual.</p>';
    }

    const inventoryVisible = productsHelpers.resolveInventoryVisible(product);

    return `
      <div class="stack-section">
        <article class="detail-item"><span>Producto</span><strong>${rootShellUi.escapeHtml(product?.name || 'Producto sin nombre')}</strong></article>
        <div class="detail-grid">
          <article class="detail-item"><span>Codigo</span><strong>${rootShellUi.escapeHtml(product?.code || 'Sin codigo visible')}</strong></article>
          <article class="detail-item"><span>Subcategoria</span><strong>${rootShellUi.escapeHtml(product?.subcategory?.name || 'Sin subcategoria')}</strong></article>
          <article class="detail-item"><span>Categoria</span><strong>${rootShellUi.escapeHtml(product?.category?.name || (product?.subcategory ? '' : 'Sin categoria'))}</strong></article>
          <article class="detail-item"><span>Precio principal</span><strong>${rootShellUi.escapeHtml(productsHelpers.formatCurrency(product?.price, product?.currency || 'CRC'))}</strong></article>
          <article class="detail-item"><span>Unidad</span><strong>${rootShellUi.escapeHtml(product?.unit || 'Sin unidad visible')}</strong></article>
          <article class="detail-item"><span>Stock disponible</span><strong>${rootShellUi.escapeHtml(inventoryVisible ? productsHelpers.formatNumber(product?.quantity || 0) : 'No visible')}</strong></article>
          <article class="detail-item"><span>Stock reservado</span><strong>${rootShellUi.escapeHtml(inventoryVisible ? productsHelpers.formatNumber(product?.reservedQuantity || 0) : 'No visible')}</strong></article>
          <article class="detail-item"><span>Stock minimo</span><strong>${rootShellUi.escapeHtml(inventoryVisible ? productsHelpers.formatNumber(product?.minStock || 0) : 'No visible')}</strong></article>
          <article class="detail-item"><span>Stock maximo</span><strong>${rootShellUi.escapeHtml(inventoryVisible ? productsHelpers.formatNumber(product?.maxStock || 0) : 'No visible')}</strong></article>
        </div>
        ${product?.description ? `<article class="detail-item"><span>Descripcion</span><strong>${rootShellUi.escapeHtml(product.description)}</strong></article>` : ''}
        <div class="action-row compact-action-row">
          ${canManageProducts ? '<button id="products-open-edit-button" type="button">Editar producto</button><button id="products-open-deactivate-button" class="secondary-button" type="button">Desactivar</button>' : ''}
        </div>
      </div>
    `;
  }

  function renderCategoriesList(categories) {
    if (!categories || !categories.length) {
      return '<p class="empty-state">no hay categorias disponibles en esta empresa.</p>';
    }

    return `
      <div class="stack-section">
        ${categories.map((category) => {
          const subcategories = category.subcategories || [];
          const subcategoryRows = subcategories.length
            ? subcategories.map((sub) => `
                <li class="products-subcategory-entry">
                  <span>${rootShellUi.escapeHtml(sub.name)}</span>
                  ${sub.code ? `<span class="muted">${rootShellUi.escapeHtml(sub.code)}</span>` : ''}
                </li>
              `).join('')
            : `<li class="products-subcategory-entry muted">Sin subcategorias registradas</li>`;
          return `
            <article class="products-entry-state">
              <strong>${rootShellUi.escapeHtml(category.name)}</strong>
              <span class="muted">${rootShellUi.escapeHtml(productsHelpers.getCategoryTypeLabel(category.categoryType))}</span>
              <ul class="products-subcategory-list">${subcategoryRows}</ul>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  rootShell.register('views.productsAdminRenderers', {
    renderCategoriesList,
    renderCategoryOptions,
    renderParentCategoryOptions,
    renderDetail,
    renderMetrics,
    renderPagination,
    renderProductsTable,
    renderState,
  });
}(window));
