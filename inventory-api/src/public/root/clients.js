const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('clients-session');
const logoutButton = document.getElementById('logout-button');
const clientForm = document.getElementById('client-form');
const storeForm = document.getElementById('store-form');
const representativeForm = document.getElementById('representative-form');
const clientReferenceForm = document.getElementById('client-reference-form');
const clientDocumentForm = document.getElementById('client-document-form');
const message = document.getElementById('clients-message');
const createClientButton = document.getElementById('create-client-button');
const addClientDocumentButton = document.getElementById('add-client-document-button');
const lookupTaxpayerButton = document.getElementById('lookup-taxpayer-button');
const refreshButton = document.getElementById('refresh-clients-button');
const clientsBody = document.getElementById('clients-body');
const openClientPanelButton = document.getElementById('open-client-panel-button');
const closeClientPanelButton = document.getElementById('close-client-panel-button');
const cancelClientPanelButton = document.getElementById('cancel-client-panel-button');
const clientPanel = document.getElementById('client-panel');
const clientPanelBackdrop = document.getElementById('client-panel-backdrop');
const clientPanelTitle = document.getElementById('client-panel-title');
const clientPanelSubtitle = document.getElementById('client-panel-subtitle');
const clientSearchInput = document.getElementById('client-search-input');
const clientClassificationFilter = document.getElementById('client-classification-filter');
const clientStatusFilter = document.getElementById('client-status-filter');
const clearClientFiltersButton = document.getElementById('clear-client-filters-button');
const clientsResultsLabel = document.getElementById('clients-results-label');
const clientsTotalCount = document.getElementById('clients-total-count');
const clientsWithoutStoreCount = document.getElementById('clients-without-store-count');
const clientsWithoutFiscalCount = document.getElementById('clients-without-fiscal-count');
const clientsCreditCount = document.getElementById('clients-credit-count');
const pendingStoresList = document.getElementById('pending-stores-list');
const pendingRepresentativesList = document.getElementById('pending-representatives-list');
const pendingClientReferencesList = document.getElementById('pending-client-references-list');
const existingClientReferencesList = document.getElementById('existing-client-references-list');
const pendingClientDocumentsList = document.getElementById('pending-client-documents-list');
const existingClientDocumentsList = document.getElementById('existing-client-documents-list');
const clientDocumentTypeSelect = document.getElementById('client-document-type');
const openStoreMapButton = document.getElementById('open-store-map-button');
const storeMapModal = document.getElementById('store-map-modal');
const closeStoreMapButton = document.getElementById('close-store-map-button');
const useStoreMapButton = document.getElementById('use-store-map-button');
const storeMapMessage = document.getElementById('store-map-message');
const mapSearchForm = document.getElementById('map-search-form');
const mapSearchButton = document.getElementById('map-search-button');
const mapSearchResults = document.getElementById('map-search-results');
const economicActivityOptions = document.getElementById('economic-activity-options');
let clients = [];
let zones = [];
let classifications = [];
let documentTypes = [];
let pendingStores = [];
let pendingRepresentatives = [];
let pendingClientReferences = [];
let pendingClientDocuments = [];
let existingClientReferences = [];
let existingClientDocuments = [];
let editingClientId = null;
let selectedStoreLocation;
let storeMap;
let storeMarker;
const clientsShared = window.RootClientsShared;
const COSTA_RICA_CENTER = clientsShared.COSTA_RICA_CENTER;
let mapState = { centerLat: COSTA_RICA_CENTER.latitude, centerLng: COSTA_RICA_CENTER.longitude };

