const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();
const sessionLabel = document.getElementById('agent-session');
const logoutButton = document.getElementById('logout-button');
const refreshButton = document.getElementById('refresh-agent-button');
const storeNameFilter = document.getElementById('agent-store-name-filter');
const zoneFilter = document.getElementById('agent-zone-filter');
const clearFiltersButton = document.getElementById('clear-agent-filters-button');
const routesCount = document.getElementById('agent-routes-count');
const pendingCount = document.getElementById('agent-pending-count');
const nearLimitCount = document.getElementById('agent-near-limit-count');
const goalsCount = document.getElementById('agent-goals-count');
const openGoalsButton = document.getElementById('open-agent-goals-button');
const closeGoalsButton = document.getElementById('close-agent-goals-button');
const goalsModal = document.getElementById('agent-goals-modal');
const openMapButton = document.getElementById('open-agent-map-button');
const closeMapButton = document.getElementById('close-agent-map-button');
const mapModal = document.getElementById('agent-map-modal');
const mapClientFilter = document.getElementById('agent-map-client-filter');
const mapClientList = document.getElementById('agent-map-client-list');
const storesCaption = document.getElementById('agent-stores-caption');
const storesList = document.getElementById('agent-stores-list');
const storeDetailCaption = document.getElementById('agent-store-detail-caption');
const storeDetail = document.getElementById('agent-store-detail');
const purchaseHistory = document.getElementById('agent-purchase-history');
const productsList = document.getElementById('agent-products-list');
const goalsList = document.getElementById('agent-goals-list');
const agentMessage = document.getElementById('agent-message');
const visitForm = document.getElementById('agent-visit-form');
const submitVisitButton = document.getElementById('submit-agent-visit-button');
const openVisitPageButton = document.getElementById('open-visit-page-button');
const openOrderEntryButton = document.getElementById('open-order-entry-button');
const mapCaption = document.getElementById('agent-map-caption');
let dashboard = null;
let storesData = [];
let goalsData = [];
const workspaceParams = new URLSearchParams(window.location.search);
let selectedStoreId = workspaceParams.get('storeId');
let selectedStoreDetail = null;
let agentMap;
let agentMarkersLayer;
let lastModalTrigger = null;
const COSTA_RICA_CENTER = [9.7489, -83.7534];
const STATUS_LABELS = {
  VENCIDA: 'Vencida',
  PROXIMA_A_VENCER: 'Proxima a vencer',
  NUEVA: 'Nueva tienda',
  AL_DIA: 'Al dia',
};
const INVOICE_STATUS_LABELS = {
  PAGADA: 'Pagada',
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  VENCIDA: 'Vencida',
};

if (!session?.user || !session?.user?.companyId) {
  window.location.href = '/';
}

function setMessage(text, isError = false) {
  agentMessage.textContent = text;
  agentMessage.className = 'message';
  if (isError) {
    agentMessage.classList.add('error');
  }
}

function currency(value) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(value || 0));
}

function formatDate(value, withTime = false) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('es-CR', withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' });
}

function ensureMap() {
  if (!window.L || agentMap) {
    return;
  }

  agentMap = L.map('agent-map').setView(COSTA_RICA_CENTER, 8);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(agentMap);
  agentMarkersLayer = L.layerGroup().addTo(agentMap);
}

function filteredStores() {
  const name = storeNameFilter.value.trim().toLowerCase();
  const zone = zoneFilter.value.trim().toLowerCase();

  return storesData.filter((store) => {
    const matchesName = !name || `${store.name} ${store.clientName || ''}`.toLowerCase().includes(name);
    const matchesZone = !zone || `${store.regionName || ''} ${store.subregionName || ''}`.toLowerCase().includes(zone);
    return matchesName && matchesZone;
  });
}

function mapFilteredStores() {
  const query = mapClientFilter.value.trim().toLowerCase();
  const stores = filteredStores();
  if (!query) {
    return stores;
  }
  return stores.filter((store) => `${store.clientName || ''} ${store.name || ''}`.toLowerCase().includes(query));
}

function updateActionButtons() {
  const hasStore = Boolean(selectedStoreId);
  openVisitPageButton.disabled = !hasStore;
  openOrderEntryButton.disabled = !hasStore;
}

