const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('clients-session');
const logoutButton = document.getElementById('logout-button');
const clientForm = document.getElementById('client-form');
const storeForm = document.getElementById('store-form');
const message = document.getElementById('clients-message');
const createClientButton = document.getElementById('create-client-button');
const addStoreButton = document.getElementById('add-store-button');
const lookupTaxpayerButton = document.getElementById('lookup-taxpayer-button');
const refreshButton = document.getElementById('refresh-clients-button');
const clientsBody = document.getElementById('clients-body');
const pendingStoresList = document.getElementById('pending-stores-list');
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
let pendingStores = [];
let selectedStoreLocation;
let storeMap;
let storeMarker;
const COSTA_RICA_CENTER = { latitude: 9.7489, longitude: -83.7534 };
const COSTA_RICA_BOUNDS = {
  north: 11.3,
  south: 8.0,
  west: -86.2,
  east: -82.3,
};
let mapState = { centerLat: COSTA_RICA_CENTER.latitude, centerLng: COSTA_RICA_CENTER.longitude };

if (!session?.token || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
  window.location.href = '/';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

function authHeaders() {
  return {
    Authorization: `Bearer ${session.token}`,
    'Content-Type': 'application/json',
  };
}

function optional(value) {
  const normalized = value?.toString().trim();
  return normalized || undefined;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = 'message';
  if (isError) {
    message.classList.add('error');
  }
}

function setMapMessage(text, isError = false) {
  storeMapMessage.textContent = text;
  storeMapMessage.className = 'message';
  if (isError) {
    storeMapMessage.classList.add('error');
  }
}

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

function renderClients() {
  if (!clients.length) {
    clientsBody.innerHTML = '<tr><td class="empty-state" colspan="4">No hay clientes registrados.</td></tr>';
    renderClientOptions();
    return;
  }

  clientsBody.innerHTML = clients
    .map((client) => {
      const stores = client.stores?.length
        ? client.stores.map((store) => {
          const location = [store.region?.name, store.subregion?.name].filter(Boolean).join(' / ') || 'Sin zona';
          return `<span>${store.name} (${location})</span>`;
        }).join('')
        : '<span>Sin tiendas</span>';

      return `
        <tr>
          <td>
            <strong>${client.name}</strong>
            <div class="permission-tags">${stores}</div>
          </td>
          <td>${client.code || '-'}</td>
          <td>${client.phone || '-'}</td>
          <td>${client.storesCount || 0}</td>
        </tr>
      `;
    })
    .join('');

  renderClientOptions();
}

function zoneLabel(regionId) {
  return zones.find((zone) => zone.id === regionId)?.name || 'Sin zona';
}

function subzoneLabel(regionId, subregionId) {
  const zone = zones.find((item) => item.id === regionId);
  return zone?.subregions?.find((subzone) => subzone.id === subregionId)?.name || 'Sin subzona';
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
          <p class="muted">${zoneLabel(store.regionId)} / ${subzoneLabel(store.regionId, store.subregionId)}</p>
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lngToPercent(longitude) {
  return ((longitude - COSTA_RICA_BOUNDS.west) / (COSTA_RICA_BOUNDS.east - COSTA_RICA_BOUNDS.west)) * 100;
}

function latToPercent(latitude) {
  return ((COSTA_RICA_BOUNDS.north - latitude) / (COSTA_RICA_BOUNDS.north - COSTA_RICA_BOUNDS.south)) * 100;
}

function percentToLng(percent) {
  return COSTA_RICA_BOUNDS.west + (percent / 100) * (COSTA_RICA_BOUNDS.east - COSTA_RICA_BOUNDS.west);
}

function percentToLat(percent) {
  return COSTA_RICA_BOUNDS.north - (percent / 100) * (COSTA_RICA_BOUNDS.north - COSTA_RICA_BOUNDS.south);
}

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
  createClientButton.textContent = 'Creando...';

  const data = new FormData(clientForm);
  const clientName = data.get('name').toString().trim();
  const payload = {
    name: clientName,
    code: optional(data.get('code')),
    legalName: optional(data.get('legalName')) || clientName,
    commercialName: optional(data.get('commercialName')) || clientName,
    legalId: optional(data.get('legalId')),
    documentType: optional(data.get('documentType')),
    economicActivityCode: optional(data.get('economicActivityCode')),
    economicActivityName: optional(data.get('economicActivityName')),
    emailBilling: optional(data.get('emailBilling')),
    phone: optional(data.get('phone')),
    address: optional(data.get('address')),
  };

  try {
    const response = await fetch('/api/clients/company', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo crear el cliente');
    }

    for (const store of pendingStores) {
      const storeResponse = await fetch(`/api/clients/company/${result.id}/stores`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(store),
      });
      const storeResult = await storeResponse.json();
      if (!storeResponse.ok) {
        throw new Error(storeResult.message || `No se pudo crear la tienda ${store.name}`);
      }
    }

    clientForm.reset();
    storeForm.reset();
    pendingStores = [];
    renderPendingStores();
    renderSubzoneOptions();
    setMessage('Cliente creado correctamente');
    await loadClients();
  } catch (error) {
    setMessage(error.message || 'No se pudo crear el cliente', true);
  } finally {
    createClientButton.disabled = false;
    createClientButton.textContent = 'Crear cliente';
  }
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
    regionId,
    subregionId,
    phone: optional(data.get('phone')),
    address: optional(data.get('address')),
    latitude: optional(data.get('latitude')),
    longitude: optional(data.get('longitude')),
  });

  storeForm.reset();
  renderSubzoneOptions();
  renderPendingStores();
  setMessage('Tienda agregada a la lista. Se creara junto con el cliente.');
});

Promise.all([loadZones(), loadClients(), loadEconomicActivities()]).catch((error) => {
  clientsBody.innerHTML = '<tr><td class="empty-state" colspan="4">No fue posible cargar los clientes.</td></tr>';
  setMessage(error.message || 'No se pudieron cargar los clientes', true);
});

renderPendingStores();
}