if (!session?.token || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
  window.location.href = '/';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

const authHeaders = () => clientsShared.authHeaders(session);
const optional = clientsShared.optional;
const optionalNumber = clientsShared.optionalNumber;

function documentTypeLabel(value) {
  if (value === 'REFERENCIA_COMERCIAL') {
    return 'Soporte de referencia';
  }
  return documentTypes.find((type) => type.value === value)?.label || value || 'Sin tipo';
}

const setMessage = (text, isError = false) => clientsShared.setMessage(message, text, isError);
const setMapMessage = (text, isError = false) => clientsShared.setMessage(storeMapMessage, text, isError);
const downloadProtectedClientDocument = (fileUrl, fileName) => clientsShared.downloadProtectedFile(session, fileUrl, fileName, 'No se pudo descargar el documento');

function setFieldIfEmpty(fieldName, value) {
  if (!value) {
    return;
  }

  const field = clientForm.elements[fieldName];
  if (field && !field.value.trim()) {
    field.value = value;
  }
}

function renderEconomicActivities(activities) {
  economicActivityOptions.innerHTML = activities
    .map((activity) => `<option value="${activity.code}">${activity.name}</option><option value="${activity.name}">${activity.code}</option>`)
    .join('');
}

async function loadEconomicActivities(query = '') {
  const response = await fetch(`/api/economic-activities?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const activities = await response.json();
  if (!response.ok) {
    return;
  }

  renderEconomicActivities(activities);
}

function syncEconomicActivityFromInput() {
  const value = clientForm.elements.economicActivityCode.value.trim()
    || clientForm.elements.economicActivityName.value.trim();
  if (!value) {
    return;
  }

  const options = [...economicActivityOptions.options];
  const selected = options.find((option) => option.value === value);
  if (!selected) {
    return;
  }

  const code = /^\d+$/.test(selected.value) ? selected.value : selected.textContent;
  const name = /^\d+$/.test(selected.value) ? selected.textContent : selected.value;
  clientForm.elements.economicActivityCode.value = code;
  clientForm.elements.economicActivityName.value = name;
}

function renderZoneOptions() {
  const select = storeForm.elements.regionId;
  select.innerHTML = '<option value="">Sin zona</option>'
    + zones.map((zone) => `<option value="${zone.id}">${zone.name}</option>`).join('');
  renderSubzoneOptions();
}

function renderClassificationOptions() {
  const select = clientForm.elements.clientClassificationId;
  const currentFilter = clientClassificationFilter.value;
  select.innerHTML = '<option value="">Sin clasificacion</option>'
    + classifications.map((classification) => `<option value="${classification.id}">${classification.name}</option>`).join('');
  clientClassificationFilter.innerHTML = '<option value="">Todas</option>'
    + classifications.map((classification) => `<option value="${classification.id}">${classification.name}</option>`).join('');
  clientClassificationFilter.value = currentFilter;
  const general = classifications.find((classification) => classification.code === 'GENERAL');
  if (general && !select.value) {
    select.value = general.id;
  }
}

function renderDocumentTypeOptions() {
  clientDocumentTypeSelect.innerHTML = '<option value="">Seleccione tipo</option>'
    + documentTypes.map((type) => `<option value="${type.value}">${type.label}</option>`).join('');
}

function renderSubzoneOptions() {
  const select = storeForm.elements.subregionId;
  const regionId = storeForm.elements.regionId.value;
  const zone = zones.find((item) => item.id === regionId);
  const subzones = zone?.subregions || [];
  select.innerHTML = '<option value="">Seleccione subzona</option>'
    + subzones.map((subzone) => `<option value="${subzone.id}">${subzone.name}</option>`).join('');
  select.disabled = !subzones.length;
}

function renderClientOptions() {
}

function hasFiscalData(client) {
  return Boolean(client.legalId || client.legalEntity?.legalId || client.legalEntity?.legalName || client.emailBilling);
}

function hasCreditData(client) {
  return Boolean(client.paymentType === 'CREDIT' || client.paymentDays || client.creditLimit || client.creditBalance);
}

function clientSearchText(client) {
  return [
    client.name,
    client.code,
    client.phone,
    client.legalId,
    client.emailBilling,
    client.legalEntity?.legalName,
    client.legalEntity?.commercialName,
    client.classification?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

function filteredClients() {
  const query = clientSearchInput.value.trim().toLowerCase();
  const classificationId = clientClassificationFilter.value;
  const status = clientStatusFilter.value;

  return clients.filter((client) => {
    const storesCount = client.storesCount || client.stores?.length || 0;
    const matchesSearch = !query || clientSearchText(client).includes(query);
    const matchesClassification = !classificationId || client.clientClassificationId === classificationId || client.classification?.id === classificationId;
    const matchesStatus = !status
      || (status === 'missing-store' && storesCount === 0)
      || (status === 'missing-fiscal' && !hasFiscalData(client))
      || (status === 'with-credit' && hasCreditData(client));

    return matchesSearch && matchesClassification && matchesStatus;
  });
}

function renderClientMetrics() {
  const total = clients.length;
  const withoutStore = clients.filter((client) => (client.storesCount || client.stores?.length || 0) === 0).length;
  const withoutFiscal = clients.filter((client) => !hasFiscalData(client)).length;
  const withCredit = clients.filter(hasCreditData).length;

  clientsTotalCount.textContent = total;
  clientsWithoutStoreCount.textContent = withoutStore;
  clientsWithoutFiscalCount.textContent = withoutFiscal;
  clientsCreditCount.textContent = withCredit;
}

function renderClients() {
  renderClientMetrics();
  const visibleClients = filteredClients();
  clientsResultsLabel.textContent = `${visibleClients.length} de ${clients.length} cliente(s)`;

  if (!clients.length) {
    clientsBody.innerHTML = '<tr><td class="empty-state" colspan="7">No hay clientes registrados.</td></tr>';
    renderClientOptions();
    return;
  }

  if (!visibleClients.length) {
    clientsBody.innerHTML = '<tr><td class="empty-state" colspan="7">No hay clientes con esos filtros.</td></tr>';
    renderClientOptions();
    return;
  }

  clientsBody.innerHTML = visibleClients
    .map((client) => {
      const storesCount = client.storesCount || client.stores?.length || 0;
      const fiscalReady = hasFiscalData(client);
      const stores = client.stores?.length
        ? client.stores.map((store) => {
          const location = [store.subregion?.region?.name, store.subregion?.name].filter(Boolean).join(' / ') || 'Sin zona';
          const primary = store.isPrimary ? 'Principal' : 'Tienda';
          const people = store.representatives?.length ? `, ${store.representatives.length} persona(s)` : '';
          return `<span>${store.name} - ${primary} (${location}${people})</span>`;
        }).join('')
        : '<span>Sin tiendas</span>';

      return `
        <tr>
          <td data-label="Cliente">
            <strong>${client.name}</strong>
            <div class="permission-tags">${stores}</div>
          </td>
          <td data-label="Codigo">${client.code || '-'}</td>
          <td data-label="Clasificacion">${client.classification?.name || '-'}</td>
          <td data-label="Telefono">${client.phone || '-'}</td>
          <td data-label="Estado">
            <div class="status-stack">
              <span class="badge ${fiscalReady ? 'badge-success' : 'badge-warning'}">${fiscalReady ? 'Fiscal completo' : 'Fiscal pendiente'}</span>
              <span class="badge ${storesCount ? 'badge-success' : 'badge-warning'}">${storesCount ? 'Con tienda' : 'Sin tienda'}</span>
            </div>
          </td>
          <td data-label="Tiendas">${storesCount}</td>
          <td data-label="Acciones">
            <div class="table-actions">
              <a class="secondary-button table-action-link" href="/root/client-detail.html?id=${client.id}">Ver</a>
              <button class="secondary-button table-action-link edit-client-button" type="button" data-client-id="${client.id}">Editar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  renderClientOptions();
}

function renderPendingStores() {
  if (!pendingStores.length) {
    pendingStoresList.innerHTML = '<p class="muted">No hay tiendas agregadas para este cliente.</p>';
    return;
  }

  pendingStoresList.innerHTML = pendingStores
    .map((store, index) => `
      <article class="role-card">
        <div>
          <h3>${store.name}</h3>
          <p class="muted">${store.storeType || 'Tipo no indicado'}${index === 0 ? ' / Principal' : ''}</p>
          <p class="muted">${subzonePathLabel(store.subregionId)}</p>
          <p class="muted">${store.attentionSchedule || 'Sin horario'}${store.locationReference ? ` / ${store.locationReference}` : ''}</p>
          <p class="muted">${store.representatives?.length ? `${store.representatives.length} persona(s) registrada(s)` : 'Sin personal registrado'}</p>
          <p class="muted">${store.latitude && store.longitude ? `${store.latitude}, ${store.longitude}` : 'Sin coordenadas'}</p>
        </div>
        <div class="import-actions">
          <span class="badge badge-success">${store.code || 'Sin codigo'}</span>
          <button class="secondary-button remove-store-button" type="button" data-store-index="${index}">Quitar</button>
        </div>
      </article>
    `)
    .join('');
}

function subzonePathLabel(subregionId) {
  for (const zone of zones) {
    const subzone = zone.subregions?.find((item) => item.id === subregionId);
    if (subzone) {
      return `${zone.name} / ${subzone.name}`;
    }
  }

  return 'Sin subzona';
}

function renderPendingRepresentatives() {
  if (!pendingRepresentatives.length) {
    pendingRepresentativesList.innerHTML = '<p class="muted">No hay personal agregado para esta tienda.</p>';
    return;
  }

  pendingRepresentativesList.innerHTML = pendingRepresentatives
    .map((representative, index) => `
      <article class="role-card">
        <div>
          <h3>${representative.fullName}</h3>
          <p class="muted">${representative.position || 'Sin cargo'}${representative.role ? ` / ${representative.role}` : ''}</p>
          <p class="muted">${representative.email || 'Sin correo'}${representative.phonePrimary ? ` / ${representative.phonePrimary}` : ''}</p>
          <p class="muted">${representative.isPrimaryContact || index === 0 ? 'Contacto principal' : 'Contacto adicional'}</p>
        </div>
        <div class="import-actions">
          <span class="badge badge-success">${representative.identificationNumber || 'Sin identificacion'}</span>
          <button class="secondary-button remove-representative-button" type="button" data-representative-index="${index}">Quitar</button>
        </div>
      </article>
    `)
    .join('');
}

function renderPendingClientDocuments() {
  if (!pendingClientDocuments.length) {
    pendingClientDocumentsList.innerHTML = '<p class="muted">No hay documentos pendientes.</p>';
    return;
  }

  pendingClientDocumentsList.innerHTML = pendingClientDocuments
    .map((document, index) => `
      <article class="role-card">
        <div>
          <h3>${documentTypeLabel(document.documentType)}</h3>
          <p class="muted">${document.fileName}</p>
          <p class="muted">${document.documentNumber || 'Sin numero'}${document.notes ? ` / ${document.notes}` : ''}</p>
        </div>
        <div class="import-actions">
          <span class="badge badge-success">Pendiente</span>
          <button class="secondary-button remove-client-document-button" type="button" data-document-index="${index}">Quitar</button>
        </div>
      </article>
    `)
    .join('');
}

function renderPendingClientReferences() {
  if (!pendingClientReferences.length) {
    pendingClientReferencesList.innerHTML = '<p class="muted">No hay referencias pendientes.</p>';
    return;
  }

  pendingClientReferencesList.innerHTML = pendingClientReferences
    .map((reference, index) => `
      <article class="role-card">
        <div>
          <h3>${reference.name}</h3>
          <p class="muted">${reference.contact || 'Sin contacto'}${reference.phone1 ? ` / ${reference.phone1}` : ''}</p>
          <p class="muted">${reference.termDays ? `${reference.termDays} dia(s)` : 'Sin plazo'}${reference.amount !== undefined ? ` / CRC ${Number(reference.amount).toFixed(2)}` : ''}</p>
        </div>
        <div class="import-actions">
          <span class="badge ${reference.approved ? 'badge-success' : 'badge-warning'}">${reference.approved ? 'Aprobada' : 'Pendiente'}</span>
          <button class="secondary-button remove-client-reference-button" type="button" data-reference-index="${index}">Quitar</button>
        </div>
      </article>
    `)
    .join('');
}

function renderExistingClientReferences() {
  if (!existingClientReferences.length) {
    existingClientReferencesList.innerHTML = '<p class="muted">No hay referencias guardadas para este cliente.</p>';
    return;
  }

  existingClientReferencesList.innerHTML = existingClientReferences
    .map((reference) => `
      <article class="role-card">
        <div>
          <h3>${reference.name}</h3>
          <p class="muted">${reference.contact || 'Sin contacto'}${reference.phone1 ? ` / ${reference.phone1}` : ''}</p>
          <p class="muted">${reference.termDays ? `${reference.termDays} dia(s)` : 'Sin plazo'}${reference.amount !== null && reference.amount !== undefined ? ` / CRC ${Number(reference.amount).toFixed(2)}` : ''}</p>
        </div>
        <div class="import-actions">
          <span class="badge ${reference.approved ? 'badge-success' : 'badge-warning'}">${reference.approved ? 'Aprobada' : 'Pendiente'}</span>
          <span class="badge badge-success">${reference.approvedBy || 'Sin validador'}</span>
        </div>
      </article>
    `)
    .join('');
}

function renderExistingClientDocuments() {
  if (!existingClientDocuments.length) {
    existingClientDocumentsList.innerHTML = '<p class="muted">No hay documentos guardados para este cliente.</p>';
    return;
  }

  existingClientDocumentsList.innerHTML = existingClientDocuments
    .map((document) => `
      <article class="role-card">
        <div>
          <h3>${documentTypeLabel(document.documentType)}</h3>
          <p class="muted">${document.fileName}</p>
          <p class="muted">${document.documentNumber || 'Sin numero'}${document.notes ? ` / ${document.notes}` : ''}</p>
        </div>
        <div class="import-actions">
          <span class="badge badge-success">${document.status || 'Activo'}</span>
          <button class="secondary-button table-action-link client-document-download-button" type="button" data-file-url="${document.fileUrl}" data-file-name="${document.fileName}">Descargar</button>
        </div>
      </article>
    `)
    .join('');
}

function setActiveClientPanelTab(tabName) {
  document.querySelectorAll('[data-client-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.clientTab === tabName);
  });
  document.querySelectorAll('[data-client-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.clientPanel !== tabName);
  });
}

