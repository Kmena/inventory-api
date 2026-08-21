(function attachRootShellRecipesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const recipesApi = rootShell.require('recipesApi');
  const productsApi = rootShell.require('productsApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const recipesHelpers = rootShell.require('views.recipesAdminHelpers');
  const recipesRenderers = rootShell.require('views.recipesAdminRenderers');
  const recipesState = rootShell.require('views.recipesAdminState');

  // Dynamic version form helpers are defined below in mount().

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Produccion</p>
        <h2 id="root-view-title">Recetas</h2>
        <p class="muted">Administra recetas, versiones y su relacion con productos sin mezclar flujos operativos de warehouse.</p>
      </section>

      <section class="routes-page products-page recipes-admin" id="recipes-page">
        <div id="recipes-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="recipes-page-message" aria-live="polite"></div>

        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Catalogo administrativo de recetas</h3>
              <p id="recipes-list-summary" class="muted">Consulta recetas activas, abre su detalle y administra versiones y asignaciones segun tus permisos.</p>
            </div>
            <div class="action-row compact-action-row recipes-header-actions">
              <button id="recipes-refresh-button" class="secondary-button" type="button">Actualizar</button>
              <button id="recipes-open-create-button" type="button">Nueva receta</button>
            </div>
          </div>

          <div class="client-command-bar products-filter-grid">
            <label class="client-search-field products-search-field"><span>Buscar</span><input id="recipes-search-input" type="search" placeholder="Codigo, nombre o tipo" /></label>
            <label><span>Estado</span><select id="recipes-status-filter"><option value="">Todos</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>
            <label><span>Tipo</span><select id="recipes-type-filter"><option value="">Todos</option></select></label>
            <label><span>Compartida</span><select id="recipes-shared-filter"><option value="">Todas</option><option value="yes">Solo compartidas</option><option value="no">No compartidas</option></select></label>
            <button id="recipes-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
          </div>

          <div class="products-workspace-grid">
            <div>
              <div id="recipes-list-region" aria-live="polite"></div>
            </div>
            <aside class="card root-card products-detail-card" aria-labelledby="recipes-detail-title">
              <div class="page-header">
                <div>
                  <h3 id="recipes-detail-title">Detalle de receta</h3>
                  <p id="recipes-detail-subtitle" class="muted">Selecciona una receta del listado para revisar versiones y productos asociados.</p>
                </div>
              </div>
              <div id="recipes-detail-message" aria-live="polite"></div>
              <div id="recipes-detail-region"></div>
            </aside>
          </div>
        </article>
      </section>

      <dialog id="recipes-form-dialog" class="modal-card products-modal-card">
        <form id="recipes-form" class="root-form" method="dialog" novalidate>
          <div class="products-modal-header">
            <div>
              <h3 id="recipes-form-title">Nueva receta</h3>
              <p class="muted">Registra una receta administrativa desde root.</p>
            </div>
            <button id="recipes-close-form-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="recipes-form-message" aria-live="polite"></div>
          <fieldset class="root-form__section">
            <legend>Datos principales</legend>
            <div class="products-form-grid">
              <label class="products-field-wide"><span>Nombre *</span><input id="recipes-form-name" name="name" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Codigo</span><input name="code" type="text" maxlength="50" /></label>
              <label><span>Tipo</span><input name="recipeType" type="text" maxlength="100" placeholder="BASE, ACABADO..." /></label>
              <label class="products-field-full products-checkbox-label">
                <input id="recipes-form-active" name="isActive" type="checkbox" checked />
                <span>Receta activa</span>
                <span class="products-field-hint">Las recetas inactivas siguen visibles en root para consulta administrativa.</span>
              </label>
            </div>
          </fieldset>
          <div class="action-row products-modal-actions">
            <button id="recipes-form-submit-button" type="submit">Guardar receta</button>
            <button id="recipes-cancel-form-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="recipes-version-dialog" class="modal-card products-modal-card">
        <form id="recipes-version-form" class="root-form" method="dialog" novalidate>
          <div class="products-modal-header">
            <div>
              <h3 id="recipes-version-title">Nueva version borrador</h3>
              <p class="muted">Usa arreglos JSON validos para ingredientes y etapas. Las versiones aprobadas son inmutables.</p>
            </div>
            <button id="recipes-close-version-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="recipes-version-message" aria-live="polite"></div>
          <fieldset class="root-form__section">
            <legend>Configuracion principal</legend>
            <div class="products-form-grid">
              <label><span>Vigencia desde</span><input name="effectiveFrom" type="date" /></label>
              <label><span>Vigencia hasta</span><input name="effectiveTo" type="date" /></label>
              <label><span>Rendimiento esperado</span><input name="expectedYield" type="number" min="0" step="0.01" /></label>
              <label><span>Merma esperada</span><input name="expectedWaste" type="number" min="0" step="0.01" /></label>
              <label><span>Tolerancia rendimiento %</span><input name="yieldTolerancePercent" type="number" min="0" max="100" step="0.01" /></label>
              <label><span>Tolerancia merma %</span><input name="wasteTolerancePercent" type="number" min="0" max="100" step="0.01" /></label>
              <label class="products-field-full"><span>Instrucciones</span><textarea name="instructions" rows="4" maxlength="5000"></textarea></label>
              <label class="products-field-full"><span>Notas</span><textarea name="notes" rows="3" maxlength="2000"></textarea></label>
            </div>
          </fieldset>
          <fieldset class="root-form__section">
            <legend>Etapas de produccion</legend>
            <p class="muted">Define las etapas en orden con sus insumos. El BOM general se calcula automaticamente.</p>
            <div id="recipes-version-stages-list" class="stack-section"></div>
            <button type="button" id="recipes-version-add-stage" class="secondary-button">+ Agregar etapa</button>
            </div>
          </fieldset>
          <div class="action-row products-modal-actions">
            <button id="recipes-version-submit-button" type="submit">Guardar version</button>
            <button id="recipes-cancel-version-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="recipes-stages-modal" class="modal-card products-modal-card" style="max-width:720px">
        <div class="products-modal-header">
          <div>
            <h3 id="recipes-stages-modal-title">Etapas de la version</h3>
            <p class="muted" id="recipes-stages-modal-subtitle"></p>
          </div>
          <button id="recipes-close-stages-modal" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="recipes-stages-modal-body" style="overflow-y:auto;max-height:65vh"></div>
        <div class="action-row products-modal-actions" id="recipes-stages-modal-footer">
          <button id="recipes-stages-edit-btn" class="secondary-button" type="button" hidden>Abrir editor completo</button>
        </div>
      </dialog>

      <dialog id="recipes-assignment-dialog" class="modal-card">
        <form id="recipes-assignment-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Asignar receta a producto</h3>
              <p class="muted">La receta puede compartirse entre varios productos. La version aplicable por producto seguira visible como no definida explicitamente cuando el modelo no la exponga.</p>
            </div>
            <button id="recipes-close-assignment-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="recipes-assignment-message" aria-live="polite"></div>
          <label><span>Producto</span><select id="recipes-assignment-product" name="productId" required><option value="">Selecciona un producto</option></select></label>
          <div class="action-row">
            <button id="recipes-assignment-submit-button" type="submit">Guardar asignacion</button>
            <button id="recipes-cancel-assignment-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const metricsRegion = container.querySelector('#recipes-metrics');
    const pageMessage = container.querySelector('#recipes-page-message');
    const listSummary = container.querySelector('#recipes-list-summary');
    const listRegion = container.querySelector('#recipes-list-region');
    const detailSubtitle = container.querySelector('#recipes-detail-subtitle');
    const detailMessage = container.querySelector('#recipes-detail-message');
    const detailRegion = container.querySelector('#recipes-detail-region');
    const searchInput = container.querySelector('#recipes-search-input');
    const statusFilter = container.querySelector('#recipes-status-filter');
    const typeFilter = container.querySelector('#recipes-type-filter');
    const sharedFilter = container.querySelector('#recipes-shared-filter');
    const clearFiltersButton = container.querySelector('#recipes-clear-filters-button');
    const refreshButton = container.querySelector('#recipes-refresh-button');
    const openCreateButton = container.querySelector('#recipes-open-create-button');
    const recipeFormDialog = container.querySelector('#recipes-form-dialog');
    const recipeForm = container.querySelector('#recipes-form');
    const recipeFormMessage = container.querySelector('#recipes-form-message');
    const recipeFormTitle = container.querySelector('#recipes-form-title');
    const recipeFormNameInput = container.querySelector('#recipes-form-name');
    const closeRecipeFormButton = container.querySelector('#recipes-close-form-button');
    const cancelRecipeFormButton = container.querySelector('#recipes-cancel-form-button');
    const versionDialog = container.querySelector('#recipes-version-dialog');
    const versionForm = container.querySelector('#recipes-version-form');
    const versionMessage = container.querySelector('#recipes-version-message');
    const versionTitle = container.querySelector('#recipes-version-title');
    const stagesList = container.querySelector('#recipes-version-stages-list');
    const addStageButton = container.querySelector('#recipes-version-add-stage');
    const closeVersionButton = container.querySelector('#recipes-close-version-button');
    const cancelVersionButton = container.querySelector('#recipes-cancel-version-button');
    const assignmentDialog = container.querySelector('#recipes-assignment-dialog');
    const assignmentForm = container.querySelector('#recipes-assignment-form');
    const assignmentMessage = container.querySelector('#recipes-assignment-message');
    const assignmentProductSelect = container.querySelector('#recipes-assignment-product');
    const closeAssignmentButton = container.querySelector('#recipes-close-assignment-button');
    const cancelAssignmentButton = container.querySelector('#recipes-cancel-assignment-button');
    const stagesModal = container.querySelector('#recipes-stages-modal');
    const stagesModalTitle = container.querySelector('#recipes-stages-modal-title');
    const stagesModalSubtitle = container.querySelector('#recipes-stages-modal-subtitle');
    const stagesModalBody = container.querySelector('#recipes-stages-modal-body');
    const stagesModalEditBtn = container.querySelector('#recipes-stages-edit-btn');
    const closeStagesModal = container.querySelector('#recipes-close-stages-modal');

    if (!metricsRegion || !pageMessage || !listSummary || !listRegion || !detailSubtitle || !detailMessage || !detailRegion || !searchInput || !statusFilter || !typeFilter || !sharedFilter || !clearFiltersButton || !refreshButton || !openCreateButton || !recipeFormDialog || !recipeForm || !recipeFormMessage || !recipeFormTitle || !recipeFormNameInput || !closeRecipeFormButton || !cancelRecipeFormButton || !versionDialog || !versionForm || !versionMessage || !versionTitle || !stagesList || !addStageButton || !closeVersionButton || !cancelVersionButton || !assignmentDialog || !assignmentForm || !assignmentMessage || !assignmentProductSelect || !closeAssignmentButton || !cancelAssignmentButton || !stagesModal || !stagesModalBody || !closeStagesModal) {
      return;
    }

    const permissions = {
      canViewRecipes: recipesHelpers.canViewRecipes(session, sessionAdapter),
      canManageRecipes: recipesHelpers.canManageRecipes(session, sessionAdapter),
      canApproveRecipes: recipesHelpers.canApproveRecipes(session, sessionAdapter),
      canViewAssignableProducts: recipesHelpers.canViewAssignableProducts(session, sessionAdapter),
      canAssignRecipesToProducts: recipesHelpers.canAssignRecipesToProducts(session, sessionAdapter),
    };

    let recipes = [];
    let filteredRecipes = [];
    let products = [];
    let associatedProductsByRecipeId = {};
    let filters = recipesState.createDefaultFilters();
    let selectedRecipeId = null;
    let selectedRecipeDetail = null;
    let detailState = 'idle';
    let activeTab = 'summary';
    let editingVersionId = null;
    let recipeBeingAssigned = null;

    function setDialogVisibility(dialog, shouldOpen) {
      if (!(dialog instanceof globalScope.HTMLDialogElement)) {
        return;
      }

      if (shouldOpen) {
        if (!dialog.open && typeof dialog.showModal === 'function') {
          dialog.showModal();
        }
        return;
      }

      if (dialog.open && typeof dialog.close === 'function') {
        dialog.close();
      }
    }

    function normalizeProductsResponse(response) {
      if (Array.isArray(response)) {
        return response;
      }
      return Array.isArray(response?.items) ? response.items : [];
    }

    function parseOptionalNumber(value) {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : undefined;
    }

    function parseOptionalDate(value) {
      const normalizedValue = String(value || '').trim();
      return normalizedValue ? normalizedValue : undefined;
    }

    function getSelectedRecipe() {
      if (selectedRecipeDetail && String(selectedRecipeDetail.id) === String(selectedRecipeId)) {
        return selectedRecipeDetail;
      }
      return recipesState.resolveSelectedRecipe(recipes, selectedRecipeId);
    }

    function getSelectedRecipeVersions() {
      return Array.isArray(selectedRecipeDetail?.versions) ? selectedRecipeDetail.versions : [];
    }

    function getAssociatedProductsForSelectedRecipe() {
      return associatedProductsByRecipeId[String(selectedRecipeId)] || [];
    }

    function syncActionVisibility() {
      openCreateButton.hidden = !permissions.canManageRecipes;
      openCreateButton.disabled = !permissions.canManageRecipes;
      if (!permissions.canManageRecipes) {
        openCreateButton.title = 'Necesitas permisos de gestion de recetas para crear nuevas recetas.';
      }
    }

    function renderFilterOptions() {
      typeFilter.innerHTML = recipesRenderers.renderRecipeTypeOptions(recipesState.buildRecipeTypeOptions(recipes), filters.recipeType);
    }

    function applyFilters() {
      filteredRecipes = recipesState.filterRecipes(recipes, filters);
      selectedRecipeId = recipesState.resolveSelectedRecipeId(filteredRecipes, selectedRecipeId);
      if (!selectedRecipeId) {
        selectedRecipeDetail = null;
      }
    }

    function renderList() {
      if (!permissions.canViewRecipes) {
        listRegion.innerHTML = recipesRenderers.renderState('Sin acceso', 'No tienes permisos para consultar recetas desde root.');
        return;
      }

      if (!recipes.length) {
        listRegion.innerHTML = recipesRenderers.renderState('Sin recetas', 'Aun no hay recetas registradas para esta empresa.');
        return;
      }

      if (!filteredRecipes.length) {
        listRegion.innerHTML = recipesRenderers.renderState('Sin resultados', 'No hay recetas para los filtros seleccionados.');
        return;
      }

      listRegion.innerHTML = recipesRenderers.renderRecipesList(filteredRecipes, selectedRecipeId);
    }

    function renderDetail() {
      detailRegion.innerHTML = recipesRenderers.renderRecipeDetail(getSelectedRecipe(), {
        detailState,
        activeTab,
        versions: getSelectedRecipeVersions(),
        associatedProducts: getAssociatedProductsForSelectedRecipe(),
        permissions,
      });
      const selectedRecipe = getSelectedRecipe();
      detailSubtitle.textContent = selectedRecipe
        ? `${selectedRecipe.code || 'Sin codigo'} · ${selectedRecipe.recipeType || 'Sin tipo'} · ${getAssociatedProductsForSelectedRecipe().length} producto(s) visible(s)`
        : 'Selecciona una receta del listado para revisar versiones y productos asociados.';
    }

    function renderMetricsAndSummary() {
      metricsRegion.innerHTML = recipesRenderers.renderMetrics(recipes, products);
      listSummary.textContent = filteredRecipes.length
        ? `Mostrando ${filteredRecipes.length} receta(s) visibles para esta empresa.`
        : 'No hay recetas visibles con los filtros actuales.';
    }

    function renderAssignmentOptions() {
      assignmentProductSelect.innerHTML = recipesRenderers.renderProductAssignmentOptions(products.filter((product) => String(product?.recipeId || product?.recipe?.id || '') !== String(recipeBeingAssigned?.id || '')));
    }

    function renderAll() {
      associatedProductsByRecipeId = recipesState.buildAssociatedProductsByRecipeId(products, recipesHelpers);
      recipes = recipesState.decorateRecipes(recipes, associatedProductsByRecipeId);
      applyFilters();
      renderFilterOptions();
      renderMetricsAndSummary();
      renderList();
      renderDetail();
      renderAssignmentOptions();
    }

    async function loadRecipeDetail(recipeId) {
      if (!recipeId) {
        selectedRecipeDetail = null;
        detailState = 'idle';
        renderDetail();
        return;
      }

      detailState = 'loading';
      renderDetail();

      try {
        const [recipeDetail, versions] = await Promise.all([
          recipesApi.getRecipe(session, recipeId),
          recipesApi.listRecipeVersions(session, recipeId),
        ]);
        selectedRecipeDetail = {
          ...recipeDetail,
          versions: Array.isArray(versions) ? versions : [],
        };
        detailState = 'ready';
      } catch (error) {
        detailState = 'error';
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo cargar el detalle de la receta.', 'error');
      }

      renderDetail();
    }

    async function loadData(options = {}) {
      const preserveSelection = options.preserveSelection !== false;
      const previousSelection = preserveSelection ? selectedRecipeId : null;
      pageMessage.innerHTML = rootShellUi.renderInlineMessage('Cargando recetas...', 'default');
      setShellStatus('Cargando recetas...');

      try {
        const recipesResponse = await recipesApi.listRecipes(session, { page: 1, pageSize: 100 });
        recipes = recipesHelpers.normalizeRecipeListResponse(recipesResponse).items;

        if (permissions.canViewAssignableProducts || permissions.canAssignRecipesToProducts) {
          products = normalizeProductsResponse(await productsApi.listProducts(session, { page: 1, pageSize: 100 }));
        } else {
          products = [];
        }

        pageMessage.innerHTML = '';
        detailMessage.innerHTML = '';
        selectedRecipeId = recipesState.resolveSelectedRecipeId(recipes, previousSelection);
        selectedRecipeDetail = null;
        renderAll();
        await loadRecipeDetail(selectedRecipeId);
        setShellStatus('Recetas listas.');
      } catch (error) {
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo cargar la vista de recetas.', 'error');
        listRegion.innerHTML = recipesRenderers.renderState('No se pudo cargar la informacion', 'Intenta nuevamente para recuperar el workspace de recetas.');
        detailRegion.innerHTML = '';
        setShellStatus('Error cargando recetas.', 'error');
      }
    }

    // ── Dynamic version form helpers ──

    function renderProductOptions(selectedId) {
      return '<option value="">Selecciona producto</option>' +
        products.map((p) => {
          const selected = String(p.id) === String(selectedId) ? ' selected' : '';
          const label = rootShellUi.escapeHtml(`${p.name || 'Producto'}${p.code ? ' · ' + p.code : ''}`);
          return `<option value="${rootShellUi.escapeHtml(String(p.id))}"${selected}>${label}</option>`;
        }).join('');
    }

    function resolveProductUnit(productId) {
      if (!productId) { return null; }
      const found = products.find((p) => String(p.id) === String(productId));
      return found?.unit || null;
    }

    function addStageInputRow(inputsContainer, data) {
      const row = globalScope.document.createElement('div');
      row.className = 'products-form-grid stage-input-row';
      row.style.alignItems = 'end';
      const existingUnit = data.unit || '';
      const productUnit = resolveProductUnit(data.productId);
      const effectiveUnit = productUnit || existingUnit;
      const unitReadonly = Boolean(data.productId && productUnit);
      row.innerHTML = `
        <label><span>Producto</span><select class="si-product">${renderProductOptions(data.productId)}</select></label>
        <label><span>Nombre *</span><input class="si-name" type="text" value="${rootShellUi.escapeHtml(data.name || '')}" required /></label>
        <label><span>Cantidad</span><input class="si-quantity" type="number" min="0" step="0.001" value="${data.quantity || ''}" /></label>
        <label><span>Unidad</span><input class="si-unit" type="text" value="${rootShellUi.escapeHtml(effectiveUnit)}" placeholder="kg, L, unidad" ${unitReadonly ? 'readonly aria-readonly="true" title="Unidad heredada del producto"' : ''} /></label>
        <button type="button" class="secondary-button remove-stage-input-btn" title="Quitar insumo">✕</button>
      `;

      // Unit inheritance: when product changes, update unit field
      const productSelect = row.querySelector('.si-product');
      const unitInput = row.querySelector('.si-unit');
      productSelect.addEventListener('change', () => {
        const unit = resolveProductUnit(productSelect.value);
        if (unit) {
          unitInput.value = unit;
          unitInput.readOnly = true;
          unitInput.setAttribute('aria-readonly', 'true');
          unitInput.title = 'Unidad heredada del producto';
        } else {
          unitInput.readOnly = false;
          unitInput.removeAttribute('aria-readonly');
          unitInput.title = '';
          if (!unitInput.value) { unitInput.value = ''; }
        }
      });

      inputsContainer.appendChild(row);
    }

    function addQaParameterRow(qaContainer, param) {
      const row = globalScope.document.createElement('div');
      row.className = 'products-form-grid qa-param-row';
      row.style.alignItems = 'end';
      row.innerHTML = `
        <label><span>Nombre *</span><input class="qp-name" type="text" value="${rootShellUi.escapeHtml(param.name || '')}" required placeholder="pH, Temperatura" /></label>
        <label><span>Unidad</span><input class="qp-unit" type="text" value="${rootShellUi.escapeHtml(param.unit || '')}" placeholder="pH, ºC, %" maxlength="40" /></label>
        <label><span>Valor esperado *</span><input class="qp-expected" type="number" step="any" value="${param.expectedValue !== undefined ? param.expectedValue : ''}" required /></label>
        <label><span>Tol. min (−)</span><input class="qp-min-tol" type="number" step="any" min="0" value="${param.minTolerance !== undefined ? param.minTolerance : '0'}" /></label>
        <label><span>Tol. max (+)</span><input class="qp-max-tol" type="number" step="any" min="0" value="${param.maxTolerance !== undefined ? param.maxTolerance : '0'}" /></label>
        <button type="button" class="secondary-button remove-qa-param-btn" title="Quitar parametro QA">✕</button>
      `;
      row.querySelector('.remove-qa-param-btn').addEventListener('click', () => {
        row.remove();
      });
      qaContainer.appendChild(row);
    }

    function addStageSection(data) {
      const section = globalScope.document.createElement('div');
      section.className = 'stage-section';
      section.style.cssText = 'border:1px solid var(--border, #ddd); border-radius:8px; padding:1rem; margin-bottom:0.75rem;';
      const qaMandatory = Boolean(data.qaMandatory);
      section.innerHTML = `
        <div class="products-form-grid">
          <label><span>Nombre de etapa *</span><input class="stage-name" type="text" required value="${rootShellUi.escapeHtml(data.name || '')}" /></label>
          <label class="products-checkbox-label"><input class="stage-qa" type="checkbox" ${qaMandatory ? 'checked' : ''} /><span>QA obligatorio</span></label>
          <label class="products-field-full"><span>Instrucciones</span><textarea class="stage-instructions" rows="2">${rootShellUi.escapeHtml(data.instructions || '')}</textarea></label>
        </div>
        <div class="stage-qa-params" style="margin-top:0.75rem;${qaMandatory ? '' : 'display:none'}">
          <p class="muted" style="margin:0 0 0.5rem"><strong>Parametros QA esperados</strong></p>
          <div class="qa-params-list stack-section"></div>
          <p class="qa-params-empty-msg" style="color:var(--color-danger,#c00);font-size:0.85rem;display:none">Debes definir al menos un parametro esperado.</p>
          <button type="button" class="secondary-button add-qa-param-btn" style="margin-top:0.25rem">+ Añadir parametro</button>
        </div>
        <div style="margin-top:0.75rem">
          <p class="muted" style="margin:0 0 0.5rem"><strong>Insumos de esta etapa</strong></p>
          <div class="stage-inputs-list stack-section"></div>
          <button type="button" class="secondary-button add-stage-input-btn" style="margin-top:0.25rem">+ Agregar insumo</button>
        </div>
        <button type="button" class="secondary-button remove-stage-btn" style="margin-top:0.5rem">Quitar etapa</button>
      `;
      stagesList.appendChild(section);

      const qaCheckbox = section.querySelector('.stage-qa');
      const qaParamsBlock = section.querySelector('.stage-qa-params');
      const qaParamsList = section.querySelector('.qa-params-list');
      const qaEmptyMsg = section.querySelector('.qa-params-empty-msg');
      const addQaBtn = section.querySelector('.add-qa-param-btn');

      // Toggle QA block on checkbox change
      qaCheckbox.addEventListener('change', () => {
        qaParamsBlock.style.display = qaCheckbox.checked ? '' : 'none';
      });

      addQaBtn.addEventListener('click', () => {
        addQaParameterRow(qaParamsList, recipesHelpers.buildDefaultQaParameter());
        if (qaEmptyMsg) { qaEmptyMsg.style.display = 'none'; }
      });

      // Load existing QA params
      (data.expectedParameters || []).forEach((param) => addQaParameterRow(qaParamsList, param));

      const inputsContainer = section.querySelector('.stage-inputs-list');
      (data.stageInputs || []).forEach((si) => addStageInputRow(inputsContainer, si));
    }

    function collectQaParams(section) {
      return Array.from(section.querySelectorAll('.qa-param-row')).map((row) => ({
        name: row.querySelector('.qp-name').value.trim(),
        unit: row.querySelector('.qp-unit').value.trim() || undefined,
        expectedValue: Number(row.querySelector('.qp-expected').value),
        minTolerance: Number(row.querySelector('.qp-min-tol').value || '0'),
        maxTolerance: Number(row.querySelector('.qp-max-tol').value || '0'),
      })).filter((p) => p.name);
    }

    function validateQaParamsInline(section) {
      const qaMandatory = section.querySelector('.stage-qa')?.checked;
      if (!qaMandatory) { return true; }
      const params = collectQaParams(section);
      const emptyMsg = section.querySelector('.qa-params-empty-msg');
      if (params.length === 0) {
        if (emptyMsg) { emptyMsg.style.display = ''; }
        return false;
      }
      if (emptyMsg) { emptyMsg.style.display = 'none'; }
      return true;
    }

    function collectStages() {
      return Array.from(stagesList.querySelectorAll('.stage-section')).map((section) => {
        const inputRows = section.querySelectorAll('.stage-input-row');
        const qaMandatory = section.querySelector('.stage-qa').checked;
        return {
          name: section.querySelector('.stage-name').value.trim(),
          instructions: section.querySelector('.stage-instructions').value.trim() || undefined,
          qaMandatory,
          expectedParameters: qaMandatory ? collectQaParams(section) : [],
          stageInputs: Array.from(inputRows).map((row) => ({
            productId: Number(row.querySelector('.si-product').value) || undefined,
            name: row.querySelector('.si-name').value.trim(),
            quantity: Number(row.querySelector('.si-quantity').value) || undefined,
            unit: row.querySelector('.si-unit').value.trim() || undefined,
          })).filter((si) => si.name),
        };
      }).filter((s) => s.name);
    }

    // ── Form lifecycle ──

    function resetRecipeForm() {
      recipeForm.reset();
      recipeFormTitle.textContent = 'Nueva receta';
      recipeFormMessage.innerHTML = '';
    }

    function resetVersionForm() {
      versionForm.reset();
      versionTitle.textContent = editingVersionId ? 'Editar version borrador' : 'Nueva version borrador';
      versionMessage.innerHTML = '';
      stagesList.innerHTML = '';
    }

    function openCreateRecipeDialog() {
      resetRecipeForm();
      setDialogVisibility(recipeFormDialog, true);
      recipeFormNameInput.focus();
    }

    function openCreateVersionDialog() {
      editingVersionId = null;
      resetVersionForm();
      addStageSection({ name: '', stageInputs: [] });
      setDialogVisibility(versionDialog, true);
    }

    function openEditVersionDialog(versionId) {
      const version = getSelectedRecipeVersions().find((entry) => String(entry?.id) === String(versionId));
      if (!version) {
        return;
      }

      editingVersionId = version.id;
      resetVersionForm();
      versionTitle.textContent = 'Editar version borrador';
      versionForm.elements.namedItem('effectiveFrom').value = version.effectiveFrom ? String(version.effectiveFrom).slice(0, 10) : '';
      versionForm.elements.namedItem('effectiveTo').value = version.effectiveTo ? String(version.effectiveTo).slice(0, 10) : '';
      versionForm.elements.namedItem('expectedYield').value = version.expectedYield ?? '';
      versionForm.elements.namedItem('expectedWaste').value = version.expectedWaste ?? '';
      versionForm.elements.namedItem('yieldTolerancePercent').value = version.yieldTolerancePercent ?? '';
      versionForm.elements.namedItem('wasteTolerancePercent').value = version.wasteTolerancePercent ?? '';
      versionForm.elements.namedItem('instructions').value = version.instructions || '';
      versionForm.elements.namedItem('notes').value = version.notes || '';

      (version.stages || []).forEach((stage) => addStageSection({
        name: stage.name,
        instructions: stage.instructions,
        qaMandatory: Boolean(stage.qaMandatory),
        expectedParameters: Array.isArray(stage.expectedParameters) ? stage.expectedParameters : [],
        stageInputs: (stage.stageInputs || []).map((si) => ({
          productId: si.productId,
          name: si.name,
          quantity: si.quantity,
          unit: si.unit,
        })),
      }));
      if (!version.stages?.length) addStageSection({ name: '', stageInputs: [] });

      setDialogVisibility(versionDialog, true);
    }

    function openAssignmentDialog() {
      recipeBeingAssigned = getSelectedRecipe();
      assignmentForm.reset();
      assignmentMessage.innerHTML = '';
      renderAssignmentOptions();
      setDialogVisibility(assignmentDialog, true);
      assignmentProductSelect.focus();
    }

    async function handleRecipeSelection(recipeId) {
      selectedRecipeId = recipeId;
      activeTab = 'summary';
      detailMessage.innerHTML = '';
      renderAll();
      await loadRecipeDetail(recipeId);
    }

    function buildRecipePayload(formData) {
      return {
        name: String(formData.get('name') || '').trim(),
        code: String(formData.get('code') || '').trim() || undefined,
        recipeType: String(formData.get('recipeType') || '').trim() || undefined,
        isActive: formData.get('isActive') === 'on',
      };
    }

    function buildVersionPayload(formData) {
      const stages = collectStages();

      if (!stages.length) {
        throw new Error('Agrega al menos una etapa.');
      }

      // QA inline validation: enforce at least 1 parameter when qaMandatory
      let qaValid = true;
      stagesList.querySelectorAll('.stage-section').forEach((section) => {
        if (!validateQaParamsInline(section)) { qaValid = false; }
      });
      if (!qaValid) {
        throw new Error('Una etapa con QA obligatorio requiere al menos un parametro esperado.');
      }

      const rawValues = {
        effectiveFrom: parseOptionalDate(formData.get('effectiveFrom')),
        effectiveTo: parseOptionalDate(formData.get('effectiveTo')),
        expectedYield: parseOptionalNumber(formData.get('expectedYield')),
        expectedWaste: parseOptionalNumber(formData.get('expectedWaste')),
        yieldTolerancePercent: parseOptionalNumber(formData.get('yieldTolerancePercent')),
        wasteTolerancePercent: parseOptionalNumber(formData.get('wasteTolerancePercent')),
        instructions: String(formData.get('instructions') || '').trim() || undefined,
        notes: String(formData.get('notes') || '').trim() || undefined,
        stages,
      };

      return recipesState.serializeVersionPayloadFromForm(rawValues);
    }

    syncActionVisibility();

    if (!permissions.canViewRecipes) {
      pageMessage.innerHTML = rootShellUi.renderInlineMessage('No tienes permisos para gestionar recetas.', 'warning');
      listRegion.innerHTML = recipesRenderers.renderState('Sin acceso', 'No tienes permisos para consultar recetas desde root.');
      detailRegion.innerHTML = '';
      setShellStatus('Acceso restringido.', 'warning');
      return;
    }

    searchInput.addEventListener('input', () => {
      filters.searchTerm = searchInput.value;
      renderAll();
    });

    statusFilter.addEventListener('change', () => {
      filters.status = statusFilter.value;
      renderAll();
    });

    typeFilter.addEventListener('change', () => {
      filters.recipeType = typeFilter.value;
      renderAll();
    });

    sharedFilter.addEventListener('change', () => {
      filters.sharedOnly = sharedFilter.value;
      renderAll();
    });

    clearFiltersButton.addEventListener('click', () => {
      filters = recipesState.createDefaultFilters();
      searchInput.value = '';
      statusFilter.value = '';
      typeFilter.value = '';
      sharedFilter.value = '';
      renderAll();
    });

    refreshButton.addEventListener('click', async () => {
      await loadData();
    });

    openCreateButton.addEventListener('click', () => {
      openCreateRecipeDialog();
    });

    closeRecipeFormButton.addEventListener('click', () => setDialogVisibility(recipeFormDialog, false));
    cancelRecipeFormButton.addEventListener('click', () => setDialogVisibility(recipeFormDialog, false));
    closeVersionButton.addEventListener('click', () => setDialogVisibility(versionDialog, false));
    cancelVersionButton.addEventListener('click', () => setDialogVisibility(versionDialog, false));

    addStageButton.addEventListener('click', () => addStageSection({ name: '', stageInputs: [] }));

    versionDialog.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLButtonElement)) return;
      if (target.classList.contains('remove-ingredient-btn')) {
        target.closest('.ingredient-row')?.remove();
        return;
      }
      if (target.classList.contains('remove-stage-btn')) {
        target.closest('.stage-section')?.remove();
        return;
      }
      if (target.classList.contains('remove-stage-input-btn')) {
        target.closest('.stage-input-row')?.remove();
        return;
      }
      if (target.classList.contains('add-stage-input-btn')) {
        const inputsContainer = target.closest('.stage-section')?.querySelector('.stage-inputs-list');
        if (inputsContainer) addStageInputRow(inputsContainer, {});
      }
    });
    closeAssignmentButton.addEventListener('click', () => setDialogVisibility(assignmentDialog, false));
    cancelAssignmentButton.addEventListener('click', () => setDialogVisibility(assignmentDialog, false));

    recipeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = buildRecipePayload(new globalScope.FormData(recipeForm));

      try {
        await recipesApi.createRecipe(session, payload);
        recipeFormMessage.innerHTML = rootShellUi.renderInlineMessage('Receta creada correctamente.', 'success');
        setDialogVisibility(recipeFormDialog, false);
        await loadData({ preserveSelection: false });
      } catch (error) {
        recipeFormMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo crear la receta.', 'error');
      }
    });

    versionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedRecipeId) {
        versionMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona una receta antes de gestionar versiones.', 'warning');
        return;
      }

      let payload;
      try {
        payload = buildVersionPayload(new globalScope.FormData(versionForm));
      } catch (error) {
        versionMessage.innerHTML = rootShellUi.renderInlineMessage(error.message, 'error');
        return;
      }

      try {
        if (editingVersionId) {
          await recipesApi.updateRecipeVersion(session, editingVersionId, payload);
        } else {
          await recipesApi.createRecipeVersion(session, selectedRecipeId, payload);
        }
        versionMessage.innerHTML = rootShellUi.renderInlineMessage(editingVersionId ? 'Version borrador actualizada.' : 'Version borrador guardada.', 'success');
        setDialogVisibility(versionDialog, false);
        await loadRecipeDetail(selectedRecipeId);
      } catch (error) {
        versionMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo guardar la version.', 'error');
      }
    });

    assignmentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const productId = assignmentProductSelect.value;
      if (!productId || !recipeBeingAssigned?.id) {
        assignmentMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona un producto valido.', 'warning');
        return;
      }

      try {
        const payload = recipesHelpers.buildRecipeAssignmentPayload(recipeBeingAssigned.id);
        await productsApi.assignRecipeToProduct(session, productId, payload.recipeId);
        assignmentMessage.innerHTML = rootShellUi.renderInlineMessage('Asignacion actualizada correctamente.', 'success');
        setDialogVisibility(assignmentDialog, false);
        await loadData();
      } catch (error) {
        assignmentMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo actualizar la asignacion.', 'error');
      }
    });

    listRegion.addEventListener('click', async (event) => {
      const target = event.target;
      const button = target instanceof HTMLElement ? target.closest('[data-recipe-detail]') : null;
      if (!(button instanceof globalScope.HTMLButtonElement)) {
        return;
      }
      const recipeId = button.getAttribute('data-recipe-detail');
      if (!recipeId) {
        return;
      }
      await handleRecipeSelection(recipeId);
    });

    detailRegion.addEventListener('click', async (event) => {
      const target = event.target;
      const tabButton = target instanceof HTMLElement ? target.closest('[data-recipes-tab]') : null;
      if (tabButton instanceof globalScope.HTMLButtonElement) {
        const tabKey = tabButton.getAttribute('data-recipes-tab');
        if (tabKey) {
          activeTab = tabKey;
          renderDetail();
        }
        return;
      }

      const createVersionButton = target instanceof HTMLElement ? target.closest('#recipes-open-create-version-button') : null;
      if (createVersionButton instanceof globalScope.HTMLButtonElement) {
        openCreateVersionDialog();
        return;
      }

      const assignmentButton = target instanceof HTMLElement ? target.closest('#recipes-open-assignment-button') : null;
      if (assignmentButton instanceof globalScope.HTMLButtonElement) {
        openAssignmentDialog();
        return;
      }

      const editVersionButton = target instanceof HTMLElement ? target.closest('[data-edit-recipe-version]') : null;
      if (editVersionButton instanceof globalScope.HTMLButtonElement) {
        const versionId = editVersionButton.getAttribute('data-edit-recipe-version');
        if (versionId) {
          openEditVersionDialog(versionId);
        }
        return;
      }

      const approveVersionButton = target instanceof HTMLElement ? target.closest('[data-approve-recipe-version]') : null;
      if (approveVersionButton instanceof globalScope.HTMLButtonElement) {
        const versionId = approveVersionButton.getAttribute('data-approve-recipe-version');
        if (!versionId) { return; }

        try {
          await recipesApi.approveRecipeVersion(session, versionId, {});
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Version aprobada correctamente.', 'success');
          await loadRecipeDetail(selectedRecipeId);
          await loadData();
        } catch (error) {
          detailMessage.innerHTML = rootShellUi.renderInlineMessage(error?.message || 'No se pudo aprobar la version.', 'error');
        }
        return;
      }

      const viewStagesButton = target instanceof HTMLElement ? target.closest('[data-view-stages]') : null;
      if (viewStagesButton instanceof globalScope.HTMLButtonElement) {
        const versionId = viewStagesButton.getAttribute('data-view-stages');
        const versionLabel = viewStagesButton.getAttribute('data-version-label') || 'version';
        const isDraft = viewStagesButton.getAttribute('data-is-draft') === 'true';
        const version = getSelectedRecipeVersions().find((v) => String(v?.id) === String(versionId));
        if (!version) { return; }

        stagesModalTitle.textContent = `Etapas · ${versionLabel}`;
        stagesModalSubtitle.textContent = isDraft
          ? 'Borrador — puedes editar desde "Abrir editor completo".'
          : 'Version aprobada — solo lectura.';
        stagesModalBody.innerHTML = recipesRenderers.renderStagesModalContent(version);

        if (stagesModalEditBtn) {
          stagesModalEditBtn.hidden = !isDraft || !permissions.canManageRecipes;
          stagesModalEditBtn.onclick = () => {
            setDialogVisibility(stagesModal, false);
            openEditVersionDialog(versionId);
          };
        }

        setDialogVisibility(stagesModal, true);
        return;
      }
    });

    closeStagesModal.addEventListener('click', () => setDialogVisibility(stagesModal, false));

    await loadData({ preserveSelection: false });
  }

  rootShell.register('views.recipesAdmin', {
    mount,
    render,
  });
}(window));