function renderSummary() {
  routesCount.textContent = dashboard?.summary?.routesAssignedCount || 0;
  pendingCount.textContent = dashboard?.summary?.storesToVisitCount || 0;
  nearLimitCount.textContent = dashboard?.summary?.nearLimitCount || 0;
  goalsCount.textContent = goalsData.length;
}

function renderStores() {
  const stores = filteredStores();
  storesCaption.textContent = `${stores.length} tienda(s) visibles`;

  if (!stores.length) {
    storesList.innerHTML = '<p class="muted">No hay tiendas con esos filtros.</p>';
    return;
  }

  storesList.innerHTML = stores.map((store) => `
    <button class="agent-store-card ${String(store.id) === String(selectedStoreId) ? 'selected' : ''}" type="button" data-store-id="${store.id}">
      <div class="agent-store-card-top">
        <strong>${store.name}</strong>
        <span class="badge ${store.status === 'VENCIDA' ? 'badge-warning' : 'badge-success'}">${STATUS_LABELS[store.status] || store.status}</span>
      </div>
      <span class="muted">${store.clientName || 'Sin cliente'} - ${store.routeCode || 'Sin ruta'}</span>
      <span class="muted">${store.regionName || '-'} / ${store.subregionName || '-'}</span>
      <div class="route-agent-stats">
        <span>${store.daysSinceReference} dia(s)</span>
        <span>${currency(store.pendingBalance)}</span>
      </div>
    </button>
  `).join('');
}

function renderMap() {
  const stores = mapFilteredStores().filter((store) => store.latitude !== null && store.longitude !== null);
  ensureMap();
  if (!agentMap || !agentMarkersLayer) {
    return;
  }

  agentMarkersLayer.clearLayers();

  if (!stores.length) {
    mapCaption.textContent = mapClientFilter.value.trim()
      ? 'No hay clientes asignados con coordenadas para ese filtro.'
      : 'No hay tiendas con coordenadas para el filtro actual.';
    agentMap.setView(COSTA_RICA_CENTER, 8);
    return;
  }

  const bounds = [];
  stores.forEach((store) => {
    const marker = L.marker([store.latitude, store.longitude]).bindPopup(`
      <strong>${store.name}</strong><br />
      ${store.clientName || '-'}<br />
      ${store.regionName || '-'} / ${store.subregionName || '-'}
    `);
    marker.on('click', () => {
      selectedStoreId = store.id;
      renderStores();
      renderMapClientList();
      loadSelectedStoreDetail().catch((error) => {
        setMessage(error.message || 'No se pudo cargar la ficha de tienda', true);
      });
    });
    if (String(store.id) === String(selectedStoreId)) {
      marker.openPopup();
    }
    marker.addTo(agentMarkersLayer);
    bounds.push([store.latitude, store.longitude]);
  });

  mapCaption.textContent = `Mostrando ${stores.length} tienda(s) en el mapa.`;
  if (bounds.length === 1) {
    agentMap.setView(bounds[0], 13);
  } else {
    agentMap.fitBounds(bounds, { padding: [24, 24] });
  }
}

function renderMapClientList() {
  const stores = mapFilteredStores();
  if (!stores.length) {
    mapClientList.innerHTML = '<p class="muted">No hay clientes asignados para ese filtro.</p>';
    return;
  }

  mapClientList.innerHTML = stores.map((store) => `
    <button class="agent-map-client-card ${String(store.id) === String(selectedStoreId) ? 'selected' : ''}" type="button" data-map-store-id="${store.id}">
      <strong>${store.clientName || 'Sin cliente'}</strong>
      <span>${store.name || 'Sin tienda'}</span>
      <small>${store.regionName || '-'} / ${store.subregionName || '-'}</small>
    </button>
  `).join('');
}

