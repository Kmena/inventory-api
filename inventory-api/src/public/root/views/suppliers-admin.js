(function attachRootShellSuppliersAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const suppliersApi = rootShell.require('suppliersApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const suppliersHelpers = rootShell.require('views.suppliersAdminHelpers');
  const suppliersRenderers = rootShell.require('views.suppliersAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Proveedores</h2>
        <p class="muted">Gestiona los proveedores de la empresa y asigna los productos que cada uno ofrece.</p>
      </section>

      <section class="routes-page suppliers-page" id="suppliers-page">
        <div id="suppliers-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="suppliers-page-message"></div>

        <article class="card root-card">
          <div class="page-header">
            <div>
              <h3>Proveedores de la empresa</h3>
              <p id="suppliers-list-summary" class="muted">Cargando proveedores...</p>
            </div>
            <div class="action-row compact-action-row">
              <button id="suppliers-refresh-button" class="secondary-button" type="button">Actualizar</button>
              <button id="suppliers-open-create-button" type="button">Nuevo proveedor</button>
            </div>
          </div>

          <div class="client-command-bar">
            <label class="client-search-field"><span>Buscar</span><input id="suppliers-search-input" type="search" placeholder="Nombre del proveedor" /></label>
          </div>

          <div id="suppliers-list-region" aria-live="polite"></div>
        </article>
      </section>

      <dialog id="suppliers-create-dialog" class="modal-card">
        <form id="suppliers-create-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3 id="suppliers-dialog-title">Nuevo proveedor</h3>
              <p class="muted">Registra un proveedor para la empresa.</p>
            </div>
            <button id="suppliers-close-create-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="suppliers-create-message"></div>
          <fieldset class="root-form__section">
            <legend>Datos del proveedor</legend>
            <div class="root-form-grid">
              <label><span>Nombre *</span><input id="suppliers-create-name" name="name" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Email</span><input name="email" type="email" maxlength="255" /></label>
              <label><span>Telefono</span><input name="phone" type="text" maxlength="50" /></label>
              <label><span>Pais</span><input name="country" type="text" maxlength="120" /></label>
              <label class="field-wide"><span>Nota</span><textarea name="note" maxlength="500" rows="2"></textarea></label>
            </div>
          </fieldset>
          <div class="action-row">
            <button id="suppliers-create-submit-button" type="submit">Guardar proveedor</button>
            <button id="suppliers-create-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="suppliers-detail-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="suppliers-detail-title">Detalle del proveedor</h3>
            <p id="suppliers-detail-subtitle" class="muted"></p>
          </div>
          <div class="action-row compact-action-row">
            <button id="suppliers-edit-button" class="secondary-button" type="button">Editar</button>
            <button id="suppliers-delete-button" class="secondary-button" type="button">Eliminar</button>
            <button id="suppliers-close-detail-button" class="secondary-button" type="button">Cerrar</button>
          </div>
        </div>
        <div id="suppliers-detail-message"></div>
        <div id="suppliers-detail-info"></div>
        <div class="page-header" style="margin-top:1rem;">
          <h4>Productos asignados</h4>
          <button id="suppliers-open-add-product-button" type="button">Asignar producto</button>
        </div>
        <div id="suppliers-detail-products" aria-live="polite"></div>
      </dialog>

      <dialog id="suppliers-add-product-dialog" class="modal-card">
        <form id="suppliers-add-product-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Asignar producto al proveedor</h3>
              <p class="muted">Selecciona un producto y define las condiciones comerciales.</p>
            </div>
            <button id="suppliers-close-add-product-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="suppliers-add-product-message"></div>
          <fieldset class="root-form__section">
            <legend>Producto y condiciones</legend>
            <div class="root-form-grid">
              <label class="field-wide">
                <span>Producto *</span>
                <input id="suppliers-add-product-search" type="search" placeholder="Buscar producto por nombre o SKU" aria-label="Filtrar productos disponibles" />
                <small id="suppliers-add-product-search-summary" class="muted" aria-live="polite"></small>
                <select id="suppliers-add-product-select" name="productId" required></select>
              </label>
              <label><span>SKU del proveedor</span><input name="supplierSku" type="text" maxlength="100" /></label>
              <label><span>Precio unitario</span><input name="unitPrice" type="number" min="0" step="0.01" /></label>
              <label><span>Moneda</span><input name="currency" type="text" maxlength="10" placeholder="CRC" /></label>
              <label><span>Tiempo de entrega (dias)</span><input name="leadTimeDays" type="number" min="0" step="1" /></label>
              <label><span>Cantidad min. de orden</span><input name="minimumOrderQuantity" type="number" min="0" step="0.01" /></label>
              <label><span>Proveedor preferido</span><input name="isPreferred" type="checkbox" /></label>
              <label class="field-wide"><span>Notas</span><textarea name="notes" maxlength="500" rows="2"></textarea></label>
            </div>
          </fieldset>
          <div class="action-row">
            <button id="suppliers-add-product-submit-button" type="submit">Asignar producto</button>
            <button id="suppliers-add-product-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const canManage = sessionAdapter.hasPermission(session, 'suppliers.manage');

    const metricsRegion = container.querySelector('#suppliers-metrics');
    const pageMessage = container.querySelector('#suppliers-page-message');
    const listSummary = container.querySelector('#suppliers-list-summary');
    const listRegion = container.querySelector('#suppliers-list-region');
    const searchInput = container.querySelector('#suppliers-search-input');
    const refreshButton = container.querySelector('#suppliers-refresh-button');
    const openCreateButton = container.querySelector('#suppliers-open-create-button');
    const createDialog = container.querySelector('#suppliers-create-dialog');
    const createForm = container.querySelector('#suppliers-create-form');
    const createMessage = container.querySelector('#suppliers-create-message');
    const dialogTitle = container.querySelector('#suppliers-dialog-title');
    const closeCreateButton = container.querySelector('#suppliers-close-create-button');
    const cancelCreateButton = container.querySelector('#suppliers-create-cancel-button');
    const submitCreateButton = container.querySelector('#suppliers-create-submit-button');
    const nameInput = container.querySelector('#suppliers-create-name');
    const detailDialog = container.querySelector('#suppliers-detail-dialog');
    const detailTitle = container.querySelector('#suppliers-detail-title');
    const detailSubtitle = container.querySelector('#suppliers-detail-subtitle');
    const detailMessage = container.querySelector('#suppliers-detail-message');
    const detailInfo = container.querySelector('#suppliers-detail-info');
    const detailProducts = container.querySelector('#suppliers-detail-products');
    const editButton = container.querySelector('#suppliers-edit-button');
    const deleteButton = container.querySelector('#suppliers-delete-button');
    const closeDetailButton = container.querySelector('#suppliers-close-detail-button');
    const openAddProductButton = container.querySelector('#suppliers-open-add-product-button');
    const addProductDialog = container.querySelector('#suppliers-add-product-dialog');
    const addProductForm = container.querySelector('#suppliers-add-product-form');
    const addProductMessage = container.querySelector('#suppliers-add-product-message');
    const addProductSelect = container.querySelector('#suppliers-add-product-select');
    const addProductSearch = container.querySelector('#suppliers-add-product-search');
    const addProductSearchSummary = container.querySelector('#suppliers-add-product-search-summary');
    const closeAddProductButton = container.querySelector('#suppliers-close-add-product-button');
    const cancelAddProductButton = container.querySelector('#suppliers-add-product-cancel-button');
    const submitAddProductButton = container.querySelector('#suppliers-add-product-submit-button');

    if (!metricsRegion || !pageMessage || !listSummary || !listRegion || !searchInput || !refreshButton || !openCreateButton || !createDialog || !createForm || !createMessage || !dialogTitle || !closeCreateButton || !cancelCreateButton || !submitCreateButton || !nameInput || !detailDialog || !detailTitle || !detailSubtitle || !detailMessage || !detailInfo || !detailProducts || !editButton || !deleteButton || !closeDetailButton || !openAddProductButton || !addProductDialog || !addProductForm || !addProductMessage || !addProductSelect || !addProductSearch || !addProductSearchSummary || !closeAddProductButton || !cancelAddProductButton || !submitAddProductButton) {
      return;
    }

    let suppliers = [];
    let searchText = '';
    let currentSupplierId = null;
    let currentSupplierDetail = null;
    let editMode = false;
    let editSupplierId = null;
    let companyProducts = [];
    let productSearchText = '';

    function syncManageVisibility() {
      openCreateButton.hidden = !canManage;
      editButton.hidden = !canManage;
      deleteButton.hidden = !canManage;
      openAddProductButton.hidden = !canManage;
    }

    function renderCurrentState() {
      const visible = suppliersHelpers.filterSuppliers(suppliers, searchText);
      const metrics = suppliersHelpers.buildSupplierMetrics(suppliers);
      metricsRegion.innerHTML = suppliersRenderers.renderMetrics(metrics);

      if (!suppliers.length) {
        listSummary.textContent = 'No hay proveedores registrados para la empresa.';
        listRegion.innerHTML = suppliersRenderers.renderEmptyState(
          'No hay proveedores registrados',
          canManage ? 'Crea el primer proveedor de la empresa.' : 'No hay proveedores registrados para esta empresa.',
        );
        return;
      }

      if (!visible.length) {
        listSummary.textContent = `0 de ${suppliers.length} proveedores visibles con el filtro actual.`;
        listRegion.innerHTML = suppliersRenderers.renderEmptyState(
          'Sin resultados',
          'No hay proveedores que coincidan con la busqueda. Intenta con otro nombre.',
        );
        return;
      }

      listSummary.textContent = searchText
        ? `${visible.length} de ${suppliers.length} proveedores visibles.`
        : `${suppliers.length} proveedores registrados.`;
      listRegion.innerHTML = suppliersRenderers.renderSuppliersTable(visible);

      listRegion.querySelectorAll('[data-supplier-id]').forEach((row) => {
        row.addEventListener('click', () => openDetail(row.dataset.supplierId));
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(row.dataset.supplierId);
          }
        });
      });
    }

    async function loadSuppliers(statusMessage) {
      listRegion.innerHTML = '<p class="empty-state">Cargando proveedores...</p>';
      pageMessage.innerHTML = '';
      setShellStatus(statusMessage || 'Cargando proveedores...');
      try {
        const response = await suppliersApi.listCompanySuppliers(session);
        suppliers = Array.isArray(response) ? response : [];
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        suppliers = [];
        metricsRegion.innerHTML = suppliersRenderers.renderMetrics({ total: 0, withProducts: 0, withoutProducts: 0 });
        listSummary.textContent = 'No se pudieron cargar los proveedores.';
        listRegion.innerHTML = suppliersRenderers.renderEmptyState('Error al cargar', error.message || 'No se pudieron cargar los proveedores.');
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar los proveedores.', 'error');
        setShellStatus('Error al cargar proveedores.', 'error');
      }
    }

    function openCreateDialog() {
      if (!canManage) { return; }
      editMode = false;
      editSupplierId = null;
      dialogTitle.textContent = 'Nuevo proveedor';
      submitCreateButton.textContent = 'Guardar proveedor';
      createForm.reset();
      createMessage.innerHTML = '';
      createDialog.showModal();
      nameInput.focus();
    }

    function openEditDialog(supplier) {
      if (!canManage) { return; }
      editMode = true;
      editSupplierId = supplier.id;
      dialogTitle.textContent = 'Editar proveedor';
      submitCreateButton.textContent = 'Actualizar proveedor';
      createForm.reset();
      createMessage.innerHTML = '';
      nameInput.value = supplier.name || '';
      createForm.querySelector('[name="email"]').value = supplier.email || '';
      createForm.querySelector('[name="phone"]').value = supplier.phone || '';
      createForm.querySelector('[name="country"]').value = supplier.country || '';
      createForm.querySelector('[name="note"]').value = supplier.note || '';
      createDialog.showModal();
      nameInput.focus();
    }

    function closeCreateDialog() {
      createDialog.close();
      createForm.reset();
      createMessage.innerHTML = '';
      editMode = false;
      editSupplierId = null;
    }

    async function openDetail(supplierId) {
      currentSupplierId = supplierId;
      detailMessage.innerHTML = '';
      detailInfo.innerHTML = '<p class="muted">Cargando detalle...</p>';
      detailProducts.innerHTML = '';
      detailDialog.showModal();

      try {
        const detail = await suppliersApi.getCompanySupplier(session, supplierId);
        currentSupplierDetail = detail;
        detailTitle.textContent = detail.name || 'Proveedor';
        detailSubtitle.textContent = [detail.email, detail.phone, detail.country].filter(Boolean).join(' · ') || '';
        detailInfo.innerHTML = `
          <div class="card root-card">
            <p><strong>Email:</strong> ${rootShellUi.escapeHtml(detail.email || '—')}</p>
            <p><strong>Telefono:</strong> ${rootShellUi.escapeHtml(detail.phone || '—')}</p>
            <p><strong>Pais:</strong> ${rootShellUi.escapeHtml(detail.country || '—')}</p>
            ${detail.note ? `<p class="muted">${rootShellUi.escapeHtml(detail.note)}</p>` : ''}
          </div>
        `;
        detailProducts.innerHTML = suppliersRenderers.renderSupplierDetailProducts(detail.products, { canManage });
        attachRemoveProductHandlers();
      } catch (error) {
        detailInfo.innerHTML = '';
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el detalle.', 'error');
      }
    }

    function attachRemoveProductHandlers() {
      if (!canManage) { return; }
      detailProducts.querySelectorAll('.suppliers-remove-product-button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!globalScope.confirm('¿Remover este producto del proveedor?')) { return; }
          try {
            await suppliersApi.removeProductFromSupplier(session, currentSupplierId, btn.dataset.productId);
            await openDetail(currentSupplierId);
            await loadSuppliers('Actualizando proveedores...');
            detailMessage.innerHTML = rootShellUi.renderInlineMessage('Producto removido.');
          } catch (error) {
            detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo remover el producto.', 'error');
          }
        });
      });
    }

    function closeDetailDialog() {
      detailDialog.close();
      currentSupplierId = null;
      currentSupplierDetail = null;
    }

    function renderProductSelectState() {
      const assigned = currentSupplierDetail?.products || [];
      const allAvailable = suppliersHelpers.filterAvailableProducts(companyProducts, assigned, '');
      const filtered = suppliersHelpers.filterAvailableProducts(companyProducts, assigned, productSearchText);

      addProductSelect.innerHTML = suppliersRenderers.renderFilteredProductOptions(filtered, allAvailable.length);

      if (allAvailable.length === 0) {
        addProductSearchSummary.textContent = 'Todos los productos ya estan asignados';
        addProductSearch.disabled = true;
        submitAddProductButton.disabled = true;
      } else if (!filtered.length) {
        addProductSearchSummary.textContent = 'Sin resultados para el filtro actual';
        submitAddProductButton.disabled = true;
      } else if (productSearchText) {
        addProductSearchSummary.textContent = `${filtered.length} de ${allAvailable.length} productos disponibles`;
        submitAddProductButton.disabled = false;
      } else {
        addProductSearchSummary.textContent = `${allAvailable.length} productos disponibles`;
        submitAddProductButton.disabled = false;
      }
    }

    async function openAddProductDialog() {
      if (!canManage || !currentSupplierId) { return; }
      addProductForm.reset();
      addProductMessage.innerHTML = '';
      productSearchText = '';
      addProductSearch.value = '';
      addProductSearch.disabled = false;

      try {
        const response = await suppliersApi.listCompanyProducts(session);
        companyProducts = Array.isArray(response) ? response : (Array.isArray(response?.items) ? response.items : []);
        renderProductSelectState();
      } catch (_error) {
        addProductSelect.innerHTML = '<option value="">Error al cargar productos</option>';
        addProductSearchSummary.textContent = '';
        submitAddProductButton.disabled = true;
        addProductMessage.innerHTML = rootShellUi.renderInlineMessage('No se pudieron cargar los productos disponibles.', 'error');
      }

      addProductDialog.showModal();
    }

    function closeAddProductDialog() {
      addProductDialog.close();
      addProductForm.reset();
      addProductMessage.innerHTML = '';
    }

    syncManageVisibility();

    searchInput.addEventListener('input', () => {
      searchText = searchInput.value.trim();
      renderCurrentState();
    });

    refreshButton.addEventListener('click', () => loadSuppliers('Actualizando proveedores...'));
    openCreateButton.addEventListener('click', openCreateDialog);
    closeCreateButton.addEventListener('click', closeCreateDialog);
    cancelCreateButton.addEventListener('click', closeCreateDialog);

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      createMessage.innerHTML = '';
      if (!createForm.reportValidity()) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios.', 'error');
        return;
      }

      submitCreateButton.disabled = true;
      const formData = new globalScope.FormData(createForm);
      const payload = {
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim() || null,
        phone: String(formData.get('phone') || '').trim() || null,
        country: String(formData.get('country') || '').trim() || null,
        note: String(formData.get('note') || '').trim() || null,
      };

      try {
        if (editMode && editSupplierId) {
          await suppliersApi.updateCompanySupplier(session, editSupplierId, payload);
          closeCreateDialog();
          await loadSuppliers('Actualizando proveedores...');
          pageMessage.innerHTML = rootShellUi.renderInlineMessage('Proveedor actualizado correctamente.');
        } else {
          await suppliersApi.createCompanySupplier(session, payload);
          closeCreateDialog();
          await loadSuppliers('Actualizando proveedores...');
          pageMessage.innerHTML = rootShellUi.renderInlineMessage('Proveedor creado correctamente.');
        }
      } catch (error) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo guardar el proveedor.', 'error');
      } finally {
        submitCreateButton.disabled = false;
      }
    });

    closeDetailButton.addEventListener('click', closeDetailDialog);

    editButton.addEventListener('click', () => {
      if (!canManage || !currentSupplierDetail) { return; }
      const supplierToEdit = currentSupplierDetail;
      closeDetailDialog();
      openEditDialog(supplierToEdit);
    });

    deleteButton.addEventListener('click', async () => {
      if (!canManage || !currentSupplierId) { return; }
      if (!globalScope.confirm('¿Eliminar este proveedor? Esta accion no se puede deshacer.')) { return; }

      try {
        await suppliersApi.deleteCompanySupplier(session, currentSupplierId);
        closeDetailDialog();
        await loadSuppliers('Actualizando proveedores...');
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Proveedor eliminado.');
      } catch (error) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo eliminar el proveedor.', 'error');
      }
    });

    openAddProductButton.addEventListener('click', openAddProductDialog);
    closeAddProductButton.addEventListener('click', closeAddProductDialog);
    cancelAddProductButton.addEventListener('click', closeAddProductDialog);

    addProductSearch.addEventListener('input', () => {
      productSearchText = addProductSearch.value.trim();
      renderProductSelectState();
    });

    addProductForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      addProductMessage.innerHTML = '';

      const formData = new globalScope.FormData(addProductForm);
      const productId = String(formData.get('productId') || '').trim();
      if (!productId) {
        addProductMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona un producto.', 'error');
        return;
      }

      submitAddProductButton.disabled = true;
      const payload = {
        productId: Number(productId),
        isPreferred: formData.get('isPreferred') === 'on',
        supplierSku: String(formData.get('supplierSku') || '').trim() || null,
        unitPrice: formData.get('unitPrice') ? Number(formData.get('unitPrice')) : null,
        currency: String(formData.get('currency') || '').trim() || null,
        leadTimeDays: formData.get('leadTimeDays') ? Number(formData.get('leadTimeDays')) : null,
        minimumOrderQuantity: formData.get('minimumOrderQuantity') ? Number(formData.get('minimumOrderQuantity')) : null,
        notes: String(formData.get('notes') || '').trim() || null,
      };

      try {
        await suppliersApi.addProductToSupplier(session, currentSupplierId, payload);
        closeAddProductDialog();
        await openDetail(currentSupplierId);
        await loadSuppliers('Actualizando proveedores...');
        detailMessage.innerHTML = rootShellUi.renderInlineMessage('Producto asignado correctamente.');
      } catch (error) {
        addProductMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo asignar el producto.', 'error');
      } finally {
        submitAddProductButton.disabled = false;
      }
    });

    await loadSuppliers();
  }

  rootShell.register('views.suppliersAdmin', {
    mount,
    render,
  });
}(window));