function resetClientWorkspace() {
  clientForm.reset();
  storeForm.reset();
  representativeForm.reset();
  clientReferenceForm.reset();
  clientDocumentForm.reset();
  pendingStores = [];
  pendingRepresentatives = [];
  pendingClientReferences = [];
  pendingClientDocuments = [];
  existingClientReferences = [];
  existingClientDocuments = [];
  editingClientId = null;
  selectedStoreLocation = undefined;
  renderPendingStores();
  renderPendingRepresentatives();
  renderPendingClientReferences();
  renderPendingClientDocuments();
  renderExistingClientReferences();
  renderExistingClientDocuments();
  renderClassificationOptions();
  renderDocumentTypeOptions();
  renderSubzoneOptions();
  setActiveClientPanelTab('general');
}

function openClientPanel(client = null) {
  resetClientWorkspace();
  clientPanel.classList.remove('hidden');
  clientPanelBackdrop.classList.remove('hidden');
  document.body.classList.add('drawer-open');

  if (client) {
    editingClientId = client.id;
    clientPanelTitle.textContent = `Editar cliente: ${client.name}`;
    clientPanelSubtitle.textContent = 'Actualice datos generales o fiscales sin salir del listado.';
    createClientButton.textContent = 'Guardar cambios';
    clientForm.elements.clientId.value = client.id;
    clientForm.elements.name.value = client.name || '';
    clientForm.elements.code.value = client.code || '';
    clientForm.elements.clientClassificationId.value = client.clientClassificationId || client.classification?.id || '';
    clientForm.elements.phone.value = client.phone || '';
    clientForm.elements.address.value = client.address || '';
    clientForm.elements.legalName.value = client.legalEntity?.legalName || client.legalName || '';
    clientForm.elements.commercialName.value = client.legalEntity?.commercialName || client.commercialName || '';
    clientForm.elements.documentType.value = client.documentType || '01';
    clientForm.elements.legalId.value = client.legalId || client.legalEntity?.legalId || '';
    clientForm.elements.emailBilling.value = client.emailBilling || '';
    clientForm.elements.economicActivityCode.value = client.economicActivityCode || '';
    clientForm.elements.economicActivityName.value = client.economicActivityName || '';
    clientForm.elements.paymentType.value = client.paymentType || 'CASH';
    clientForm.elements.paymentDays.value = client.paymentDays ?? '';
    clientForm.elements.creditLimit.value = client.creditLimit ?? '';
    clientForm.elements.creditBalance.value = client.creditBalance ?? '';
    existingClientReferences = client.references || [];
    existingClientDocuments = client.documents || [];
    renderExistingClientReferences();
    renderExistingClientDocuments();
  } else {
    clientPanelTitle.textContent = 'Nuevo cliente';
    clientPanelSubtitle.textContent = 'Complete primero los datos esenciales. Puede agregar tiendas antes de guardar.';
    createClientButton.textContent = 'Guardar cliente';
    clientForm.elements.paymentType.value = 'CASH';
    renderExistingClientReferences();
    renderExistingClientDocuments();
  }

  clientForm.elements.name.focus();
}