function renderInvoiceCard(invoice) {
  const badgeClass = invoice.status === 'VENCIDA' || invoice.status === 'PARCIAL' ? 'badge-warning' : 'badge-success';
  return `
    <div class="agent-block-card">
      <div class="agent-store-card-top">
        <strong>Factura #${invoice.number}</strong>
        <span class="badge ${badgeClass}">${INVOICE_STATUS_LABELS[invoice.status] || invoice.status}</span>
      </div>
      <span class="muted">Emision: ${formatDate(invoice.issuedAt)}</span>
      <span class="muted">Vencimiento: ${formatDate(invoice.dueAt)}</span>
      <div class="route-agent-stats">
        <span>Monto ${currency(invoice.originalAmount)}</span>
        <span>Abonado ${currency(invoice.appliedAmount)}</span>
      </div>
      <strong>Saldo pendiente: ${currency(invoice.pendingAmount)}</strong>
    </div>
  `;
}

function renderStoreDetail() {
  updateActionButtons();
  if (!selectedStoreDetail?.store) {
    storeDetailCaption.textContent = 'Seleccione una tienda para ver su detalle.';
    storeDetail.innerHTML = '<p class="muted">Sin detalle cargado.</p>';
    purchaseHistory.innerHTML = '<p class="muted">Seleccione una tienda para ver compras.</p>';
    productsList.innerHTML = '<p class="muted">Seleccione una tienda para ver productos.</p>';
    return;
  }

  const { store, latestVisit, purchaseHistory: history, sellableProducts } = selectedStoreDetail;
  storeDetailCaption.textContent = `${store.name} - ${store.routeCode || 'Sin ruta'}`;
  storeDetail.innerHTML = [
    ['Cliente', store.clientName || '-'],
    ['Razon social', store.legalEntityName || '-'],
    ['Zona', `${store.regionName || '-'} / ${store.subregionName || '-'}`],
    ['Telefono', store.phone || '-'],
    ['Direccion', store.address || '-'],
    ['Referencia', store.locationReference || '-'],
    ['Ultima visita', latestVisit?.visitedAt ? formatDate(latestVisit.visitedAt, true) : 'Sin visitas'],
    ['Ultimo comentario', latestVisit?.comment || store.latestVisitComment || '-'],
    ['Proxima sugerida', latestVisit?.suggestedNextVisitAt ? formatDate(latestVisit.suggestedNextVisitAt, true) : '-'],
    ['Saldo pendiente', currency(history?.pendingBalance || 0)],
  ].map(([label, value]) => `
    <article class="detail-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');

  const reps = store.representatives?.length
    ? store.representatives.map((rep) => `<li>${rep.fullName}${rep.position ? ` - ${rep.position}` : ''}${rep.phonePrimary ? ` - ${rep.phonePrimary}` : ''}</li>`).join('')
    : '<li>Sin empleados o contactos cargados.</li>';

  purchaseHistory.innerHTML = `
    <div class="agent-block-card">
      <strong>Empleados y contactos</strong>
      <ul>${reps}</ul>
    </div>


    ${(history?.orders || []).length ? history.orders.map((order) => `
      <div class="agent-block-card">
        <strong>Pedido #${order.orderId}</strong>
        <span class="muted">${formatDate(order.createdAt)} - ${order.status}</span>
        <div class="route-agent-stats">
          <span>Total: ${currency(order.total)}</span>
          <span>Pendiente: ${currency(order.pendingBalance)}</span>
        </div>
        <div class="agent-history-list">
          ${order.invoices?.length ? order.invoices.map(renderInvoiceCard).join('') : '<p class="muted">No hay facturas visibles para este pedido.</p>'}
        </div>
      </div>
    `).join('') : '<p class="muted">No hay compras ligadas a esta tienda.</p>'}
  `;

  productsList.innerHTML = `
    <div class="agent-products-grid">
      ${(sellableProducts?.products || []).slice(0, 8).map((product) => `
        <div class="agent-block-card">
          <strong>${product.name}</strong>
          <span class="muted">${product.code || 'Sin codigo'}</span>
          <span>${currency(product.price)}</span>
        </div>
      `).join('')}
    </div>
    <div class="agent-products-suggestions">
      <strong>Sugeridos por otras tiendas</strong>
      ${sellableProducts?.suggestions?.length
        ? sellableProducts.suggestions.map((suggestion) => `
          <div class="agent-block-card">
            <strong>${suggestion.productName || 'Producto'}</strong>
            <span class="muted">Comprado por ${suggestion.sourceStoreName || 'otra tienda'}</span>
            <span class="muted">${suggestion.lastPurchasedAt ? formatDate(suggestion.lastPurchasedAt) : 'Sin fecha'}</span>
          </div>
        `).join('')
        : '<p class="muted">No hay sugerencias cruzadas disponibles.</p>'}
    </div>
  `;
}

function renderGoals() {
  if (!goalsData.length) {
    goalsList.innerHTML = '<p class="muted">No hay metas activas para este agente.</p>';
    return;
  }

  goalsList.innerHTML = goalsData.map((goal) => `
    <article class="role-card">
      <h3>${goal.title}</h3>
      <p>${goal.periodLabel || 'Sin periodo'}</p>
      <div class="route-goal-progress">
        <div class="route-goal-progress-bar" style="width:${goal.progressPercent}%"></div>
      </div>
      <div class="route-agent-stats">
        <span>Meta ${currency(goal.targetAmount)}</span>
        <span>Avance ${currency(goal.currentAmount)}</span>
      </div>
    </article>
  `).join('');
}

function openGoalsModal() {
  lastModalTrigger = openGoalsButton;
  goalsModal.classList.remove('hidden');
  document.body.classList.add('agent-modal-open');
  closeGoalsButton.focus();
}

function closeGoalsModal() {
  goalsModal.classList.add('hidden');
  if (mapModal.classList.contains('hidden')) {
    document.body.classList.remove('agent-modal-open');
  }
  (lastModalTrigger || openGoalsButton).focus();
}

function openMapModal() {
  lastModalTrigger = openMapButton;
  mapModal.classList.remove('hidden');
  document.body.classList.add('agent-modal-open');
  renderMapClientList();
  renderMap();
  setTimeout(() => {
    if (agentMap) {
      agentMap.invalidateSize();
    }
    mapClientFilter.focus();
  }, 0);
}

function closeMapModal() {
  mapModal.classList.add('hidden');
  if (goalsModal.classList.contains('hidden')) {
    document.body.classList.remove('agent-modal-open');
  }
  (lastModalTrigger || openMapButton).focus();
}

async function loadDashboard() {
  dashboard = await inventoryAuth.fetchJson(session, '/api/agent/dashboard', {
    fallbackMessage: 'No se pudo cargar el dashboard',
  });
}

async function loadStores() {
  const params = new URLSearchParams();
  if (storeNameFilter.value.trim()) params.set('name', storeNameFilter.value.trim());
  if (zoneFilter.value.trim()) params.set('zone', zoneFilter.value.trim());
  const data = await inventoryAuth.fetchJson(session, `/api/agent/stores?${params.toString()}`, {
    fallbackMessage: 'No se pudo cargar el recorrido',
  });
  storesData = data.stores || [];
  if (!selectedStoreId && storesData.length) {
    selectedStoreId = storesData[0].id;
  }
  if (selectedStoreId && !storesData.some((store) => String(store.id) === String(selectedStoreId))) {
    selectedStoreId = storesData[0]?.id || null;
  }
}

async function loadGoals() {
  const data = await inventoryAuth.fetchJson(session, '/api/agent/goals', {
    fallbackMessage: 'No se pudieron cargar las metas',
  });
  goalsData = data.goals || [];
}

async function loadSelectedStoreDetail() {
  if (!selectedStoreId) {
    selectedStoreDetail = null;
    renderStoreDetail();
    return;
  }
  selectedStoreDetail = await inventoryAuth.fetchJson(session, `/api/agent/stores/${selectedStoreId}`, {
    fallbackMessage: 'No se pudo cargar la ficha de la tienda',
  });
  renderStoreDetail();
}

async function refreshPage() {
  setMessage('');
  await Promise.all([loadDashboard(), loadStores(), loadGoals()]);
  renderSummary();
  renderGoals();
  renderStores();
  renderMapClientList();
  renderMap();
  await loadSelectedStoreDetail();
  renderStores();
  renderMapClientList();
  renderMap();
}

logoutButton.addEventListener('click', () => {
  inventoryAuth.logout(session);
});

refreshButton.addEventListener('click', async () => {
  try {
    await refreshPage();
  } catch (error) {
    setMessage(error.message || 'No se pudo actualizar el workspace', true);
  }
});

openGoalsButton.addEventListener('click', openGoalsModal);
closeGoalsButton.addEventListener('click', closeGoalsModal);
goalsModal.addEventListener('click', (event) => {
  if (event.target === goalsModal) closeGoalsModal();
});
openMapButton.addEventListener('click', openMapModal);
closeMapButton.addEventListener('click', closeMapModal);
mapModal.addEventListener('click', (event) => {
  if (event.target === mapModal) closeMapModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !mapModal.classList.contains('hidden')) {
    closeMapModal();
  } else if (event.key === 'Escape' && !goalsModal.classList.contains('hidden')) {
    closeGoalsModal();
  }
});

storesList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-store-id]');
  if (!button) return;
  selectedStoreId = button.dataset.storeId;
  renderStores();
  renderMapClientList();
  renderMap();
  try {
    await loadSelectedStoreDetail();
  } catch (error) {
    setMessage(error.message || 'No se pudo cargar la ficha de tienda', true);
  }
});

[storeNameFilter, zoneFilter].forEach((input) => {
  input.addEventListener('input', async () => {
    try {
      await loadStores();
      renderStores();
      renderMapClientList();
      renderMap();
      await loadSelectedStoreDetail();
    } catch (error) {
      setMessage(error.message || 'No se pudieron aplicar los filtros', true);
    }
  });
});

clearFiltersButton.addEventListener('click', async () => {
  storeNameFilter.value = '';
  zoneFilter.value = '';
  try {
    await loadStores();
    renderStores();
    renderMapClientList();
    renderMap();
    await loadSelectedStoreDetail();
  } catch (error) {
    setMessage(error.message || 'No se pudieron limpiar los filtros', true);
  }
});

mapClientFilter.addEventListener('input', () => {
  renderMapClientList();
  renderMap();
});

mapClientList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-map-store-id]');
  if (!button) return;
  selectedStoreId = button.dataset.mapStoreId;
  renderStores();
  renderMapClientList();
  renderMap();
  try {
    await loadSelectedStoreDetail();
  } catch (error) {
    setMessage(error.message || 'No se pudo cargar la ficha de tienda', true);
  }
});

openVisitPageButton.addEventListener('click', () => {
  if (!selectedStoreId) {
    setMessage('Seleccione una tienda antes de abrir la visita', true);
    return;
  }
  window.location.href = `/agent/visit.html?storeId=${selectedStoreId}`;
});

openOrderEntryButton.addEventListener('click', () => {
  if (!selectedStoreId) {
    setMessage('Seleccione una tienda antes de iniciar un pedido', true);
    return;
  }
  window.location.href = `/agent/order-entry.html?storeId=${selectedStoreId}`;
});

visitForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedStoreId) {
    setMessage('Seleccione una tienda antes de registrar una visita', true);
    return;
  }

  submitVisitButton.disabled = true;
  submitVisitButton.textContent = 'Guardando...';
  setMessage('');

  const formData = new FormData(visitForm);
  const suggestedNextVisitAt = formData.get('suggestedNextVisitAt')?.toString();
  const payload = {
    clientStoreId: selectedStoreId,
    motive: formData.get('motive'),
    result: formData.get('result'),
    comment: formData.get('comment')?.toString().trim() || null,
    suggestedNextVisitAt: suggestedNextVisitAt ? new Date(suggestedNextVisitAt).toISOString() : null,
  };

  try {
    await inventoryAuth.fetchJson(session, '/api/agent/visits', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo guardar la visita',
    });
    visitForm.reset();
    setMessage('Visita registrada correctamente');
    await refreshPage();
  } catch (error) {
    setMessage(error.message || 'No se pudo guardar la visita', true);
  } finally {
    submitVisitButton.disabled = false;
    submitVisitButton.textContent = 'Guardar visita';
  }
});

sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;
updateActionButtons();
refreshPage().catch((error) => {
  setMessage(error.message || 'No se pudo cargar el workspace del agente', true);
});



