(function attachRootShellClientsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const clientsApi = rootShell.require('clientsApi');
  const rootShellUi = rootShell.require('ui');
  const clientsHelpers = rootShell.require('views.clientsAdminHelpers');
  const clientsRenderers = rootShell.require('views.clientsAdminRenderers');
  const clientsState = rootShell.require('views.clientsAdminState');
  const clientsAdminStoreDialog = rootShell.require('views.clientsAdminStoreDialog');
  const feedbackWidget = rootShell.has('feedbackWidget') ? rootShell.require('feedbackWidget') : null;

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
              <label>
                <span>Tipo de identificación</span>
                <select name="documentType">
                  <option value="">Selecciona</option>
                  <option value="01">01 — Cédula Física</option>
                  <option value="02">02 — Cédula Jurídica</option>
                  <option value="03">03 — DIMEX</option>
                  <option value="04">04 — NITE</option>
                </select>
              </label>
              <label><span>Telefono</span><input name="phone" type="text" maxlength="50" /></label>
              <label><span>Correo electrónico para facturas (PDF y XML)</span><input name="emailBilling" type="email" maxlength="255" /></label>
              <label><span>Tipo de pago</span><select name="paymentType"><option value="">Selecciona</option><option value="CASH">Contado</option><option value="CREDIT">Credito</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option></select></label>
              <label><span>Dias de pago</span><input name="paymentDays" type="number" min="0" /></label>
              <label class="root-form-grid__full">
                <span>Actividad económica</span>
                <select id="clients-create-economic-activity" name="economicActivityCode">
                  <option value="">Selecciona actividad económica</option>
                </select>
                <input type="hidden" id="clients-create-economic-activity-name" name="economicActivityName" />
              </label>
              <label class="root-form-grid__full"><span>Direccion</span><textarea name="address" rows="3" maxlength="1000"></textarea></label>
            </div>
          </fieldset>
          <div class="action-row">
            <button id="clients-create-submit-button" type="submit">Crear cliente</button>
            <button id="clients-create-lookup-button" class="secondary-button" type="button" hidden>Consultar Hacienda</button>
            <button id="clients-create-cancel-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function resolveDocumentDownloadFileName(rawContentDisposition, documentId) {
    const fallbackFileName = `documento-${String(documentId || 'cliente')}`;
    const headerValue = String(rawContentDisposition || '').trim();
    if (!headerValue) {
      return fallbackFileName;
    }

    const encodedFileNameMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedFileNameMatch && encodedFileNameMatch[1]) {
      try {
        return decodeURIComponent(encodedFileNameMatch[1]).trim() || fallbackFileName;
      } catch (_error) {
        return encodedFileNameMatch[1].trim() || fallbackFileName;
      }
    }

    const plainFileNameMatch = headerValue.match(/filename="?([^";]+)"?/i);
    if (plainFileNameMatch && plainFileNameMatch[1]) {
      return plainFileNameMatch[1].trim() || fallbackFileName;
    }

    return fallbackFileName;
  }

  function triggerNativeDocumentDownload(globalDocument, fileBlob, fileName) {
    const objectUrl = globalScope.URL.createObjectURL(fileBlob);
    const downloadLink = globalDocument.createElement('a');
    downloadLink.href = objectUrl;
    downloadLink.download = fileName;
    downloadLink.style.display = 'none';
    globalDocument.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    globalScope.setTimeout(() => {
      globalScope.URL.revokeObjectURL(objectUrl);
    }, 0);
  }

  const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_DOCUMENT_FILE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx']);
  const ALLOWED_DOCUMENT_FILE_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);
  const DOCUMENT_FILE_MIME_BY_EXTENSION = Object.freeze({
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new globalScope.FileReader();
      reader.onload = () => {
        const result = /** @type {string} */ (reader.result || '');
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo. Intenta seleccionarlo nuevamente.'));
      reader.readAsDataURL(file);
    });
  }

  function getDocumentFileExtension(fileName) {
    const normalizedFileName = String(fileName || '').trim().toLowerCase();
    const lastDotIndex = normalizedFileName.lastIndexOf('.');
    if (lastDotIndex < 0) {
      return '';
    }
    return normalizedFileName.slice(lastDotIndex + 1);
  }

  function isAllowedDocumentFile(file) {
    const extension = getDocumentFileExtension(file?.name);
    const mimeType = String(file?.type || '').trim().toLowerCase();
    return ALLOWED_DOCUMENT_FILE_EXTENSIONS.has(extension) || ALLOWED_DOCUMENT_FILE_MIME_TYPES.has(mimeType);
  }

  function resolveDocumentUploadMimeType(file) {
    const explicitMimeType = String(file?.type || '').trim().toLowerCase();
    if (explicitMimeType) {
      return explicitMimeType;
    }
    return DOCUMENT_FILE_MIME_BY_EXTENSION[getDocumentFileExtension(file?.name)] || 'application/octet-stream';
  }

  function formatDocumentFileSize(fileSizeInBytes) {
    const sizeInMegabytes = Number(fileSizeInBytes || 0) / (1024 * 1024);
    return `${sizeInMegabytes.toFixed(1)} MB`;
  }

  // Mínimo de dígitos para considerar una cédula consultable
  const MIN_CEDULA_LENGTH = 9;

  function isCedulaLongEnough(value) {
    return String(value || '').trim().length >= MIN_CEDULA_LENGTH;
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
    const canLookupTaxpayer = Boolean((session?.user?.permissions || []).includes('integration.taxpayer.lookup'));

    // Reveal Consultar button in create form when user has taxpayer-lookup permission
    const createLookupButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#clients-create-lookup-button'));
    /** @type {boolean} Evita re-consultar si ya hubo un resultado exitoso para el valor actual */
    let createLookupDone = false;
    if (createLookupButton && canLookupTaxpayer) {
      createLookupButton.hidden = false;
      createLookupButton.disabled = true; // se habilita cuando la cédula alcanza la longitud mínima
    }

    // Wire economic activity select in creation form -> update hidden economicActivityName (AC-023, AC-025)
    const createEaSelectEl = /** @type {HTMLSelectElement | null} */ (container.querySelector('#clients-create-economic-activity'));
    const createEaNameInputEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#clients-create-economic-activity-name'));
    if (createEaSelectEl && createEaNameInputEl) {
      createEaSelectEl.addEventListener('change', () => {
        const selectedOpt = createEaSelectEl.options[createEaSelectEl.selectedIndex];
        createEaNameInputEl.value = selectedOpt ? selectedOpt.text.replace(/^[^ ]+ \u2014 /, '') : '';
      });
    }

    let clients = [];
    let classifications = [];
    let documentTypes = [];
    let zoneOptions = [];
    let economicActivities = [];
    let selectedClientId = null;
    let clientDetailsById = {};
    let isDocumentFileProcessing = false;
    /** @type {boolean} Flag para el form de edición — evita re-consultar tras éxito */
    let editLookupDone = false;

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
      detailRegion.innerHTML = clientsRenderers.renderClientDetail(selectedClient, classifications, documentTypes, zoneOptions, canDeactivate, economicActivities);
    }

    async function loadClients() {
      setShellStatus('Cargando clientes...');
      listRegion.innerHTML = '<p class="empty-state">Cargando clientes...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Carga el detalle contextual desde el listado.</p>';
      pageMessage.innerHTML = '';
      detailMessage.innerHTML = '';

      try {
        const [clientsResponse, classificationsResponse, documentTypesResponse, zonesResponse, economicActivitiesResponse] = await Promise.all([
          clientsApi.listClients(session),
          clientsApi.listClassifications(session),
          clientsApi.listDocumentTypes(session),
          clientsApi.listZones(session),
          clientsApi.listEconomicActivities(session).catch(() => []),
        ]);
        clients = Array.isArray(clientsResponse?.items) ? clientsResponse.items : Array.isArray(clientsResponse) ? clientsResponse : [];
        classifications = Array.isArray(classificationsResponse) ? classificationsResponse : [];
        documentTypes = Array.isArray(documentTypesResponse) ? documentTypesResponse : [];
        zoneOptions = clientsState.flattenZoneOptions(zonesResponse);
        economicActivities = Array.isArray(economicActivitiesResponse) ? economicActivitiesResponse : [];

        // Populate economic activity select in create dialog (AC-025)
        const createEaSelect = /** @type {HTMLSelectElement | null} */ (container.querySelector('#clients-create-economic-activity'));
        if (createEaSelect) {
          const activityOptions = economicActivities
            .map((a) => `<option value="${rootShellUi.escapeHtml(a.code || a.value || '')}">${rootShellUi.escapeHtml(a.code || a.value || '')} — ${rootShellUi.escapeHtml(a.name || a.label || '')}</option>`)
            .join('');
          createEaSelect.innerHTML = `<option value="">Selecciona actividad económica</option>${activityOptions}`;
        }
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
      editLookupDone = false; // resetear al cargar otro cliente
      try {
        const detail = await clientsApi.getClientDetail(session, clientId);
        clientDetailsById[String(clientId)] = detail;
        selectedClientId = clientId;
        renderCurrentState();
        // Configurar estado inicial del botón de consulta en el form de edición
        if (canLookupTaxpayer) {
          const editLookupBtn = /** @type {HTMLButtonElement | null} */ (detailRegion.querySelector('#clients-lookup-taxpayer-button'));
          const editLegalIdInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="legalId"]'));
          if (editLookupBtn && editLegalIdInput) {
            editLookupBtn.disabled = !isCedulaLongEnough(editLegalIdInput.value);
          }
        }
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
      createLookupDone = false;
      if (createLookupButton) createLookupButton.disabled = true;
    }

    openCreateButton.addEventListener('click', () => dialog.showModal());
    closeCreateButton.addEventListener('click', closeDialog);
    cancelCreateButton.addEventListener('click', closeDialog);

    // Hacienda lookup in client creation dialog — blur automático + botón explícito (FR-026, AC-018)
    const createLegalIdInput = /** @type {HTMLInputElement | null} */ (createForm.querySelector('input[name="legalId"]'));

    let isCreateLookupInProgress = false;

    async function triggerCreateLookup() {
      if (!createLookupButton || isCreateLookupInProgress) return;
      const legalId = createLegalIdInput?.value?.trim();
      if (!isCedulaLongEnough(legalId) || createLookupDone) return;
      isCreateLookupInProgress = true;
      createLookupButton.disabled = true;
      createLookupButton.textContent = 'Consultando...';
      createMessage.innerHTML = '';
      try {
        const taxpayer = await clientsApi.lookupTaxpayer(session, legalId);
        const nameInput = /** @type {HTMLInputElement | null} */ (createForm.querySelector('input[name="name"]'));
        const legalNameInput = /** @type {HTMLInputElement | null} */ (createForm.querySelector('input[name="legalName"]'));
        const emailInput = /** @type {HTMLInputElement | null} */ (createForm.querySelector('input[name="emailBilling"]'));
        const phoneInput = /** @type {HTMLInputElement | null} */ (createForm.querySelector('input[name="phone"]'));
        if (nameInput && taxpayer?.name) nameInput.value = taxpayer.name;
        if (legalNameInput && taxpayer?.name) legalNameInput.value = taxpayer.name;
        if (emailInput && taxpayer?.email && !emailInput.value) emailInput.value = taxpayer.email;
        if (phoneInput && taxpayer?.phone && !phoneInput.value) phoneInput.value = taxpayer.phone;
        // Auto-select actividad económica (AC-024)
        if (taxpayer?.economicActivityCode && createEaSelectEl && createEaNameInputEl) {
          const code = taxpayer.economicActivityCode;
          if (!Array.from(createEaSelectEl.options).some((opt) => opt.value === code)) {
            const newOpt = document.createElement('option');
            newOpt.value = code;
            newOpt.text = `${code} — ${taxpayer.economicActivityName || code}`;
            createEaSelectEl.appendChild(newOpt);
          }
          createEaSelectEl.value = code;
          createEaNameInputEl.value = taxpayer.economicActivityName || code;
        }
        createLookupDone = true;
        createMessage.innerHTML = rootShellUi.renderInlineMessage('Datos de Hacienda cargados. Verifica antes de guardar.');
      } catch (error) {
        const status = error?.statusCode;
        const msg = status === 404
          ? 'No se encontró la identificación en Hacienda.'
          : status === 429
            ? 'Consultas temporalmente limitadas. Intenta de nuevo.'
            : 'Hacienda no disponible.';
        createMessage.innerHTML = rootShellUi.renderInlineMessage(msg, 'warning');
      } finally {
        isCreateLookupInProgress = false;
        createLookupButton.textContent = 'Consultar Hacienda';
        // Queda deshabilitado si la consulta fue exitosa; si hubo error se re-habilita
        createLookupButton.disabled = createLookupDone || !isCedulaLongEnough(createLegalIdInput?.value);
      }
    }

    if (createLookupButton && canLookupTaxpayer && createLegalIdInput) {
      // Re-habilitar al editar la cédula (el usuario puede corregirla y reintentar)
      createLegalIdInput.addEventListener('input', () => {
        createLookupDone = false;
        createLookupButton.disabled = !isCedulaLongEnough(createLegalIdInput.value);
      });
      // Consultar automáticamente al terminar la edición del campo si la longitud es suficiente.
      // change/focusout cubren navegadores donde blur en <dialog> no se observa de forma consistente.
      createLegalIdInput.addEventListener('change', () => triggerCreateLookup());
      createLegalIdInput.addEventListener('focusout', () => triggerCreateLookup());
      createLegalIdInput.addEventListener('blur', () => triggerCreateLookup());
      createLegalIdInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        triggerCreateLookup();
      });
      createLookupButton.addEventListener('click', triggerCreateLookup);
    }

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
        if (feedbackWidget) feedbackWidget.triggerNudge('cliente', session);
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
          async () => {
            const zonesResponse = await clientsApi.listZones(session);
            zoneOptions = clientsState.flattenZoneOptions(zonesResponse);
            return zoneOptions;
          },
          getSelectedClient(),
          documentTypes,
          canLookupTaxpayer,
        );
        return;
      }

      const downloadButton = target.closest('[data-document-download]');
      if (downloadButton instanceof globalScope.HTMLButtonElement) {
        const client = getSelectedClient();
        if (!client) {
          return;
        }

        const documentId = downloadButton.getAttribute('data-document-download') || '';
        const originalButtonLabel = downloadButton.textContent || 'Descargar';
        downloadButton.disabled = true;
        downloadButton.textContent = 'Descargando...';

        try {
          setShellStatus('Descargando documento...');
          const { blob, fileName } = await clientsApi.downloadDocument(session, client.id, documentId);
          const resolvedFileName = resolveDocumentDownloadFileName(fileName, documentId);
          triggerNativeDocumentDownload(globalScope.document, blob, resolvedFileName);
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Descarga iniciada en el navegador.');
          setShellStatus('Descarga iniciada en el navegador.');
        } catch (error) {
          detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo descargar el documento. Intenta nuevamente.', 'error');
          setShellStatus('No se pudo descargar el documento.', 'error');
        } finally {
          downloadButton.disabled = false;
          downloadButton.textContent = originalButtonLabel;
        }
        return;
      }

      if (target.id === 'clients-lookup-taxpayer-button') {
        const editLookupBtn = /** @type {HTMLButtonElement} */ (target);
        const editLegalIdInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="legalId"]'));
        const legalId = editLegalIdInput?.value?.trim();
        if (!isCedulaLongEnough(legalId) || editLookupDone) return;
        editLookupBtn.disabled = true;
        editLookupBtn.textContent = 'Consultando...';
        detailMessage.innerHTML = '';
        try {
          const taxpayer = await clientsApi.lookupTaxpayer(session, legalId);
          const legalNameInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="legalName"]'));
          const nameInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="name"]'));
          const emailInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="emailBilling"]'));
          const phoneInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('input[name="phone"]'));
          if (legalNameInput && taxpayer?.name) legalNameInput.value = taxpayer.name;
          if (nameInput && taxpayer?.name && !nameInput.value) nameInput.value = taxpayer.name;
          if (emailInput && taxpayer?.email && !emailInput.value) emailInput.value = taxpayer.email;
          if (phoneInput && taxpayer?.phone && !phoneInput.value) phoneInput.value = taxpayer.phone;
          // Auto-select actividad económica en form de edición (AC-024)
          const editEaSelect = /** @type {HTMLSelectElement | null} */ (detailRegion.querySelector('#clients-edit-economic-activity'));
          const editEaNameInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('#clients-edit-economic-activity-name'));
          if (taxpayer?.economicActivityCode && editEaSelect && editEaNameInput) {
            const code = taxpayer.economicActivityCode;
            if (!Array.from(editEaSelect.options).some((opt) => opt.value === code)) {
              const newOpt = document.createElement('option');
              newOpt.value = code;
              newOpt.text = `${code} — ${taxpayer.economicActivityName || code}`;
              editEaSelect.appendChild(newOpt);
            }
            editEaSelect.value = code;
            editEaNameInput.value = taxpayer.economicActivityName || code;
          }
          editLookupDone = true;
          detailMessage.innerHTML = rootShellUi.renderInlineMessage('Datos de Hacienda cargados. Verifica antes de guardar.');
        } catch (error) {
          const status = error?.statusCode;
          const msg = status === 404
            ? 'No se encontró la identificación en Hacienda.'
            : status === 429
              ? 'Consultas temporalmente limitadas. Intenta de nuevo.'
              : 'Hacienda no disponible.';
          detailMessage.innerHTML = rootShellUi.renderInlineMessage(msg, 'warning');
        } finally {
          editLookupBtn.textContent = 'Consultar Hacienda';
          editLookupBtn.disabled = editLookupDone || !isCedulaLongEnough(editLegalIdInput?.value);
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

    detailRegion.addEventListener('change', async (event) => {
      const target = event.target;

      // Wire economic activity select in edit form -> update hidden economicActivityName (AC-023, AC-024)
      if (target instanceof globalScope.HTMLSelectElement && target.id === 'clients-edit-economic-activity') {
        const eaNameInput = /** @type {HTMLInputElement | null} */ (detailRegion.querySelector('#clients-edit-economic-activity-name'));
        if (eaNameInput) {
          const selectedOpt = target.options[target.selectedIndex];
          eaNameInput.value = selectedOpt ? selectedOpt.text.replace(/^[^ ]+ — /, '') : '';
        }
        return;
      }

      if (!(target instanceof globalScope.HTMLInputElement) || target.name !== 'documentFile') {
        return;
      }

      const documentForm = target.form;
      if (!(documentForm instanceof globalScope.HTMLFormElement)) {
        return;
      }

      const fileFeedback = /** @type {HTMLElement | null} */ (documentForm.querySelector('#clients-document-file-feedback'));
      const submitButton = /** @type {HTMLButtonElement | null} */ (documentForm.querySelector('#clients-document-submit-button'));
      const fileNameInput = /** @type {HTMLInputElement | null} */ (documentForm.querySelector('input[name="fileName"]'));
      const mimeTypeInput = /** @type {HTMLInputElement | null} */ (documentForm.querySelector('input[name="mimeType"]'));
      const fileContentBase64Input = /** @type {HTMLInputElement | null} */ (documentForm.querySelector('input[name="fileContentBase64"]'));
      const selectedFile = target.files && target.files[0] ? target.files[0] : null;

      if (fileNameInput) { fileNameInput.value = ''; }
      if (mimeTypeInput) { mimeTypeInput.value = ''; }
      if (fileContentBase64Input) { fileContentBase64Input.value = ''; }
      if (fileFeedback) { fileFeedback.innerHTML = ''; }

      if (!selectedFile) {
        isDocumentFileProcessing = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Agregar documento';
        }
        return;
      }

      if (!isAllowedDocumentFile(selectedFile)) {
        target.value = '';
        if (fileFeedback) {
          fileFeedback.innerHTML = rootShellUi.renderInlineMessage('Selecciona un archivo PDF, JPG, PNG, WebP, DOC o DOCX.', 'error');
        }
        return;
      }

      if (selectedFile.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
        target.value = '';
        if (fileFeedback) {
          fileFeedback.innerHTML = rootShellUi.renderInlineMessage('El archivo supera el máximo permitido de 5 MB.', 'error');
        }
        return;
      }

      isDocumentFileProcessing = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Procesando archivo...';
      }
      if (fileFeedback) {
        fileFeedback.innerHTML = rootShellUi.renderInlineMessage('Procesando archivo seleccionado...');
      }

      try {
        const base64Content = await fileToBase64(selectedFile);
        if (fileNameInput) { fileNameInput.value = selectedFile.name; }
        if (mimeTypeInput) { mimeTypeInput.value = resolveDocumentUploadMimeType(selectedFile); }
        if (fileContentBase64Input) { fileContentBase64Input.value = base64Content; }
        if (fileFeedback) {
          fileFeedback.innerHTML = rootShellUi.renderInlineMessage(`Archivo listo: ${selectedFile.name} · ${resolveDocumentUploadMimeType(selectedFile)} · ${formatDocumentFileSize(selectedFile.size)}`);
        }
      } catch (error) {
        target.value = '';
        if (fileNameInput) { fileNameInput.value = ''; }
        if (mimeTypeInput) { mimeTypeInput.value = ''; }
        if (fileContentBase64Input) { fileContentBase64Input.value = ''; }
        if (fileFeedback) {
          fileFeedback.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo leer el archivo. Intenta seleccionarlo nuevamente.', 'error');
        }
      } finally {
        isDocumentFileProcessing = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Agregar documento';
        }
      }
    });

    // Blur automático en el legalId del form de edición (igual que en create dialog)
    if (canLookupTaxpayer) {
      detailRegion.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof globalScope.HTMLInputElement) || target.name !== 'legalId') return;
        editLookupDone = false;
        const editLookupBtn = /** @type {HTMLButtonElement | null} */ (detailRegion.querySelector('#clients-lookup-taxpayer-button'));
        if (editLookupBtn) editLookupBtn.disabled = !isCedulaLongEnough(target.value);
      });

      function triggerEditLookupFromLegalIdInput(event) {
        const target = event.target;
        if (!(target instanceof globalScope.HTMLInputElement) || target.name !== 'legalId') return;
        if (!isCedulaLongEnough(target.value) || editLookupDone) return;
        const editLookupBtn = /** @type {HTMLButtonElement | null} */ (detailRegion.querySelector('#clients-lookup-taxpayer-button'));
        if (!editLookupBtn) return;
        // Reusar el handler delegado existente sin exigir estado visual previo del botón.
        editLookupBtn.click();
      }

      detailRegion.addEventListener('change', triggerEditLookupFromLegalIdInput);
      detailRegion.addEventListener('focusout', triggerEditLookupFromLegalIdInput);
      detailRegion.addEventListener('keydown', (event) => {
        const target = event.target;
        if (event.key !== 'Enter' || !(target instanceof globalScope.HTMLInputElement) || target.name !== 'legalId') return;
        event.preventDefault();
        triggerEditLookupFromLegalIdInput(event);
      });
      detailRegion.addEventListener('blur', triggerEditLookupFromLegalIdInput, true); // capture: true necesario para delegar blur
    }

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
            if (msgEl) { msgEl.innerHTML = rootShellUi.renderInlineMessage('Limite de credito guardado.'); }
          } catch (err) {
            if (msgEl) { msgEl.innerHTML = rootShellUi.renderInlineMessage(err.message || 'No se pudo guardar el limite de credito.', 'error'); }
          }
          return;
        }

        if (form.id === 'clients-document-form') {
          const fileFeedback = /** @type {HTMLElement | null} */ (form.querySelector('#clients-document-file-feedback'));
          if (isDocumentFileProcessing) {
            if (fileFeedback) {
              fileFeedback.innerHTML = rootShellUi.renderInlineMessage('Espera a que termine la lectura del archivo antes de enviar.', 'warning');
            }
            return;
          }

          if (!String(formData.get('fileContentBase64') || '').trim()) {
            if (fileFeedback) {
              fileFeedback.innerHTML = rootShellUi.renderInlineMessage('Selecciona un archivo válido antes de enviar el documento.', 'error');
            }
            return;
          }

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