function closeClientPanel() {
  clientPanel.classList.add('hidden');
  clientPanelBackdrop.classList.add('hidden');
  document.body.classList.remove('drawer-open');
}

function currentStoreCoordinates() {
  const latitudeValue = storeForm.elements.latitude.value.trim();
  const longitudeValue = storeForm.elements.longitude.value.trim();
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    latitudeValue
    && longitudeValue
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  ) {
    return { latitude, longitude };
  }

  return COSTA_RICA_CENTER;
}

const clamp = clientsShared.clamp;
const lngToPercent = clientsShared.lngToPercent;
const latToPercent = clientsShared.latToPercent;
const percentToLng = clientsShared.percentToLng;
const percentToLat = clientsShared.percentToLat;

function setStoreMarker(latitude, longitude) {
  selectedStoreLocation = {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
  };
  mapState.centerLat = selectedStoreLocation.latitude;
  mapState.centerLng = selectedStoreLocation.longitude;
  if (storeMap && window.L) {
    if (!storeMarker) {
      storeMarker = L.marker([selectedStoreLocation.latitude, selectedStoreLocation.longitude], { draggable: true }).addTo(storeMap);
      storeMarker.on('dragend', () => {
        const position = storeMarker.getLatLng();
        setStoreMarker(position.lat, position.lng);
      });
    } else {
      storeMarker.setLatLng([selectedStoreLocation.latitude, selectedStoreLocation.longitude]);
    }
    storeMap.setView([selectedStoreLocation.latitude, selectedStoreLocation.longitude], storeMap.getZoom());
  } else {
    renderStoreMap();
  }
  setMapMessage(`Seleccionado: ${selectedStoreLocation.latitude}, ${selectedStoreLocation.longitude}`);
}

