(function attachRootShellRecipesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const recipesApi = rootShell.require('recipesApi');
  const productsApi = rootShell.require('productsApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const recipesHelpers = rootShell.require('views.recipesAdminHelpers');
  const recipesRenderers = rootShell.require('views.recipesAdminRenderers');
  const recipesState = rootShell.require('views.recipesAdminState');
  const recipesVersionEditorModule = rootShell.require('views.recipesAdminVersionEditor');

  function render() {
    return recipesRenderers.renderWorkspace();
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

    const recipesVersionEditor = recipesVersionEditorModule.createVersionEditor({
      getProducts: () => products,
      getSelectedRecipeVersions,
      getEditingVersionId: () => editingVersionId,
      setEditingVersionId: (value) => {
        editingVersionId = value;
      },
      recipesHelpers,
      recipesState,
      rootShellUi,
      setDialogVisibility,
      stagesList,
      versionDialog,
      versionForm,
      versionMessage,
      versionTitle,
    });

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

    function resetRecipeForm() {
      recipeForm.reset();
      recipeFormTitle.textContent = 'Nueva receta';
      recipeFormMessage.innerHTML = '';
    }

    function openCreateRecipeDialog() {
      resetRecipeForm();
      setDialogVisibility(recipeFormDialog, true);
      recipeFormNameInput.focus();
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

    addStageButton.addEventListener('click', () => recipesVersionEditor.addStageSection({ name: '', stageInputs: [] }));

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
        if (inputsContainer) recipesVersionEditor.addStageInputRow(inputsContainer, {});
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
        payload = recipesVersionEditor.buildVersionPayload(
          new globalScope.FormData(versionForm),
          parseOptionalDate,
          parseOptionalNumber,
        );
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
        recipesVersionEditor.openCreateVersionDialog();
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
          recipesVersionEditor.openEditVersionDialog(versionId);
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
            recipesVersionEditor.openEditVersionDialog(versionId);
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
