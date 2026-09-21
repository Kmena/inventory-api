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

  /**
   * Renders a compact product selector list for the left panel.
   * Replaces the old wide table — name + code only, no horizontal scroll.
   */
  function renderProductsTable(items, selectedProductId) {
    if (!items.length) {
      return '';
    }

    return `
      <ul class="products-selector-list" role="list" aria-label="Lista de productos">
        ${items.map((product) => {
          const isSelected = String(product?.id) === String(selectedProductId);
          const safeName = rootShellUi.escapeHtml(product?.name || 'Producto sin nombre');
          const safeCode = rootShellUi.escapeHtml(product?.code || '');
          const safeId = rootShellUi.escapeHtml(String(product?.id || ''));
          return `
            <li>
              <button
                class="products-selector-item${isSelected ? ' is-selected' : ''}"
                type="button"
                data-product-detail="${safeId}"
                aria-current="${isSelected ? 'true' : 'false'}"
              >
                <span class="products-selector-name">${safeName}</span>
                ${safeCode ? `<span class="products-selector-code">${safeCode}</span>` : ''}
              </button>
            </li>
          `;
        }).join('')}
      </ul>
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
      return '<p class="empty-state">Selecciona un producto del listado para revisar su detalle.</p>';
    }

    const inventoryVisible = productsHelpers.resolveInventoryVisible(product);
    const hasExistingStock = (Number(product?.quantity || 0) + Number(product?.reservedQuantity || 0)) > 0;
    const productId = rootShellUi.escapeHtml(product?.id || '');

    // ── Product header ──────────────────────────────────────────────────────
    const headerHtml = `
      <div class="products-detail-header">
        <div class="products-detail-header-main">
          <h3 class="products-detail-name">${rootShellUi.escapeHtml(product?.name || 'Producto sin nombre')}</h3>
          <p class="products-detail-code">${rootShellUi.escapeHtml(product?.code || 'Sin código visible')}</p>
          <div class="action-row compact-action-row products-detail-badges">
            <span class="badge badge-info">${rootShellUi.escapeHtml(productsHelpers.getProductNatureLabel(product))}</span>
            <span class="badge badge-info">${rootShellUi.escapeHtml(productsHelpers.getCommercialBehaviorLabel(product))}</span>
          </div>
        </div>
        <div class="action-row compact-action-row">
          ${canManageProducts ? '<button id="products-open-edit-button" type="button">Editar</button><button id="products-open-deactivate-button" class="secondary-button" type="button">Desactivar</button>' : ''}
        </div>
      </div>
    `;

    // ── Información general ──────────────────────────────────────────────────
    const netContentLabel = product?.netContent != null
      ? `${productsHelpers.formatNumber(product.netContent)} ${product?.netContentUnit || ''}`.trim()
      : 'Sin definir';
    const infoHtml = `
      <section class="products-detail-section">
        <h4 class="products-detail-section-title">Información general</h4>
        <div class="products-detail-grid">
          <article class="detail-item"><span>Subcategoria</span><strong>${rootShellUi.escapeHtml(product?.subcategory?.name || 'Sin subcategoria')}</strong></article>
          <article class="detail-item"><span>Contenido neto</span><strong>${rootShellUi.escapeHtml(netContentLabel)}</strong></article>
          <article class="detail-item"><span>Unidad</span><strong>${rootShellUi.escapeHtml(product?.netContentUnit || product?.unit || 'Sin unidad visible')}</strong></article>
          <article class="detail-item"><span>Precio principal</span><strong>${rootShellUi.escapeHtml(productsHelpers.formatCurrency(product?.price, product?.currency || 'CRC'))}</strong></article>
        </div>
        ${product?.description ? `<article class="detail-item"><span>Descripcion</span><strong>${rootShellUi.escapeHtml(product.description)}</strong></article>` : ''}
      </section>
    `;

    // ── Inventario ───────────────────────────────────────────────────────────
    const inventoryHtml = inventoryVisible
      ? `
        <section class="products-detail-section">
          <h4 class="products-detail-section-title">Inventario <span class="badge badge-success" style="font-size:0.72rem;font-weight:700;">Controla inventario</span></h4>
          <div class="products-detail-grid">
            <article class="detail-item"><span>Disponible</span><strong>${rootShellUi.escapeHtml(productsHelpers.formatNumber(product?.quantity || 0))}</strong></article>
            <article class="detail-item"><span>Reservado</span><strong>${rootShellUi.escapeHtml(productsHelpers.formatNumber(product?.reservedQuantity || 0))}</strong></article>
            <article class="detail-item"><span>Minimo</span><strong>${rootShellUi.escapeHtml(productsHelpers.formatNumber(product?.minStock || 0))}</strong></article>
            <article class="detail-item"><span>Maximo</span><strong>${rootShellUi.escapeHtml(productsHelpers.formatNumber(product?.maxStock || 0))}</strong></article>
          </div>
          <div class="action-row compact-action-row">
            <a class="secondary-button" href="/root/#inventory?tab=stock&productId=${productId}">Ver existencias</a>
            <a class="secondary-button" href="/root/#inventory?tab=lots&productId=${productId}">Ver lotes</a>
            <a class="secondary-button" href="/root/#inventory?tab=history&productId=${productId}">Ver historial</a>
            ${canManageProducts && !hasExistingStock ? '<button id="products-open-initial-inventory-button" class="secondary-button" type="button">Registrar inventario inicial</button>' : ''}
          </div>
          ${canManageProducts && !hasExistingStock ? `
            <div id="products-initial-inventory-panel" hidden>
              <form id="products-initial-inventory-form" class="root-form root-form--compact">
                <input type="hidden" name="productId" value="${productId}" />
                <div class="root-form-grid">
                  <label><span>ID de ubicación *</span><input name="warehouseId" type="number" min="1" required /></label>
                  <label><span>Cantidad *</span><input name="quantity" type="number" min="0.0001" step="any" required /></label>
                  <label><span>Lote</span><input name="lotNumber" type="text" maxlength="100" placeholder="Opcional para lote de sistema" /></label>
                  <label><span>Nota</span><input name="note" type="text" maxlength="500" /></label>
                </div>
                <div class="action-row compact-action-row"><button type="submit">Registrar inventario inicial</button></div>
              </form>
            </div>
          ` : ''}
        </section>
      `
      : `
        <section class="products-detail-section">
          <h4 class="products-detail-section-title">Inventario <span class="badge badge-info" style="font-size:0.72rem;font-weight:700;">No aplica</span></h4>
          <p class="muted">Este producto no controla inventario fisico. No requiere stock, lote, ubicacion, reserva ni despacho de inventario.</p>
        </section>
      `;

    return `
      <div class="products-detail-workspace">
        ${headerHtml}
        ${infoHtml}
        ${inventoryHtml}
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