function renderStoreMap() {
  const map = document.getElementById('store-map');
  const pinLeft = selectedStoreLocation ? clamp(lngToPercent(selectedStoreLocation.longitude), 0, 100) : 50;
  const pinTop = selectedStoreLocation ? clamp(latToPercent(selectedStoreLocation.latitude), 0, 100) : 50;

  const pin = selectedStoreLocation
    ? `<div class="map-pin" style="left:${pinLeft}%;top:${pinTop}%"></div>`
    : '';

  map.innerHTML = `
    <div class="map-country-layer">
      <svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        <rect width="1000" height="620" fill="#b8e2ef"></rect>
        <path d="M64 345 C117 298 165 270 239 272 C299 274 344 236 398 207 C468 169 536 179 587 218 C637 256 646 314 708 331 C773 350 825 330 888 373 C827 428 756 453 679 450 C617 447 571 410 523 374 C472 337 426 339 370 374 C316 408 273 446 208 431 C154 419 106 387 64 345 Z" fill="#67b56b" stroke="#2e7d32" stroke-width="8"></path>
        <path d="M102 342 C161 309 213 302 273 305" fill="none" stroke="#e6f4ea" stroke-width="16" stroke-linecap="round"></path>
        <path d="M403 238 C479 219 555 234 615 300" fill="none" stroke="#e6f4ea" stroke-width="14" stroke-linecap="round"></path>
        <path d="M608 375 C687 418 775 419 858 379" fill="none" stroke="#e6f4ea" stroke-width="14" stroke-linecap="round"></path>
        <circle cx="420" cy="285" r="20" fill="#1f6feb"></circle>
        <text x="448" y="292" fill="#1f2328" font-size="32" font-weight="700">San Jose</text>
      </svg>
    </div>
    <div class="map-crosshair"></div>
    ${pin}
    <span class="map-label" style="left:8%;top:14%">Pacifico</span>
    <span class="map-label" style="right:8%;bottom:16%">Caribe</span>
    <p class="map-fallback">Haga clic sobre Costa Rica para seleccionar la ubicacion aproximada de la tienda. Los campos manuales siguen disponibles para ajustar la precision.</p>
  `;
}

function openStoreMap() {
  storeMapModal.classList.remove('hidden');
  const coordinates = currentStoreCoordinates();
  mapState.centerLat = coordinates.latitude;
  mapState.centerLng = coordinates.longitude;

  setTimeout(() => {
    if (window.L) {
      if (!storeMap) {
        storeMap = L.map('store-map').setView([coordinates.latitude, coordinates.longitude], 8);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(storeMap);
        storeMap.on('click', (event) => {
          setStoreMarker(event.latlng.lat, event.latlng.lng);
        });
      }

      storeMap.invalidateSize();
      storeMap.setView([coordinates.latitude, coordinates.longitude], selectedStoreLocation ? storeMap.getZoom() : 8);
      setStoreMarker(coordinates.latitude, coordinates.longitude);
      return;
    }

    setMessage('No se pudo cargar el mapa real. Se muestra un selector aproximado.', true);
    setStoreMarker(coordinates.latitude, coordinates.longitude);
  }, 0);
}

function closeStoreMap() {
  storeMapModal.classList.add('hidden');
}

function renderMapSearchResults(results) {
  if (!results.length) {
    mapSearchResults.innerHTML = '<p class="muted">No se encontraron lugares en Costa Rica.</p>';
    return;
  }

  mapSearchResults.innerHTML = results
    .map((result, index) => `
      <button class="map-search-result" type="button" data-result-index="${index}">
        ${result.name}
      </button>
    `)
    .join('');
  mapSearchResults.dataset.results = JSON.stringify(results);
}

