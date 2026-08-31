(function attachRootShellClientsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const clientsApi = rootShell.require('clientsApi');
  const rootShellUi = rootShell.require('ui');
  const clientsHelpers = rootShell.require('views.clientsAdminHelpers');
  const clientsRenderers = rootShell.require('views.clientsAdminRenderers');
  const clientsState = rootShell.require('views.clientsAdminState');
  const clientsAdminStoreDialog = rootShell.require('views.clientsAdminStoreDialog');

  function render(session) {
    const companyId = rootShellUi.escapeHtml(session?.user?.companyId || 'sin empresa');
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Clientes</h2>
        <p class="muted">Consulta, crea y actualiza clientes de la empresa ${companyId} sin salir del AppShell.</p>
      </section>

      <section class="commercial-page" id="clients-page">
        <div class="commercial-metrics">
          <article class="card root-card metric-card"><p class="muted">Clientes visibles</p><strong id="clients-metric-total">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Activos</p><strong id="clients-metric-active">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Con tiendas</p><strong id="clients-metric-stores">-</strong></article>
          <article class="card root-card metric-card"><p class="muted">Con documentos</p><strong id="clients-metric-documents">-</strong></article>
        </div>

        <div id="clients-page-message"></div>

        <div class="commercial-layout commercial-layout--clients" id="clients-layout">
          <article class="card root-card commercial-list-card">
            <div class="page-header">
              <div>
                <h3>Base de clientes</h3>
                <p id="clients-list-summary" class="muted">Busca, filtra y abre el detalle desde este mismo espacio.</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="clients-refresh-button" class="secondary-button" type="button">Actualizar</button>
                <button id="clients-open-create-button" type="button">Nuevo cliente</button>
              </div>
            </div>

            <div class="root-form-grid root-form-grid--filters">
              <label>
                <span>Buscar</span>
                <input id="clients-search-input" type="search" placeholder="Nombre, codigo, identificacion o telefono" />
              </label>
              <label>
                <span>Clasificacion</span>
                <select id="clients-classification-filter"><option value="all">Todas</option></select>
              </label>
              <label>
                <span>Estado</span>
                <select id="clients-status-filter">
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </label>
            </div>

            <div id="clients-list-region" class="commercial-list" aria-live="polite"></div>
          </article>

          <article class="card root-card commercial-detail-card">
            <div class="page-header">
              <div>
                <h3 id="clients-detail-title">Selecciona un cliente</h3>
                <p class="muted">El detalle del cliente aparece solo despues de seleccionar un registro.</p>
              </div>
            </div>
            <div id="clients-detail-message"></div>
            <div id="clients-detail-region" class="commercial-detail" aria-live="polite"></div>
          </article>
        </div>
      </section>

      <dialog id="clients-create-dialog" class="modal-card">
        <form id="clients-create-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Nuevo cliente</h3>
              <p class="muted">Crea el cliente y completa los datos generales y fiscales principales.</p>
            </div>
            <button id="clients-close-create-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="clients-create-message"></div>
          <fieldset class="root-form__section">
            <legend>Datos principales</legend>
            <div class="root-form-grid">
              <label class="root-form-grid__full"><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Codigo</span><input name="code" type="text" maxlength="50" /></label>
              <label><span>Clasificacion</span><select id="clients-create-classification" name="clientClassificationId"></select></label>
              <label><span>Identificacion</span><input name="legalId" type="text" maxlength="100" /></label>
              <label><span>Tipo de documento</span><input name="documentType" type="text" maxlength="50" /></label>
              <label><span>Telefono</span><input name="phone" type="text" maxlength="50" /></label>
              <label><span>Correo facturacion</span><input name="emailBilling" type="email" maxlength="255" /></label>
              <label><span>Tipo de pago</span><select name="paymentType"><option value="">Selecciona</option><option value="CASH">Contado</option><option value="CREDIT">Credito</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option></select></label>
              <label><span>Dias de pago</span><input name="paymentDays" type="number" min="0" /></label>
              
              <label class="root-form-grid__full"><span>Direccion</span><textarea name="address" rows="3" maxlength="1000"></textarea></label>
            </div>
          </fieldset>
          <div class="action-row">
            <button id="clients-create-submit-button" type="submit">Crear cliente</button>
            <button id="clients-create-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#clients-page-message'));
    const detailMessage = /** @type {HTMLElement | null} */ (container.querySelector('#clients-detail-message'));
    const listSummary = /** @type {HTMLElement | null} */ (container.querySelector('#clients-list-summary'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#clients-list-region'));
    const detailRegion = /** @type {HTMLElement | null} */ (container.querySelector('#clients-detail-region'));
    const detailTitle = /** @type {HTMLElement | null} */ (container.querySelector('#clients-detail-title'));
    const searchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#clients-search-input'));
    const classificationFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#clients-classification-filter'));
    const statusFilter = /** @type {HTMLSelectElement | null} */ (container.querySelector('#clients-status-filter'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#clients-refresh-button'));
    const openCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#clients-open-create-button'));
    const dialog = /** @type {HTMLDialogElement | null} */ (container.querySelector('#clients-create-dialog'));
    const createForm = /** @type {HTMLFormElement | null} */ (container.querySelector('#clients-create-form'));
    const createMessage = /** @type {HTMLElement | null} */ (container.querySelector('#clients-create-message'));
    const createClassification = /** @type {HTMLSelectElement | null} */ (container.querySelector('#clients-create-classification'));
    const createSubmitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#clients-create-submit-button'));
    const closeCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#clients-close-create-button'));
    const cancelCreateButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#clients-create-cancel-button'));
    const metricTotal = /** @type {HTMLElement | null} */ (container.querySelector('#clients-metric-total'));
    const metricActive = /** @type {HTMLElement | null} */ (container.querySelector('#clients-metric-active'));
    const metricStores = /** @type {HTMLElement | null} */ (container.querySelector('#clients-metric-stores'));
    const metricDocuments = /** @type {HTMLElement | null} */ (container.querySelector('#clients-metric-documents'));

    if (!pageMessage || !detailMessage || !listSummary || !listRegion || !detailRegion || !detailTitle || !searchInput || !classificationFilter || !statusFilter || !refreshButton || !openCreateButton || !dialog || !createForm || !createMessage || !createClassification || !createSubmitButton || !closeCreateButton || !cancelCreateButton || !metricTotal || !metricActive || !metricStores || !metricDocuments) {
      return;
    }

    const canDeactivate = session?.user?.role?.code === 'admin';
    let clients = [];
    let classifications = [];
    let documentTypes = [];
    let zoneOptions = [];
    let selectedClientId = null;
    let clientDetailsById = {};

    function renderMetrics(clientsList) {
      const summary = clientsHelpers.summarizeClients(clientsList);
      metricTotal.textContent = String(summary.total);
      metricActive.textContent = String(summary.active);
      metricStores.textContent = String(summary.withStores);
      metricDocuments.textContent = String(summary.withDocuments);
    }

    function renderClassificationOptions() {
      const optionsMarkup = ['<option value="all">Todas</option>']
        .concat(classifications.map((classification) => `<option value="${rootShellUi.escapeHtml(classification.id)}">${rootShellUi.escapeHtml(classification.name)}</option>`))
        .join('');
      classificationFilter.innerHTML = optionsMarkup;
      createClassification.innerHTML = ['<option value="">Sin clasificacion</option>']
        .concat(classifications.map((classification) => `<option value="${rootShellUi.escapeHtml(classification.id)}">${rootShellUi.escapeHtml(classification.name)}</option>`))
        .join('');
    }

    function getFilteredClients() {
      return clientsHelpers.filterClients(clients, searchInput.value, classificationFilter.value, statusFilter.value);
    }

    function getSelectedClient() {
      return clientsState.getSelectedClient(clients, clientDetailsById, selectedClientId);
    }

    function renderCurrentState() {
      const filteredClients = getFilteredClients();
      if (!selectedClientId && filteredClients[0]) {
        selectedClientId = filteredClients[0].id;
      }
      const selectedClient = getSelectedClient();
      renderMetrics(clients);
      renderClassificationOptions();
      listSummary.textContent = clientsState.buildClientsListSummary(clients.length, filteredClients.length);
      listRegion.innerHTML = clientsRenderers.renderClientList(filteredClients, selectedClientId);
      detailTitle.textContent = selectedClient ? selectedClient.name || 'Detalle de cliente' : 'Selecciona un cliente';
      detailRegion.innerHTML = clientsRenderers.renderClientDetail(selectedClient, classifications, documentTypes, zoneOptions, canDeactivate);
    }

    async function loadClients() {
      setShellStatus('Cargando clientes...');
      listRegion.innerHTML = '<p class="empty-state">Cargando clientes...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Carga el detalle contextual desde el listado.</p>';
      pageMessage.innerHTML = '';
      detailMessage.innerHTML = '';

      try {
        const [clientsResponse, classificationsResponse, documentTypesResponse, zonesResponse] = await Promise.all([
          clientsApi.listClients(session),
          clientsApi.listClassifications(session),
          clientsApi.listDocumentTypes(session),
          clientsApi.listZones(session),
        ]);
        clients = Array.isArray(clientsResponse?.items) ? clientsResponse.items : Array.isArray(clientsResponse) ? clientsResponse : [];
        classifications = Array.isArray(classificationsResponse) ? classificationsResponse : [];
        documentTypes = Array.isArray(documentTypesResponse) ? documentTypesResponse : [];
        zoneOptions = clientsState.flattenZoneOptions(zonesResponse);
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar los clientes.</p>';
        detailRegion.innerHTML = '<p class="empty-state">No se pudo abrir la vista de clientes.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar los clientes.', 'error');
        setShellStatus('No se pudo cargar la vista de clientes.', 'error');
      }
    }

    async function loadClientDetail(clientId) {
      setShellStatus('Cargando detalle del cliente...');
      detailMessage.innerHTML = '';
      try {
        const detail = await clientsApi.getClientDetail(session, clientId);
        clientDetailsById[String(clientId)] = detail;
        selectedClientId = clientId;
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el detalle del cliente.', 'error');
        setShellStatus('No se pudo cargar el detalle del cliente.', 'error');
      }
    }

    searchInput.addEventListener('input', renderCurrentState);
    classificationFilter.addEventListener('change', renderCurrentState);
    statusFilter.addEventListener('change', renderCurrentState);
    refreshButton.addEventListener('click', loadClients);

    listRegion.addEventListener('click', async (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target.closest('[data-client-select]') : null;
      if (!(target instanceof globalScope.HTMLElement)) {
        return;
      }
      await loadClientDetail(target.getAttribute('data-client-select'));
    });

    function closeDialog() {
      dialog.close();
      createForm.reset();
      createMessage.innerHTML = '';
    }

    openCreateButton.addEventListener('click', () => dialog.showModal());
    closeCreateButton.addEventListener('click', closeDialog);
    cancelCreateButton.addEventListener('click', closeDialog);

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      createMessage.innerHTML = '';
      if (!createForm.reportValidity()) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }
      const payload = clientsHelpers.buildClientPayload(new FormData(createForm));
      createSubmitButton.disabled = true;
      createSubmitButton.textContent = 'Creando...';
      setShellStatus('Creando cliente...');
      try {
        const createdClient = await clientsApi.createClient(session, payload);
        closeDialog();
        await loadClients();
        selectedClientId = createdClient.id;
        await loadClientDetail(createdClient.id);
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Cliente creado correctamente.');
        setShellStatus('Cliente creado correctamente.');
      } catch (error) {
        createMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear el cliente.', 'error');
        setShellStatus('No se pudo crear el cliente.', 'error');
      } finally {
        createSubmitButton.disabled = false;
        createSubmitButton.textContent = 'Crear cliente';
      }
    });

    detailRegion.addEventListener('click', async (event) => {
      const target = event.target instanceof globalScope.HTMLElement ? event.target : null;
      if (!target) {
        return;
      }

      // Botón [+ Agregar tienda] — abre el dialog con mapa Leaflet
      if (target.id === 'clients-add-store-button') {
        const btnClientId = target.getAttribute('data-client-id') || String(selectedClientId || '');
        const btnClientName = target.getAttribute('data-client-name') || '';
        clientsAdminStoreDialog.open(
          btnClientId,
          btnClientName,
          session,
          zoneOptions,
          async (createdStore) => {
            // Actualizar la lista de tiendas en el detalle sin recargar todo
            const storesList = detailRegion.querySelector('#clients-stores-list');
            if (storesList && createdStore) {
              const ui = rootShellUi;
              const newCard = `
                <article class="inline-card">
                  <strong>${ui.escapeHtml(createdStore.name || 'Tienda')}</strong>
                  <p class="muted">${ui.escapeHtml(createdStore.code || 'Sin codigo')} · ${ui.escapeHtml(createdStore.subregion?.name || createdStore.subregionName || 'Sin subzona')}</p>
                  ${createdStore.latitude && createdStore.longitude ? `<p class="muted" style="font-size:0.78rem;">📍 ${ui.escapeHtml(String(createdStore.latitude))}, ${ui.escapeHtml(String(createdStore.longitude))}</p>` : '<p class="muted" style="font-size:0.78rem;">Sin coordenadas</p>'}
                </article>`;
              const emptyState = storesList.querySelector('.empty-state');
              if (emptyState) {
                storesList.innerHTML = newCard;
              } else {
                storesList.insertAdjacentHTML('afterbegin', newCard);
              }
            }
            setShellStatus('Tienda creada correctamente.');
            // Recargar el detalle completo para sincronizar el estado
            await loadClientDetail(selectedClientId);
            detailMessage.innerHTML = rootShellUi.renderInlineMessage('Tienda creada correctamente.');
          },
        );
        return;
      }

      if (target.matches('[data-document-download]')) {
        const client = getSelectedClient();
        if (!client) {
          return;
        }
        try {
          setShellStatus('Descargando documento...');
          await clientsApi.downloadDocument(session, client.id, target.getAttribute('data-document-download'));
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Descarga autenticada solicitada correctamente.');
          setShellStatus('Descarga autenticada completada.');
        } catch (error) {
          detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo descargar el documento.', 'error');
          setShellStatus('No se pudo descargar el documento.', 'error');
        }
      }

      if (target.id === 'clients-lookup-taxpayer-button') {
        const client = getSelectedClient();
        if (!client) {
          return;
        }
        const legalIdInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="legalId"]'));
        const economicActivityCodeInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="economicActivityCode"]'));
        const economicActivityNameInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="economicActivityName"]'));
        const legalId = legalIdInput?.value?.trim();
        if (!legalId) {
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Ingresa una identificacion antes de consultar.', 'warning');
          return;
        }
        try {
          const taxpayer = await clientsApi.lookupTaxpayer(session, legalId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Consulta completada. Verifica los datos antes de guardar.');
          const clientNameInput = /** @type {HTMLInputElement | null} */ (
            detailRegion.querySelector('input[name="legalName"]')
            || detailRegion.querySelector('input[name="name"]')
          );
          if (clientNameInput && taxpayer?.name) {
            clientNameInput.value = taxpayer.name;
          }
          if (economicActivityCodeInput && taxpayer?.economicActivityCode) {
            economicActivityCodeInput.value = taxpayer.economicActivityCode;
          }
          if (economicActivityNameInput && taxpayer?.economicActivityName) {
            economicActivityNameInput.value = taxpayer.economicActivityName;
          }
        } catch (error) {
          detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo consultar la identificacion.', 'warning');
        }
      }

      if (target.id === 'clients-deactivate-button') {
        const client = getSelectedClient();
        if (!client) {
          return;
        }
        try {
          setShellStatus('Desactivando cliente...');
          await clientsApi.deactivateClient(session, client.id);
          delete clientDetailsById[String(client.id)];
          await loadClients();
          detailRegion.innerHTML = '<p class="empty-state">Cliente desactivado correctamente. Selecciona otro cliente.</p>';
          detailTitle.textContent = 'Selecciona un cliente';
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Cliente desactivado correctamente.');
          setShellStatus('Cliente desactivado correctamente.');
        } catch (error) {
          detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo desactivar el cliente.', 'error');
          setShellStatus('No se pudo desactivar el cliente.', 'error');
        }
      }
    });

    detailRegion.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof globalScope.HTMLFormElement)) {
        return;
      }
      event.preventDefault();
      const formData = new FormData(form);
      const clientId = String(formData.get('clientId') || selectedClientId || '');
      try {
        if (form.id === 'clients-update-form') {
          await clientsApi.updateClient(session, clientId, clientsHelpers.buildClientPayload(formData));
          await loadClients();
          await loadClientDetail(clientId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Cliente actualizado correctamente.');
          setShellStatus('Cliente actualizado correctamente.');
          return;
        }

        if (form.classList.contains('clients-store-credit-form')) {
          const storeId = form.getAttribute('data-store-id') || '';
          const creditLimit = parseFloat(String(formData.get('creditLimit') || '0'));
          const msgEl = form.querySelector('.clients-store-credit-msg');
          try {
            await clientsApi.updateStoreCreditLimit(session, clientId, storeId, { creditLimit });
            if (msgEl) { msgEl.textContent = '✓ Guardado'; }
          } catch (err) {
            if (msgEl) { msgEl.textContent = err.message || 'Error'; }
          }
          return;
        }

        if (form.id === 'clients-document-form') {
          await clientsApi.uploadDocument(session, clientId, clientsHelpers.buildDocumentPayload(formData));
          await loadClientDetail(clientId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Documento cargado correctamente.');
          setShellStatus('Documento cargado correctamente.');
          form.reset();
          return;
        }

        if (form.id === 'clients-reference-form') {
          await clientsApi.createReference(session, clientId, clientsHelpers.buildReferencePayload(formData));
          await loadClientDetail(clientId);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Referencia creada correctamente.');
          setShellStatus('Referencia creada correctamente.');
          form.reset();
        }
      } catch (error) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo completar la accion solicitada.', 'error');
        setShellStatus('No se pudo completar la accion solicitada.', 'error');
      }
    });

    await loadClients();
  }

  rootShell.register('views.clientsAdmin', {
    mount,
    render,
  });
}(window));
