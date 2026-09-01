(function attachRootShellProductsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const productsApi = rootShell.require('productsApi');
  const categoriesApi = rootShell.require('categoriesApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const productsHelpers = rootShell.require('views.productsAdminHelpers');
  const productsRenderers = rootShell.require('views.productsAdminRenderers');
  const productsStateHelpers = rootShell.require('views.productsAdminState');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Inventario</p>
        <h2 id="root-view-title">Productos</h2>
        <p class="muted">Consulta el catalogo paginado de la empresa, abre el detalle contextual y administra productos y categorias solo cuando tus permisos lo permitan.</p>
      </section>

      <section class="routes-page products-page products-admin" id="products-page">
        <div id="products-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="products-page-message" aria-live="polite"></div>

        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Catalogo de productos</h3>
              <p id="products-list-summary" class="muted">Consulta los productos de esta pagina y abre su detalle contextual.</p>
            </div>
            <div class="action-row compact-action-row products-header-actions">
              <button id="products-refresh-button" class="secondary-button" type="button">Actualizar</button>
              <button id="products-open-categories-button" class="secondary-button" type="button">Categorias</button>
              <button id="products-open-create-button" type="button">Nuevo producto</button>
            </div>
          </div>

          <div class="client-command-bar products-filter-grid">
            <label class="client-search-field products-search-field"><span>Buscar</span><input id="products-search-input" type="search" placeholder="Codigo, nombre o categoria" /></label>
            <label><span>Categoria</span><select id="products-category-filter"><option value="">Todas</option></select></label>
            <button id="products-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
          </div>

          <div class="products-workspace-grid">
            <div>
              <div id="products-list-region" aria-live="polite"></div>
              <div id="products-pagination-region"></div>
            </div>
            <aside class="card root-card products-detail-card" aria-labelledby="products-detail-title">
              <div class="page-header">
                <div>
                  <h3 id="products-detail-title">Detalle contextual</h3>
                  <p id="products-detail-subtitle" class="muted">Selecciona un producto del listado para revisar su detalle contextual.</p>
                </div>
              </div>
              <div id="products-detail-message"></div>
              <div id="products-detail-region"></div>
            </aside>
          </div>
        </article>
      </section>

      <dialog id="products-form-dialog" class="modal-card products-modal-card">
        <form id="products-form" class="root-form" method="dialog" novalidate>
          <div class="products-modal-header">
            <div>
              <h3 id="products-form-title">Nuevo producto</h3>
              <p class="muted">Registra o actualiza la informacion principal del catalogo sin editar stock historico desde esta pantalla.</p>
            </div>
            <button id="products-close-form-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="products-form-message" aria-live="polite"></div>
          <fieldset class="root-form__section">
            <legend>Datos principales</legend>
            <div class="products-form-grid">
              <label class="products-field-wide"><span>Nombre *</span><input id="products-form-name" name="name" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Codigo</span><input name="code" type="text" maxlength="50" /></label>
              <label><span>Subcategoria</span><select id="products-form-subcategory" name="subcategoryId"><option value="">Sin subcategoria</option></select></label>
              <label><span>Moneda</span><select name="currency"><option value="">— Seleccionar —</option><option value="CRC">CRC — Colón</option><option value="USD">USD — Dólar</option><option value="EUR">EUR — Euro</option></select></label>
              <label><span>Precio</span><input name="price" type="number" min="0" step="0.01" /></label>
              <label><span>Stock minimo</span><input name="minStock" type="number" min="0" step="0.01" /></label>
              <label><span>Stock maximo</span><input name="maxStock" type="number" min="0" step="0.01" /></label>
              <label class="products-field-full products-checkbox-label">
                <input id="products-form-in-catalog" name="inCatalog" type="checkbox" checked />
                <span>Visible para agentes de venta</span>
                <span class="products-field-hint">Cuando esta activo, el producto aparece en el catalogo de pedidos del agente.</span>
              </label>
              <label class="products-field-full"><span>Descripcion</span><textarea name="description" rows="4" maxlength="2000"></textarea></label>
            </div>
          </fieldset>
          <fieldset class="root-form__section" id="products-size-fieldset">
            <legend>Presentación comercial</legend>
            <div class="products-form-grid">
              <label class="products-field-wide">
                <span>Tipo de presentación</span>
                <select name="presentationType" id="products-form-presentation-type">
                  <option value="">— Sin presentación (legado) —</option>
                  <option value="VOLUME">Volumen</option>
                  <option value="MASS">Masa</option>
                  <option value="LENGTH">Longitud</option>
                  <option value="COUNT">Cantidad</option>
                </select>
                <span class="products-field-hint">Opcional. Cuando se selecciona, habilita la conversión automática a kg en planificación de producción.</span>
              </label>
              <label id="products-form-net-content-group" style="display:none">
                <span>Contenido neto *</span>
                <input name="netContent" id="products-form-net-content" type="number" min="0.001" step="any" />
              </label>
              <label id="products-form-net-content-unit-group">
                <span>Unidad *</span>
                <select name="netContentUnit" id="products-form-net-content-unit" required>
                  <option value="">— Selecciona unidad —</option>
                </select>
              </label>
              <label id="products-form-density-group" style="display:none">
                <span>Densidad (kg/L) *</span>
                <input name="density" id="products-form-density" type="number" min="0.001" step="any" placeholder="Ej. 1.05" />
                <span class="products-field-hint">Masa por litro. Agua pura = 1.000 kg/L.</span>
              </label>
              <label id="products-form-kg-factor-group" style="display:none">
                <span id="products-form-kg-factor-label">Factor de conversión *</span>
                <input name="kgConversionFactor" id="products-form-kg-factor" type="number" min="0.001" step="any" />
                <span id="products-form-kg-factor-hint" class="products-field-hint"></span>
              </label>
            </div>
          </fieldset>
          <div class="action-row products-modal-actions">
            <button id="products-form-submit-button" type="submit">Guardar producto</button>
            <button id="products-cancel-form-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="products-deactivate-dialog" class="modal-card">
        <form class="root-form" method="dialog">
          <div class="page-header">
            <div>
              <h3>Desactivar producto</h3>
              <p class="muted">El producto dejara de estar disponible en el listado activo. Esta accion no elimina el historial.</p>
            </div>
            <button id="products-close-deactivate-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="products-deactivate-message" aria-live="polite"></div>
          <p id="products-deactivate-summary">Selecciona un producto para desactivarlo.</p>
          <div class="action-row">
            <button id="products-confirm-deactivate-button" type="button">Desactivar producto</button>
            <button id="products-cancel-deactivate-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="products-categories-dialog" class="modal-card">
        <form id="products-categories-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Categorias</h3>
              <p class="muted">Lista y crea categorias para usarlas en filtros y clasificacion de productos dentro de esta misma sesion.</p>
            </div>
            <button id="products-close-categories-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="products-categories-message" aria-live="polite"></div>
          <fieldset class="root-form__section">
            <legend>Categorias registradas</legend>
            <div id="products-categories-list-region"></div>
          </fieldset>
          <fieldset class="root-form__section">
            <legend>Nueva subcategoria</legend>
            <div class="root-form-grid">
              <label class="field-wide"><span>Nombre *</span><input id="products-category-name" name="name" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Categoria padre *</span><select id="products-subcategory-parent-category" name="categoryId" required><option value="">Selecciona una categoria</option></select></label>
              <label><span>Codigo</span><input name="subcategoryCode" type="text" maxlength="50" placeholder="Opcional" /></label>
            </div>
          </fieldset>
          <div class="action-row">
            <button id="products-create-category-button" type="submit">Crear subcategoria</button>
            <button id="products-cancel-categories-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const metricsRegion = container.querySelector('#products-metrics');
    const pageMessage = container.querySelector('#products-page-message');
    const listSummary = container.querySelector('#products-list-summary');
    const listRegion = container.querySelector('#products-list-region');
    const paginationRegion = container.querySelector('#products-pagination-region');
    const detailSubtitle = container.querySelector('#products-detail-subtitle');
    const detailMessage = container.querySelector('#products-detail-message');
    const detailRegion = container.querySelector('#products-detail-region');
    const searchInput = container.querySelector('#products-search-input');
    const categoryFilter = container.querySelector('#products-category-filter');
    const clearFiltersButton = container.querySelector('#products-clear-filters-button');
    const refreshButton = container.querySelector('#products-refresh-button');
    const openCreateButton = container.querySelector('#products-open-create-button');
    const openCategoriesButton = container.querySelector('#products-open-categories-button');
    const formDialog = container.querySelector('#products-form-dialog');
    const form = container.querySelector('#products-form');
    const formTitle = container.querySelector('#products-form-title');
    const formMessage = container.querySelector('#products-form-message');
    const formSubcategoryInput = container.querySelector('#products-form-subcategory');
    const subcategoryParentCategorySelect = container.querySelector('#products-subcategory-parent-category');
    const formNameInput = container.querySelector('#products-form-name');
    const closeFormButton = container.querySelector('#products-close-form-button');
    const cancelFormButton = container.querySelector('#products-cancel-form-button');
    const formSubmitButton = container.querySelector('#products-form-submit-button');
    const deactivateDialog = container.querySelector('#products-deactivate-dialog');
    const deactivateMessage = container.querySelector('#products-deactivate-message');
    const deactivateSummary = container.querySelector('#products-deactivate-summary');
    const closeDeactivateButton = container.querySelector('#products-close-deactivate-button');
    const cancelDeactivateButton = container.querySelector('#products-cancel-deactivate-button');
    const confirmDeactivateButton = container.querySelector('#products-confirm-deactivate-button');
    const categoriesDialog = container.querySelector('#products-categories-dialog');
    const categoriesForm = container.querySelector('#products-categories-form');
    const categoriesMessage = container.querySelector('#products-categories-message');
    const categoriesListRegion = container.querySelector('#products-categories-list-region');
    const categoryNameInput = container.querySelector('#products-category-name');
    const createCategoryButton = container.querySelector('#products-create-category-button');
    const closeCategoriesButton = container.querySelector('#products-close-categories-button');
    const cancelCategoriesButton = container.querySelector('#products-cancel-categories-button');

    // --- TASK-006: refs de campos de tamaño/presentación ---
    const presentationTypeSelect = container.querySelector('#products-form-presentation-type');
    const netContentGroup = container.querySelector('#products-form-net-content-group');
    const netContentInput = container.querySelector('#products-form-net-content');
    const netContentUnitSelect = container.querySelector('#products-form-net-content-unit');
    const densityGroup = container.querySelector('#products-form-density-group');
    const densityInput = container.querySelector('#products-form-density');
    const kgFactorGroup = container.querySelector('#products-form-kg-factor-group');
    const kgFactorInput = container.querySelector('#products-form-kg-factor');
    const kgFactorLabel = container.querySelector('#products-form-kg-factor-label');
    const kgFactorHint = container.querySelector('#products-form-kg-factor-hint');

    if (!metricsRegion || !pageMessage || !listSummary || !listRegion || !paginationRegion || !detailSubtitle || !detailMessage || !detailRegion || !searchInput || !categoryFilter || !clearFiltersButton || !refreshButton || !openCreateButton || !openCategoriesButton || !formDialog || !form || !formTitle || !formMessage || !formSubcategoryInput || !formNameInput || !closeFormButton || !cancelFormButton || !formSubmitButton || !deactivateDialog || !deactivateMessage || !deactivateSummary || !closeDeactivateButton || !cancelDeactivateButton || !confirmDeactivateButton || !categoriesDialog || !categoriesForm || !categoriesMessage || !categoriesListRegion || !categoryNameInput || !createCategoryButton || !closeCategoriesButton || !cancelCategoriesButton) {
      return;
    }

    const canViewProducts = productsHelpers.canViewProducts(session, sessionAdapter);
    const canManageProducts = productsHelpers.canManageProducts(session, sessionAdapter);
    const canListCategories = productsHelpers.canListCategories(session, sessionAdapter);
    const canCreateCategories = productsHelpers.canCreateCategories(session, sessionAdapter);

    let dataset = {
      items: [],
      pagination: { page: 1, pageSize: productsHelpers.DEFAULT_PAGE_SIZE, totalItems: 0, totalPages: 0 },
    };
    let categories = [];
    let filters = productsHelpers.createDefaultFilters();
    let selectedProductId = null;
    let selectedProductDetail = null;
    let detailState = 'idle';
    let editingProductId = null;
    let lastDialogTrigger = null;
    let categoryWarning = '';

    // --- TASK-006: opciones de unidad por tipo de presentación ---
    // La clave '' muestra todas las unidades cuando no hay tipo definido.
    const NET_CONTENT_UNIT_OPTIONS = {
      '': [
        { value: 'UN', label: 'UN — Unidades' },
        { value: 'KG', label: 'KG — Kilogramos' },
        { value: 'G',  label: 'G — Gramos' },
        { value: 'L',  label: 'L — Litros' },
        { value: 'ML', label: 'ML — Mililitros' },
        { value: 'M',  label: 'M — Metros' },
      ],
      VOLUME: [
        { value: 'ML', label: 'ML — Mililitros' },
        { value: 'L',  label: 'L — Litros' },
      ],
      MASS: [
        { value: 'G',  label: 'G — Gramos' },
        { value: 'KG', label: 'KG — Kilogramos' },
      ],
      LENGTH: [
        { value: 'M', label: 'M — Metros' },
      ],
      COUNT: [
        { value: 'UN', label: 'UN — Unidades' },
      ],
    };

    /**
     * Muestra u oculta los campos condicionales de presentación comercial.
     * También gestiona `required` e inicializa las opciones del select de unidad.
     *
     * @param {string} type - Valor de presentationType (VOLUME|MASS|LENGTH|COUNT|'')
     * @param {string} [preselectedUnit] - Unidad a preseleccionar en el select (modo edición)
     */
    function syncSizeFields(type, preselectedUnit) {
      // Oculta un grupo label+input y limpia su valor para evitar validación stale.
      function hideGroup(groupEl, inputEl) {
        groupEl.style.display = 'none';
        if (inputEl) {
          inputEl.required = false;
          inputEl.value = '';
        }
      }
      // Muestra un grupo label+input y activa o desactiva required.
      function showGroup(groupEl, inputEl, makeRequired) {
        groupEl.style.display = '';
        if (inputEl) inputEl.required = Boolean(makeRequired);
      }

      // Resetear campos condicionales (NO netContentUnit — siempre visible).
      hideGroup(netContentGroup, netContentInput);
      hideGroup(densityGroup, densityInput);
      hideGroup(kgFactorGroup, kgFactorInput);

      // netContentUnit es siempre visible y siempre requerido.
      // Las opciones se filtran según el tipo; sin tipo se muestran todas.
      const unitOpts = NET_CONTENT_UNIT_OPTIONS[type] || NET_CONTENT_UNIT_OPTIONS[''];
      netContentUnitSelect.innerHTML = '<option value="">— Selecciona unidad —</option>'
        + unitOpts.map((opt) =>
            `<option value="${opt.value}"${preselectedUnit === opt.value ? ' selected' : ''}>${opt.label}</option>`
          ).join('');
      netContentUnitSelect.required = true;

      if (!type) return;

      // Campos comunes a VOLUME, MASS y LENGTH: contenido neto.
      if (type === 'VOLUME' || type === 'MASS' || type === 'LENGTH') {
        showGroup(netContentGroup, netContentInput, true);
      }

      // Campo exclusivo de VOLUME: densidad.
      if (type === 'VOLUME') {
        showGroup(densityGroup, densityInput, true);
      }

      // Factor de conversión: requerido en LENGTH, opcional en COUNT.
      if (type === 'LENGTH') {
        showGroup(kgFactorGroup, kgFactorInput, true);
        if (kgFactorLabel) kgFactorLabel.textContent = 'Factor kg/m *';
        if (kgFactorHint) kgFactorHint.textContent = 'Kilogramos por metro lineal de producto terminado.';
      } else if (type === 'COUNT') {
        showGroup(kgFactorGroup, kgFactorInput, false);
        if (kgFactorLabel) kgFactorLabel.textContent = 'Factor kg/unidad';
        if (kgFactorHint) kgFactorHint.textContent = 'Kilogramos por unidad (opcional). Necesario si la receta opera en kg.';
      }
    }

    function syncActionVisibility() {
      openCreateButton.hidden = !canManageProducts;
      openCreateButton.disabled = !canManageProducts;
      openCategoriesButton.disabled = !canListCategories;
      if (!canManageProducts) {
        openCreateButton.title = 'Necesitas permiso de gestion de productos para crear o editar productos.';
      }
      if (!canListCategories) {
        openCategoriesButton.title = 'No tienes permisos para consultar categorias.';
      }
    }

    function getVisibleItems() {
      return productsHelpers.filterProducts(dataset.items, filters);
    }

    function getFallbackSelectedProduct() {
      return productsStateHelpers.resolveSelectedProduct(dataset.items, selectedProductId);
    }

    function getSelectedProduct() {
      if (selectedProductDetail && String(selectedProductDetail.id) === String(selectedProductId)) {
        return selectedProductDetail;
      }
      return getFallbackSelectedProduct();
    }

    function renderCategoryOptions() {
      categoryFilter.innerHTML = productsRenderers.renderCategoryOptions(categories, filters.subcategoryId);
      if (formSubcategoryInput) {
        formSubcategoryInput.innerHTML = productsRenderers.renderCategoryOptions(categories, '', 'Sin subcategoria');
      }
      if (subcategoryParentCategorySelect) {
        subcategoryParentCategorySelect.innerHTML =
          '<option value="">Selecciona una categoria</option>' +
          productsRenderers.renderParentCategoryOptions(categories);
      }
    }

    function renderCategoriesDialogState() {
      categoriesListRegion.innerHTML = productsRenderers.renderCategoriesList(categories);
      if (!canCreateCategories) {
        createCategoryButton.hidden = true;
        createCategoryButton.disabled = true;
        categoryNameInput.disabled = true;
        Array.from(categoriesForm.elements).forEach((element) => {
          if (element instanceof globalScope.HTMLSelectElement && element.name === 'categoryId') {
            element.disabled = true;
          }
        });
        categoriesMessage.innerHTML = rootShellUi.renderInlineMessage('Solo puedes consultar subcategorias en esta cuenta.', 'warning');
      }
    }

    function renderListState() {
      const visibleItems = getVisibleItems();
      metricsRegion.innerHTML = productsRenderers.renderMetrics(visibleItems, categories);
      listSummary.textContent = productsHelpers.buildVisibleSummary(visibleItems.length, dataset.items.length, dataset.pagination, filters);
      clearFiltersButton.hidden = !productsHelpers.hasActiveFilters(filters);

      if (!dataset.items.length) {
        listRegion.innerHTML = productsRenderers.renderState(
          canManageProducts ? 'Todavia no hay productos registrados para esta empresa.' : 'Todavia no hay productos registrados para esta empresa.',
          canManageProducts
            ? 'Crea el primer producto para empezar a organizar el catalogo.'
            : 'Cuando la empresa registre productos, apareceran aqui.'
        );
        paginationRegion.innerHTML = '';
        return;
      }

      if (!visibleItems.length) {
        listRegion.innerHTML = productsRenderers.renderState(
          'No hay resultados con los filtros actuales.',
          'Prueba con otra busqueda o limpia los filtros.'
        );
        paginationRegion.innerHTML = productsRenderers.renderPagination(dataset.pagination);
        return;
      }

      listRegion.innerHTML = productsRenderers.renderProductsTable(visibleItems, selectedProductId);
      paginationRegion.innerHTML = productsRenderers.renderPagination(dataset.pagination);
    }

    function renderDetailState() {
      detailSubtitle.textContent = productsStateHelpers.buildDetailSubtitle(getSelectedProduct());
      detailRegion.innerHTML = productsRenderers.renderDetail(getSelectedProduct(), {
        canManageProducts,
        detailState,
      });
    }

    function renderForbiddenState() {
      metricsRegion.innerHTML = productsRenderers.renderMetrics([], []);
      listSummary.textContent = 'No tienes acceso a productos.';
      listRegion.innerHTML = productsRenderers.renderState(
        'No tienes acceso a productos.',
        'Necesitas permisos de productos para consultar esta vista.'
      );
      paginationRegion.innerHTML = '';
      detailMessage.innerHTML = '';
      detailState = 'idle';
      selectedProductDetail = null;
      renderDetailState();
    }

    function syncSelectedProductWithVisibleItems() {
      const visibleItems = getVisibleItems();
      if (!visibleItems.length) {
        selectedProductId = productsHelpers.hasActiveFilters(filters)
          ? null
          : productsStateHelpers.resolveSelectedProductId(dataset.items, selectedProductId);
        if (!selectedProductId) {
          selectedProductDetail = null;
          detailState = 'idle';
        }
        return;
      }

      selectedProductId = productsStateHelpers.resolveSelectedProductId(visibleItems, selectedProductId);
    }

    function syncFilterInputs() {
      // subcategoryId replaces categoryId as the filter key
      searchInput.value = filters.searchTerm;
      categoryFilter.value = filters.subcategoryId;
    }

    function updateFilterStateFromInputs() {
      filters = {
        searchTerm: searchInput.value.trim(),
        subcategoryId: categoryFilter.value,
      };
    }

    function resetFormDialog() {
      form.reset();
      formMessage.innerHTML = '';
      editingProductId = null;
      formTitle.textContent = 'Nuevo producto';
      formSubmitButton.textContent = 'Guardar producto';
      if (formSubcategoryInput) formSubcategoryInput.value = '';
      // TASK-006: ocultar campos de presentación al resetear
      // form.reset() ya devuelve el select a su estado vacío,
      // pero los grupos condicionales deben ocultarse visualmente.
      syncSizeFields('', '');
    }

    function openFormDialog(mode, product = null, trigger = null) {
      if (!canManageProducts) {
        return;
      }

      lastDialogTrigger = trigger;
      resetFormDialog();
      if (mode === 'edit' && product) {
        editingProductId = product.id;
        formTitle.textContent = 'Editar producto';
        formSubmitButton.textContent = 'Actualizar producto';
        form.elements.name.value = product.name || '';
        form.elements.code.value = product.code || '';
        form.elements.description.value = product.description || '';
        if (form.elements.subcategoryId) {
          form.elements.subcategoryId.value = product.subcategoryId ? String(product.subcategoryId) : '';
        }
        form.elements.currency.value = product.currency || '';
        form.elements.price.value = product.price ?? '';
        form.elements.minStock.value = product.minStock ?? '';
        form.elements.maxStock.value = product.maxStock ?? '';
        if (form.elements.inCatalog) {
          form.elements.inCatalog.checked = product.inCatalog !== false;
        }
        // TASK-006: poblar campos de presentación comercial en modo edición.
        // netContentUnit se rellena siempre (campo obligatorio). Se prioriza
        // netContentUnit del producto; si no existe se intenta product.unit
        // como valor legado para preseleccionar la opción correcta.
        if (presentationTypeSelect) {
          const pt = product.presentationType || '';
          const existingUnit = product.netContentUnit || product.unit || '';
          presentationTypeSelect.value = pt;
          // syncSizeFields popula las opciones del select de unidad y pre-selecciona.
          syncSizeFields(pt, existingUnit);
          if (pt && netContentInput) {
            netContentInput.value = product.netContent != null ? String(product.netContent) : '';
          }
          if (pt === 'VOLUME' && densityInput) {
            densityInput.value = product.density != null ? String(product.density) : '';
          }
          if ((pt === 'LENGTH' || pt === 'COUNT') && kgFactorInput) {
            kgFactorInput.value = product.kgConversionFactor != null ? String(product.kgConversionFactor) : '';
          }
        }
      }
      formDialog.showModal();
      formNameInput.focus();
    }

    function closeFormDialog() {
      formDialog.close();
      resetFormDialog();
      if (lastDialogTrigger instanceof globalScope.HTMLElement) {
        lastDialogTrigger.focus();
      }
      lastDialogTrigger = null;
    }

    function openDeactivateDialog(trigger = null) {
      const product = getSelectedProduct();
      if (!canManageProducts || !product) {
        return;
      }
      lastDialogTrigger = trigger;
      deactivateMessage.innerHTML = '';
      deactivateSummary.textContent = `${product.name || 'Producto'}${product.code ? ` · ${product.code}` : ''}`;
      deactivateDialog.showModal();
      cancelDeactivateButton.focus();
    }

    function closeDeactivateDialog() {
      deactivateDialog.close();
      deactivateMessage.innerHTML = '';
      if (lastDialogTrigger instanceof globalScope.HTMLElement) {
        lastDialogTrigger.focus();
      }
      lastDialogTrigger = null;
    }

    function openCategoriesDialog(trigger = null) {
      if (!canListCategories) {
        return;
      }
      lastDialogTrigger = trigger;
      categoriesMessage.innerHTML = canCreateCategories ? '' : rootShellUi.renderInlineMessage('Solo puedes consultar categorias en esta cuenta.', 'warning');
      renderCategoriesDialogState();
      categoriesDialog.showModal();
      if (canCreateCategories) {
        categoryNameInput.focus();
      } else {
        closeCategoriesButton.focus();
      }
    }

    function closeCategoriesDialog() {
      categoriesDialog.close();
      categoriesForm.reset();
      categoriesMessage.innerHTML = '';
      if (lastDialogTrigger instanceof globalScope.HTMLElement) {
        lastDialogTrigger.focus();
      }
      lastDialogTrigger = null;
    }

    async function loadCategories() {
      if (!canListCategories) {
        categories = [];
        renderCategoryOptions();
        return;
      }

      try {
        const response = await categoriesApi.listCategories(session);
        categories = Array.isArray(response) ? response : [];
        categoryWarning = '';
        renderCategoryOptions();
        renderCategoriesDialogState();
      } catch (error) {
        categories = [];
        categoryWarning = error.message || 'No se pudieron cargar las categorias.';
        renderCategoryOptions();
        renderCategoriesDialogState();
      }
    }

    async function loadProducts(options = {}) {
      const page = options.page || dataset.pagination.page || 1;
      const loadingMessage = options.loadingMessage || 'Cargando productos...';
      listRegion.innerHTML = `<p class="empty-state">${rootShellUi.escapeHtml(loadingMessage)}</p>`;
      paginationRegion.innerHTML = '';
      pageMessage.innerHTML = categoryWarning ? rootShellUi.renderInlineMessage(categoryWarning, 'warning') : '';
      setShellStatus(loadingMessage);

      try {
        const response = await productsApi.listProducts(session, {
          page,
          pageSize: dataset.pagination.pageSize || productsHelpers.DEFAULT_PAGE_SIZE,
        });
        dataset = productsHelpers.normalizeProductsResponse(response);
        syncSelectedProductWithVisibleItems();
        renderListState();
        renderDetailState();
        if (selectedProductId) {
          await loadProductDetail(selectedProductId, { silent: true });
        }
        if (categoryWarning) {
          pageMessage.innerHTML = rootShellUi.renderInlineMessage(categoryWarning, 'warning');
        }
        setShellStatus('Sesion lista.');
      } catch (error) {
        dataset = {
          items: [],
          pagination: { page, pageSize: productsHelpers.DEFAULT_PAGE_SIZE, totalItems: 0, totalPages: 0 },
        };
        selectedProductId = null;
        selectedProductDetail = null;
        detailState = 'idle';
        metricsRegion.innerHTML = productsRenderers.renderMetrics([], categories);
        listSummary.textContent = 'No se pudieron cargar los productos.';
        listRegion.innerHTML = productsRenderers.renderState(
          'No se pudieron cargar los productos.',
          'Intenta nuevamente. Si el problema continua, contacta al administrador.'
        );
        paginationRegion.innerHTML = '';
        detailMessage.innerHTML = '';
        renderDetailState();
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar los productos.', 'error');
        setShellStatus('No se pudo cargar la vista de productos.', 'error');
      }
    }

    async function loadProductDetail(productId, options = {}) {
      if (!productId) {
        selectedProductDetail = null;
        detailState = 'idle';
        detailMessage.innerHTML = '';
        renderDetailState();
        return;
      }

      detailState = 'loading';
      detailMessage.innerHTML = '';
      renderDetailState();

      try {
        selectedProductDetail = await productsApi.getProduct(session, productId);
        detailState = 'ready';
        renderDetailState();
        if (!options.silent) {
          setShellStatus('Detalle del producto cargado.');
        }
      } catch (error) {
        selectedProductDetail = getFallbackSelectedProduct();
        detailState = 'error';
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el detalle del producto.', 'error');
        renderDetailState();
        if (!options.silent) {
          setShellStatus('No se pudo cargar el detalle del producto.', 'error');
        }
      }
    }

    if (!canViewProducts) {
      syncActionVisibility();
      renderForbiddenState();
      setShellStatus('No tienes permisos para consultar productos.', 'error');
      return;
    }

    syncActionVisibility();
    renderDetailState();

    searchInput.addEventListener('input', () => {
      updateFilterStateFromInputs();
      syncSelectedProductWithVisibleItems();
      renderListState();
      renderDetailState();
    });

    categoryFilter.addEventListener('change', () => {
      updateFilterStateFromInputs();
      syncSelectedProductWithVisibleItems();
      renderListState();
      renderDetailState();
    });

    clearFiltersButton.addEventListener('click', () => {
      filters = productsHelpers.createDefaultFilters();
      syncFilterInputs();
      syncSelectedProductWithVisibleItems();
      renderListState();
      renderDetailState();
    });

    refreshButton.addEventListener('click', async () => {
      await loadCategories();
      await loadProducts({ page: dataset.pagination.page || 1, loadingMessage: 'Actualizando productos...' });
    });

    listRegion.addEventListener('click', async (event) => {
      const trigger = event.target instanceof globalScope.HTMLElement ? event.target.closest('[data-product-detail]') : null;
      if (!(trigger instanceof globalScope.HTMLElement)) {
        return;
      }
      selectedProductId = trigger.getAttribute('data-product-detail');
      renderListState();
      await loadProductDetail(selectedProductId);
    });

    paginationRegion.addEventListener('click', async (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      if (target.id === 'products-previous-page-button' && dataset.pagination.page > 1) {
        selectedProductDetail = null;
        await loadProducts({ page: dataset.pagination.page - 1, loadingMessage: 'Actualizando productos...' });
      }

      if (target.id === 'products-next-page-button' && dataset.pagination.page < dataset.pagination.totalPages) {
        selectedProductDetail = null;
        await loadProducts({ page: dataset.pagination.page + 1, loadingMessage: 'Actualizando productos...' });
      }
    });

    detailRegion.addEventListener('click', (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      if (target.id === 'products-open-edit-button') {
        openFormDialog('edit', getSelectedProduct(), target);
      }

      if (target.id === 'products-open-deactivate-button') {
        openDeactivateDialog(target);
      }
    });

    openCreateButton.addEventListener('click', (event) => {
      openFormDialog('create', null, event.currentTarget);
    });

    openCategoriesButton.addEventListener('click', (event) => {
      openCategoriesDialog(event.currentTarget);
    });

    closeFormButton.addEventListener('click', closeFormDialog);
    cancelFormButton.addEventListener('click', closeFormDialog);
    closeDeactivateButton.addEventListener('click', closeDeactivateDialog);
    cancelDeactivateButton.addEventListener('click', closeDeactivateDialog);
    closeCategoriesButton.addEventListener('click', closeCategoriesDialog);
    cancelCategoriesButton.addEventListener('click', closeCategoriesDialog);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formMessage.innerHTML = '';
      if (!form.reportValidity()) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      formSubmitButton.disabled = true;
      formSubmitButton.textContent = editingProductId ? 'Actualizando...' : 'Guardando...';
      setShellStatus(editingProductId ? 'Guardando producto...' : 'Creando producto...');

      try {
        const isEditing = Boolean(editingProductId);
        const currentEditingProductId = editingProductId;
        const payload = productsHelpers.buildProductPayload(new globalScope.FormData(form));
        const savedProduct = isEditing
          ? await productsApi.updateProduct(session, currentEditingProductId, payload)
          : await productsApi.createProduct(session, payload);
        closeFormDialog();
        selectedProductId = savedProduct?.id || selectedProductId;
        selectedProductDetail = savedProduct || null;
        await loadProducts({ page: dataset.pagination.page || 1, loadingMessage: 'Actualizando productos...' });
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(isEditing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.');
        setShellStatus(isEditing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.');
      } catch (error) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo guardar el producto. Revisa los datos e intentalo de nuevo.', 'error');
        setShellStatus('No se pudo guardar el producto.', 'error');
      } finally {
        formSubmitButton.disabled = false;
        formSubmitButton.textContent = editingProductId ? 'Actualizar producto' : 'Guardar producto';
      }
    });

    confirmDeactivateButton.addEventListener('click', async () => {
      const product = getSelectedProduct();
      if (!product) {
        return;
      }

      confirmDeactivateButton.disabled = true;
      confirmDeactivateButton.textContent = 'Desactivando...';
      setShellStatus('Desactivando producto...');

      try {
        await productsApi.deactivateProduct(session, product.id);
        closeDeactivateDialog();
        selectedProductId = null;
        selectedProductDetail = null;
        detailState = 'idle';
        await loadProducts({ page: dataset.pagination.page || 1, loadingMessage: 'Actualizando productos...' });
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Producto desactivado correctamente.');
        setShellStatus('Producto desactivado correctamente.');
      } catch (error) {
        deactivateMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo desactivar el producto.', 'error');
        setShellStatus('No se pudo desactivar el producto.', 'error');
      } finally {
        confirmDeactivateButton.disabled = false;
        confirmDeactivateButton.textContent = 'Desactivar producto';
      }
    });

    categoriesForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!canCreateCategories) {
        return;
      }

      categoriesMessage.innerHTML = '';
      if (!categoriesForm.reportValidity()) {
        categoriesMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      createCategoryButton.disabled = true;
      createCategoryButton.textContent = 'Creando...';
      setShellStatus('Creando categoria...');

      try {
        const subcategory = await categoriesApi.createCategory(session, productsHelpers.buildSubcategoryPayload(new globalScope.FormData(categoriesForm)));
        await loadCategories();
        categoriesForm.reset();
        renderCategoryOptions();
        categoriesMessage.innerHTML = rootShellUi.renderInlineMessage('Subcategoria creada correctamente.');
        if (formSubcategoryInput && subcategory?.id) {
          formSubcategoryInput.value = String(subcategory.id);
        }
        setShellStatus('Subcategoria creada correctamente.');
      } catch (error) {
        categoriesMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear la subcategoria.', 'error');
        setShellStatus('No se pudo crear la subcategoria.', 'error');
      } finally {
        createCategoryButton.disabled = false;
        createCategoryButton.textContent = 'Crear categoria';
      }
    });

    // TASK-006: reacción al cambio de tipo de presentación.
    // Cuando el usuario cambia el tipo, se limpian y ocultan los campos anteriores.
    if (presentationTypeSelect) {
      presentationTypeSelect.addEventListener('change', () => {
        syncSizeFields(presentationTypeSelect.value, '');
      });
    }

    await loadCategories();
    await loadProducts({ page: 1 });
  }

  rootShell.register('views.productsAdmin', {
    mount,
    render,
  });
}(window));