async function searchMapPlaces(query) {
  try {
    const response = await fetch(`/api/geocoding/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const results = await response.json();
    if (!response.ok) {
      throw new Error(results.message || 'No se pudo buscar la ubicacion');
    }
    return results;
  } catch (_error) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', query);
    url.searchParams.set('countrycodes', 'cr');
    url.searchParams.set('limit', '6');
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error('No se pudo consultar el buscador de mapas');
    }
    const results = await response.json();
    return results.map((item) => ({
      name: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      type: item.type,
      category: item.category,
    })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  }
}

async function loadZones() {
  const response = await fetch('/api/regions/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar las zonas');
  }

  zones = data;
  renderZoneOptions();
}

async function loadClassifications() {
  const response = await fetch('/api/clients/classifications/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar las clasificaciones');
  }

  classifications = data;
  renderClassificationOptions();
}

async function loadDocumentTypes() {
  const response = await fetch('/api/clients/document-types', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los tipos de documento');
  }

  documentTypes = data;
  renderDocumentTypeOptions();
}

const readFileAsBase64 = clientsShared.readFileAsBase64;

async function loadClients() {
  const response = await fetch('/api/clients/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los clientes');
  }

  clients = data;
  renderClients();
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

openClientPanelButton.addEventListener('click', () => {
  setMessage('');
  openClientPanel();
});

closeClientPanelButton.addEventListener('click', closeClientPanel);
cancelClientPanelButton.addEventListener('click', closeClientPanel);
clientPanelBackdrop.addEventListener('click', closeClientPanel);

document.querySelectorAll('[data-client-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    setActiveClientPanelTab(button.dataset.clientTab);
  });
});

clientSearchInput.addEventListener('input', renderClients);
clientClassificationFilter.addEventListener('change', renderClients);
clientStatusFilter.addEventListener('change', renderClients);
clearClientFiltersButton.addEventListener('click', () => {
  clientSearchInput.value = '';
  clientClassificationFilter.value = '';
  clientStatusFilter.value = '';
  renderClients();
});

clientsBody.addEventListener('click', (event) => {
  const button = event.target.closest('.edit-client-button');
  if (!button) {
    return;
  }

  const client = clients.find((item) => item.id === button.dataset.clientId);
  if (client) {
    setMessage('');
    openClientPanel(client);
  }
});

refreshButton.addEventListener('click', async () => {
  setMessage('');
  try {
    await loadClients();
  } catch (error) {
    setMessage(error.message || 'No se pudieron cargar los clientes', true);
  }
});

storeForm.elements.regionId.addEventListener('change', renderSubzoneOptions);
openStoreMapButton.addEventListener('click', openStoreMap);
closeStoreMapButton.addEventListener('click', closeStoreMap);
storeMapModal.addEventListener('click', (event) => {
  if (event.target === storeMapModal) {
    closeStoreMap();
  }
});
document.getElementById('store-map').addEventListener('click', (event) => {
  if (window.L && storeMap) {
    return;
  }
  const map = event.currentTarget;
  const rect = map.getBoundingClientRect();
  const percentX = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
  const percentY = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
  const latitude = percentToLat(percentY);
  const longitude = percentToLng(percentX);
  setStoreMarker(latitude, longitude);
});
useStoreMapButton.addEventListener('click', () => {
  if (!selectedStoreLocation) {
    setMapMessage('Seleccione un punto en el mapa', true);
    return;
  }

  storeForm.elements.latitude.value = selectedStoreLocation.latitude.toFixed(7);
  storeForm.elements.longitude.value = selectedStoreLocation.longitude.toFixed(7);
  setMessage('Ubicacion seleccionada para la tienda');
  closeStoreMap();
});
mapSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMapMessage('');
  const query = mapSearchForm.elements.query.value.trim();
  if (query.length < 3) {
    setMapMessage('Ingrese al menos 3 caracteres para buscar', true);
    return;
  }

  mapSearchButton.disabled = true;
  mapSearchButton.textContent = 'Buscando...';

  try {
    const results = await searchMapPlaces(query);
    renderMapSearchResults(results);
  } catch (error) {
    mapSearchResults.innerHTML = '';
    setMapMessage(error.message || 'No se pudo buscar la ubicacion', true);
  } finally {
    mapSearchButton.disabled = false;
    mapSearchButton.textContent = 'Buscar';
  }
});
mapSearchResults.addEventListener('click', (event) => {
  const button = event.target.closest('.map-search-result');
  if (!button) {
    return;
  }

  const results = JSON.parse(mapSearchResults.dataset.results || '[]');
  const result = results[Number(button.dataset.resultIndex)];
  if (!result) {
    return;
  }

  setStoreMarker(result.latitude, result.longitude);
  if (storeMap && window.L) {
    storeMap.setView([result.latitude, result.longitude], 15);
  }
  setMapMessage(`Seleccionado: ${result.name}`);
});

pendingStoresList.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-store-button');
  if (!button) {
    return;
  }

  pendingStores.splice(Number(button.dataset.storeIndex), 1);
  renderPendingStores();
});

pendingRepresentativesList.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-representative-button');
  if (!button) {
    return;
  }

  pendingRepresentatives.splice(Number(button.dataset.representativeIndex), 1);
  renderPendingRepresentatives();
});

pendingClientReferencesList.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-client-reference-button');
  if (!button) {
    return;
  }

  pendingClientReferences.splice(Number(button.dataset.referenceIndex), 1);
  renderPendingClientReferences();
});

pendingClientDocumentsList.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-client-document-button');
  if (!button) {
    return;
  }

  pendingClientDocuments.splice(Number(button.dataset.documentIndex), 1);
  renderPendingClientDocuments();
});

lookupTaxpayerButton.addEventListener('click', async () => {
  setMessage('');
  const legalId = optional(clientForm.elements.legalId.value);
  const documentType = optional(clientForm.elements.documentType.value);
  if (!legalId) {
    setMessage('Ingrese la identificacion antes de consultar Hacienda', true);
    clientForm.elements.legalId.focus();
    return;
  }

  lookupTaxpayerButton.disabled = true;
  lookupTaxpayerButton.textContent = 'Consultando...';

  try {
    const params = new URLSearchParams({ identification: legalId });
    if (documentType) {
      params.set('documentType', documentType);
    }

    const response = await fetch(`/api/taxpayers/lookup?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se encontraron datos en Hacienda');
    }

    clientForm.elements.legalId.value = result.identification || legalId;
    if (result.documentType) {
      clientForm.elements.documentType.value = result.documentType;
    }
    setFieldIfEmpty('name', result.name);
    setFieldIfEmpty('legalName', result.name);
    setFieldIfEmpty('commercialName', result.name);
    setFieldIfEmpty('emailBilling', result.email);
    setFieldIfEmpty('phone', result.phone);
    setFieldIfEmpty('address', result.address);
    setFieldIfEmpty('economicActivityCode', result.economicActivityCode);
    setFieldIfEmpty('economicActivityName', result.economicActivityName);
    setMessage('Datos encontrados en Hacienda. Revise la informacion antes de crear el cliente.');
  } catch (error) {
    setMessage(`${error.message || 'No se pudo consultar Hacienda'}. Puede llenar el cliente manualmente.`, true);
  } finally {
    lookupTaxpayerButton.disabled = false;
    lookupTaxpayerButton.textContent = 'Consultar identificacion';
  }
});

clientForm.elements.economicActivityCode.addEventListener('input', (event) => {
  loadEconomicActivities(event.target.value);
});
clientForm.elements.economicActivityName.addEventListener('input', (event) => {
  loadEconomicActivities(event.target.value);
});
clientForm.elements.economicActivityCode.addEventListener('change', syncEconomicActivityFromInput);
clientForm.elements.economicActivityName.addEventListener('change', syncEconomicActivityFromInput);

clientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  createClientButton.disabled = true;
  createClientButton.textContent = editingClientId ? 'Guardando...' : 'Creando...';

  const data = new FormData(clientForm);
  const clientName = data.get('name').toString().trim();
  const wasEditing = Boolean(editingClientId);
  const payload = {
    name: clientName,
    code: optional(data.get('code')),
    clientClassificationId: optional(data.get('clientClassificationId')),
    legalName: optional(data.get('legalName')) || clientName,
    commercialName: optional(data.get('commercialName')) || clientName,
    legalId: optional(data.get('legalId')),
    documentType: optional(data.get('documentType')),
    economicActivityCode: optional(data.get('economicActivityCode')),
    economicActivityName: optional(data.get('economicActivityName')),
    emailBilling: optional(data.get('emailBilling')),
    phone: optional(data.get('phone')),
    address: optional(data.get('address')),
    paymentType: optional(data.get('paymentType')),
    paymentDays: optionalNumber(data.get('paymentDays')),
    creditLimit: optionalNumber(data.get('creditLimit')),
    creditBalance: optionalNumber(data.get('creditBalance')),
  };

  try {
    const url = editingClientId ? `/api/clients/${editingClientId}` : '/api/clients/company';
    const response = await fetch(url, {
      method: editingClientId ? 'PUT' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || (editingClientId ? 'No se pudo actualizar el cliente' : 'No se pudo crear el cliente'));
    }

    const targetClientId = editingClientId || result.id;
    for (const store of pendingStores) {
      const storeResponse = await fetch(`/api/clients/company/${targetClientId}/stores`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(store),
      });
      const storeResult = await storeResponse.json();
      if (!storeResponse.ok) {
        throw new Error(storeResult.message || `No se pudo crear la tienda ${store.name}`);
      }
    }

    for (const reference of pendingClientReferences) {
      const referenceResponse = await fetch(`/api/clients/${targetClientId}/references`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(reference),
      });
      const referenceResult = await referenceResponse.json();
      if (!referenceResponse.ok) {
        throw new Error(referenceResult.message || `No se pudo guardar la referencia ${reference.name}`);
      }
    }

    for (const document of pendingClientDocuments) {
      const documentResponse = await fetch(`/api/clients/${targetClientId}/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(document),
      });
      const documentResult = await documentResponse.json();
      if (!documentResponse.ok) {
        throw new Error(documentResult.message || `No se pudo subir el documento ${document.fileName}`);
      }
    }

    resetClientWorkspace();
    closeClientPanel();
    setMessage(wasEditing ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente');
    await loadClients();
  } catch (error) {
    setMessage(error.message || (wasEditing ? 'No se pudo actualizar el cliente' : 'No se pudo crear el cliente'), true);
  } finally {
    createClientButton.disabled = false;
    createClientButton.textContent = wasEditing ? 'Guardar cambios' : 'Guardar cliente';
  }
});

clientReferenceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const data = new FormData(clientReferenceForm);
  const name = data.get('name').toString().trim();
  if (!name) {
    setMessage('Ingrese el nombre de la referencia', true);
    clientReferenceForm.elements.name.focus();
    return;
  }

  pendingClientReferences.push({
    name,
    contact: optional(data.get('contact')),
    phone1: optional(data.get('phone1')),
    phone2: optional(data.get('phone2')),
    termDays: optionalNumber(data.get('termDays')),
    amount: optionalNumber(data.get('amount')),
    approved: data.get('approved') === 'on',
    approvedBy: optional(data.get('approvedBy')),
  });

  clientReferenceForm.reset();
  renderPendingClientReferences();
  setMessage('Referencia agregada. Se guardara junto con el cliente.');
});

existingClientDocumentsList.addEventListener('click', async (event) => {
  const button = event.target.closest('.client-document-download-button');
  if (!button) {
    return;
  }

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Descargando...';

  try {
    setMessage('');
    await downloadProtectedClientDocument(button.dataset.fileUrl, button.dataset.fileName);
  } catch (error) {
    setMessage(error.message || 'No se pudo descargar el documento', true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
});

clientDocumentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const data = new FormData(clientDocumentForm);
  const documentType = optional(data.get('documentType'));
  const file = data.get('file');
  if (!documentType) {
    setMessage('Seleccione el tipo de documento', true);
    clientDocumentTypeSelect.focus();
    return;
  }

  if (!(file instanceof File) || !file.size) {
    setMessage('Seleccione un archivo para el documento', true);
    clientDocumentForm.elements.file.focus();
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setMessage('Cada documento debe pesar 5 MB o menos', true);
    return;
  }

  addClientDocumentButton.disabled = true;
  addClientDocumentButton.textContent = 'Agregando...';

  try {
    const fileContentBase64 = await readFileAsBase64(file);
    pendingClientDocuments.push({
      documentType,
      documentNumber: optional(data.get('documentNumber')),
      fileName: file.name,
      mimeType: file.type || undefined,
      fileContentBase64,
      notes: optional(data.get('notes')),
    });
    clientDocumentForm.reset();
    renderPendingClientDocuments();
    setMessage('Documento agregado. Se subira al guardar el cliente.');
  } catch (error) {
    setMessage(error.message || 'No se pudo preparar el documento', true);
  } finally {
    addClientDocumentButton.disabled = false;
    addClientDocumentButton.textContent = 'Agregar documento';
  }
});

representativeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const data = new FormData(representativeForm);
  const fullName = data.get('fullName').toString().trim();
  if (!fullName) {
    setMessage('Ingrese el nombre del representante o empleado', true);
    representativeForm.elements.fullName.focus();
    return;
  }

  const isPrimaryContact = data.get('isPrimaryContact') === 'on' || pendingRepresentatives.length === 0;
  if (isPrimaryContact) {
    pendingRepresentatives = pendingRepresentatives.map((representative) => ({
      ...representative,
      isPrimaryContact: false,
    }));
  }

  pendingRepresentatives.push({
    fullName,
    identificationNumber: optional(data.get('identificationNumber')),
    position: optional(data.get('position')),
    role: optional(data.get('role')),
    email: optional(data.get('email')),
    phonePrimary: optional(data.get('phonePrimary')),
    phoneSecondary: optional(data.get('phoneSecondary')),
    birthday: optional(data.get('birthday')),
    importantDate: optional(data.get('importantDate')),
    importantDateType: optional(data.get('importantDateType')),
    comment: optional(data.get('comment')),
    isPrimaryContact,
  });

  representativeForm.reset();
  renderPendingRepresentatives();
  setMessage('Personal agregado a la tienda en edicion.');
});

storeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const data = new FormData(storeForm);
  const name = data.get('name').toString().trim();
  const regionId = optional(data.get('regionId'));
  const subregionId = optional(data.get('subregionId'));
  if (!name) {
    setMessage('Ingrese el nombre de la tienda', true);
    storeForm.elements.name.focus();
    return;
  }

  if (!regionId || !subregionId) {
    setMessage('Seleccione zona y subzona para la tienda', true);
    return;
  }

  pendingStores.push({
    name,
    code: optional(data.get('code')),
    storeType: optional(data.get('storeType')),
    locationReference: optional(data.get('locationReference')),
    attentionSchedule: optional(data.get('attentionSchedule')),
    representatives: pendingRepresentatives.map((representative, index) => ({
      ...representative,
      isPrimaryContact: Boolean(representative.isPrimaryContact || index === 0),
    })),
    subregionId,
    phone: optional(data.get('phone')),
    address: optional(data.get('address')),
    latitude: optional(data.get('latitude')),
    longitude: optional(data.get('longitude')),
  });

  storeForm.reset();
  representativeForm.reset();
  pendingRepresentatives = [];
  renderSubzoneOptions();
  renderPendingRepresentatives();
  renderPendingStores();
  setMessage('Tienda agregada a la lista. Se creara junto con el cliente.');
});

Promise.all([loadZones(), loadClassifications(), loadDocumentTypes(), loadClients(), loadEconomicActivities()]).catch((error) => {
  clientsBody.innerHTML = '<tr><td class="empty-state" colspan="7">No fue posible cargar los clientes.</td></tr>';
  setMessage(error.message || 'No se pudieron cargar los clientes', true);
});

renderPendingStores();
renderPendingRepresentatives();
renderPendingClientReferences();
renderPendingClientDocuments();
renderExistingClientReferences();
renderExistingClientDocuments();
}
