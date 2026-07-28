const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();
const sessionLabel = document.getElementById('routes-session');
const logoutButton = document.getElementById('logout-button');
const refreshButton = document.getElementById('refresh-routes-button');
const newRouteButton = document.getElementById('new-route-button');
const saveRouteButton = document.getElementById('save-route-button');
const saveSubzonesButton = document.getElementById('save-subzones-button');
const saveAssignmentsButton = document.getElementById('save-assignments-button');
const addGoalButton = document.getElementById('add-goal-button');
const saveGoalsButton = document.getElementById('save-goals-button');
const goalsAgentSelect = document.getElementById('goals-agent-select');
const routesGoalsBody = document.getElementById('routes-goals-body');
const routeSearchInput = document.getElementById('route-search-input');
const routesCount = document.getElementById('routes-count');
const routesSubzonesCount = document.getElementById('routes-subzones-count');
const routesStoresCount = document.getElementById('routes-stores-count');
const routesAgentsCount = document.getElementById('routes-agents-count');
const routesListCaption = document.getElementById('routes-list-caption');
const routesList = document.getElementById('routes-list');
const selectedRouteLabel = document.getElementById('selected-route-label');
const routeCodeInput = document.getElementById('route-code-input');
const routeNameInput = document.getElementById('route-name-input');
const routeFrequencyInput = document.getElementById('route-frequency-input');
const routeNearLimitInput = document.getElementById('route-near-limit-input');
const routesSubzonesPanel = document.getElementById('routes-subzones-panel');
const routesAssignmentsPanel = document.getElementById('routes-assignments-panel');
const routesStoresBody = document.getElementById('routes-stores-body');
const routesMapCaption = document.getElementById('routes-map-caption');
const routesMessage = document.getElementById('routes-message');
let routesData = [];
let zonesData = [];
let agentsData = [];
let selectedRouteId = null;
let selectedRouteDetail = null;
let selectedSubzoneIds = new Set();
let selectedAgentIds = new Set();
let selectedGoalsAgentId = null;
let goalsDraft = [];
let routesMap;
let routesMarkersLayer;
const routesShared = window.RootRoutesShared;
const COSTA_RICA_CENTER = [9.7489, -83.7534];

if (!session?.user || !session?.user?.companyId || !['admin', 'sales_supervisor'].includes(session?.user?.role?.code)) {
  window.location.href = '/';
}

const setMessage = (text, isError = false) => routesShared.setMessage(routesMessage, text, isError);
const metricValue = routesShared.metricValue;

function filteredRoutes() {
  return routesShared.filterRoutes(routesData, routeSearchInput.value);
}

function ensureRoutesMap() {
  if (!window.L || routesMap) return;
  routesMap = L.map('routes-map').setView(COSTA_RICA_CENTER, 8);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(routesMap);
  routesMarkersLayer = L.layerGroup().addTo(routesMap);
}

function resetDraftRoute() {
  selectedRouteId = null;
  selectedRouteDetail = null;
  selectedSubzoneIds = new Set();
  selectedAgentIds = new Set();
  routeCodeInput.value = '';
  routeNameInput.value = '';
  routeFrequencyInput.value = '15';
  routeNearLimitInput.value = '3';
  selectedRouteLabel.textContent = 'Nueva ruta';
}

function syncDraftFromDetail() {
  if (!selectedRouteDetail) {
    resetDraftRoute();
    return;
  }

  routeCodeInput.value = selectedRouteDetail.code || '';
  routeNameInput.value = selectedRouteDetail.name || '';
  routeFrequencyInput.value = selectedRouteDetail.visitFrequencyDays || 15;
  routeNearLimitInput.value = selectedRouteDetail.nearLimitDays || 3;
  selectedSubzoneIds = new Set((selectedRouteDetail.subzoneIds || []).map(String));
  selectedAgentIds = new Set((selectedRouteDetail.agentIds || []).map(String));
  selectedRouteLabel.textContent = `Ruta ${selectedRouteDetail.code} · ${selectedRouteDetail.name}`;
}

function renderSummary() {
  const summary = {
    routesCount: routesData.length,
    subzonesCount: routesData.reduce((total, route) => total + Number(route.subzonesCount || 0), 0),
    storesCount: routesData.reduce((total, route) => total + Number(route.storesCount || 0), 0),
    agentsCount: new Set(routesData.flatMap((route) => (route.agentIds || []).map(String))).size,
  };

  routesCount.textContent = metricValue(summary.routesCount);
  routesSubzonesCount.textContent = metricValue(summary.subzonesCount);
  routesStoresCount.textContent = metricValue(summary.storesCount);
  routesAgentsCount.textContent = metricValue(summary.agentsCount);
}

function renderRoutesList() {
  const visibleRoutes = filteredRoutes();
  routesListCaption.textContent = `${visibleRoutes.length} ruta(s)`;

  if (!routesData.length) {
    routesList.innerHTML = '<p class="muted">No hay rutas creadas.</p>';
    return;
  }

  if (!visibleRoutes.length) {
    routesList.innerHTML = '<p class="muted">No hay rutas con ese filtro.</p>';
    return;
  }

  routesList.innerHTML = visibleRoutes.map((route) => `
    <button class="route-agent-card ${String(route.id) === String(selectedRouteId) ? 'selected' : ''}" type="button" data-route-id="${route.id}">
      <div class="route-agent-card-top">
        <strong>${route.code}</strong>
        <span class="badge ${route.isActive ? 'badge-success' : 'badge-warning'}">${route.isActive ? 'Activa' : 'Inactiva'}</span>
      </div>
      <span class="route-agent-username">${route.name}</span>
      <div class="route-agent-stats">
        <span>${route.subzonesCount} subzona(s)</span>
        <span>${route.storesCount} tienda(s)</span>
        <span>${route.assignmentsCount} agente(s)</span>
      </div>
    </button>
  `).join('');
}

function renderSubzonesPanel() {
  const selectedIds = selectedSubzoneIds;
  routesSubzonesPanel.innerHTML = zonesData.map((zone) => `
    <section class="route-zone-group">
      <header>
        <h3>${zone.name}</h3>
        <p class="muted">${(zone.subregions || []).length} subzona(s)</p>
      </header>
      <div class="route-subzone-list">
        ${(zone.subregions || []).map((subregion) => `
          <label class="permission-option route-subzone-option">
            <input type="checkbox" value="${subregion.id}" ${selectedIds.has(String(subregion.id)) ? 'checked' : ''} />
            <span>
              <strong>${subregion.name}</strong>
              <small>${subregion.routeCode || 'Sin codigo'} / ${zone.name}</small>
            </span>
          </label>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function renderAssignmentsPanel() {
  if (!agentsData.length) {
    routesAssignmentsPanel.innerHTML = '<p class="muted">No hay agentes comerciales disponibles.</p>';
    return;
  }

  routesAssignmentsPanel.innerHTML = agentsData.map((agent) => `
    <label class="permission-option route-subzone-option">
      <input type="checkbox" value="${agent.id}" ${selectedAgentIds.has(String(agent.id)) ? 'checked' : ''} />
      <span>
        <strong>${agent.fullName}</strong>
        <small>@${agent.username} · ${agent.role?.name || 'Sin rol'}</small>
      </span>
    </label>
  `).join('');
}

const emptyGoal = routesShared.emptyGoal;

function renderGoalsAgentSelect() {
  const options = agentsData.map((agent) => `
    <option value="${agent.id}" ${String(agent.id) === String(selectedGoalsAgentId) ? 'selected' : ''}>
      ${agent.fullName} (@${agent.username})
    </option>
  `).join('');
  goalsAgentSelect.innerHTML = `<option value="">Seleccione un agente</option>${options}`;
}

function renderGoalsTable() {
  const hasAgent = Boolean(selectedGoalsAgentId);
  addGoalButton.disabled = !hasAgent;
  saveGoalsButton.disabled = !hasAgent;

  if (!hasAgent) {
    routesGoalsBody.innerHTML = '<tr><td class="empty-state" colspan="6">Seleccione un agente para administrar sus metas.</td></tr>';
    return;
  }
  if (!goalsDraft.length) {
    routesGoalsBody.innerHTML = '<tr><td class="empty-state" colspan="6">El agente no tiene metas. Use "Agregar meta" para crear una.</td></tr>';
    return;
  }

  routesGoalsBody.innerHTML = goalsDraft.map((goal, index) => `
    <tr data-goal-index="${index}">
      <td><input class="table-input" data-field="title" value="${goal.title || ''}" maxlength="120" required /></td>
      <td><input class="table-input" data-field="periodLabel" value="${goal.periodLabel || ''}" maxlength="80" /></td>
      <td><input class="table-input" data-field="targetAmount" type="number" min="0" step="0.01" value="${goal.targetAmount || 0}" /></td>
      <td><input class="table-input" data-field="currentAmount" type="number" min="0" step="0.01" value="${goal.currentAmount || 0}" /></td>
      <td><input class="table-input" data-field="notes" value="${goal.notes || ''}" maxlength="500" /></td>
      <td><button class="secondary-button" type="button" data-remove-goal="${index}">Quitar</button></td>
    </tr>
  `).join('');
}

function selectGoalsAgent(agentId) {
  selectedGoalsAgentId = agentId || null;
  const agent = agentsData.find((item) => String(item.id) === String(selectedGoalsAgentId));
  goalsDraft = (agent?.goals || []).map((goal) => ({ ...goal }));
  renderGoalsAgentSelect();
  renderGoalsTable();
}

function currentStores() {
  return selectedRouteDetail?.stores || [];
}

function renderStoresTable() {
  const stores = currentStores();
  if (!selectedRouteDetail) {
    routesStoresBody.innerHTML = '<tr><td class="empty-state" colspan="5">Seleccione una ruta para ver su cobertura.</td></tr>';
    return;
  }
  if (!stores.length) {
    routesStoresBody.innerHTML = '<tr><td class="empty-state" colspan="5">Esta ruta aun no cubre tiendas activas.</td></tr>';
    return;
  }
  routesStoresBody.innerHTML = stores.map((store) => `
    <tr>
      <td><strong>${store.name}</strong></td>
      <td>${store.clientName || '-'}</td>
      <td>${store.regionName || '-'} / ${store.subregionName || '-'}</td>
      <td>${store.phone || '-'}</td>
      <td>${store.latitude !== null && store.longitude !== null ? `${store.latitude}, ${store.longitude}` : 'Sin coordenadas'}</td>
    </tr>
  `).join('');
}

function renderMap() {
  const stores = currentStores().filter((store) => store.latitude !== null && store.longitude !== null);
  ensureRoutesMap();
  if (!routesMap || !routesMarkersLayer) return;
  routesMarkersLayer.clearLayers();

  if (!selectedRouteDetail) {
    routesMapCaption.textContent = 'Seleccione una ruta para ver su cobertura.';
    routesMap.setView(COSTA_RICA_CENTER, 8);
    return;
  }

  if (!stores.length) {
    routesMapCaption.textContent = 'La ruta seleccionada no tiene tiendas con coordenadas registradas.';
    routesMap.setView(COSTA_RICA_CENTER, 8);
    return;
  }

  const bounds = [];
  stores.forEach((store) => {
    const marker = L.marker([store.latitude, store.longitude]).bindPopup(`
      <strong>${store.name}</strong><br />
      ${store.clientName || '-'}<br />
      ${store.regionName || '-'} / ${store.subregionName || '-'}
    `);
    marker.addTo(routesMarkersLayer);
    bounds.push([store.latitude, store.longitude]);
  });

  routesMapCaption.textContent = `Se muestran ${stores.length} tienda(s) con coordenadas dentro de la ruta.`;
  if (bounds.length === 1) {
    routesMap.setView(bounds[0], 13);
  } else {
    routesMap.fitBounds(bounds, { padding: [24, 24] });
  }
}

function renderAll() {
  renderSummary();
  renderRoutesList();
  renderSubzonesPanel();
  renderAssignmentsPanel();
  renderGoalsAgentSelect();
  renderGoalsTable();
  renderStoresTable();
  renderMap();
}

async function loadOverview() {
  const data = await inventoryAuth.fetchJson(session, '/api/sales-routes/company', {
    fallbackMessage: 'No se pudo cargar la consola de rutas',
  });

  routesData = data.routes || [];
  zonesData = data.zones || [];
  agentsData = data.agents || [];

  if (selectedGoalsAgentId && !agentsData.some((agent) => String(agent.id) === String(selectedGoalsAgentId))) {
    selectedGoalsAgentId = null;
    goalsDraft = [];
  }

  if (selectedRouteId && !routesData.some((route) => String(route.id) === String(selectedRouteId))) {
    selectedRouteId = null;
    selectedRouteDetail = null;
  }
}

async function loadRouteDetail() {
  if (!selectedRouteId) {
    selectedRouteDetail = null;
    syncDraftFromDetail();
    renderAll();
    return;
  }

  const data = await inventoryAuth.fetchJson(session, `/api/sales-routes/company/${selectedRouteId}`, {
    fallbackMessage: 'No se pudo cargar el detalle de la ruta',
  });

  selectedRouteDetail = data;
  syncDraftFromDetail();
  renderAll();
}

function buildRoutePayload() {
  return {
    code: routeCodeInput.value.trim(),
    name: routeNameInput.value.trim(),
    visitFrequencyDays: Number(routeFrequencyInput.value || 15),
    nearLimitDays: Number(routeNearLimitInput.value || 3),
    isActive: true,
  };
}

async function saveRoute() {
  const payload = buildRoutePayload();
  const url = selectedRouteId ? `/api/sales-routes/company/${selectedRouteId}` : '/api/sales-routes/company';
  const method = selectedRouteId ? 'PUT' : 'POST';
  const data = await inventoryAuth.fetchJson(session, url, {
    method,
    body: JSON.stringify(payload),
    fallbackMessage: 'No se pudo guardar la ruta',
  });

  selectedRouteId = data.id;
  await loadOverview();
  await loadRouteDetail();
}

async function saveSubzones() {
  if (!selectedRouteId) {
    throw new Error('Primero guarde o seleccione una ruta');
  }
  const data = await inventoryAuth.fetchJson(session, `/api/sales-routes/company/${selectedRouteId}/subzones`, {
    method: 'PUT',
    body: JSON.stringify({ subregionIds: [...selectedSubzoneIds] }),
    fallbackMessage: 'No se pudieron guardar las subzonas',
  });

  selectedRouteDetail = data;
  syncDraftFromDetail();
  await loadOverview();
  renderAll();
}

async function saveAssignments() {
  if (!selectedRouteId) {
    throw new Error('Primero guarde o seleccione una ruta');
  }
  const data = await inventoryAuth.fetchJson(session, `/api/sales-routes/company/${selectedRouteId}/assignments`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: [...selectedAgentIds] }),
    fallbackMessage: 'No se pudieron guardar los agentes',
  });

  selectedRouteDetail = data;
  syncDraftFromDetail();
  await loadOverview();
  renderAll();
}

async function saveGoals() {
  if (!selectedGoalsAgentId) {
    throw new Error('Seleccione un agente antes de guardar metas');
  }
  if (goalsDraft.some((goal) => !goal.title.trim())) {
    throw new Error('Cada meta debe tener un nombre');
  }

  await inventoryAuth.fetchJson(session, `/api/sales-routes/company/agents/${selectedGoalsAgentId}/goals`, {
    method: 'PUT',
    body: JSON.stringify({ goals: goalsDraft }),
    fallbackMessage: 'No se pudieron guardar las metas',
  });

  await loadOverview();
  selectGoalsAgent(selectedGoalsAgentId);
}

async function refreshPage() {
  setMessage('');
  await loadOverview();
  renderAll();
  await loadRouteDetail();
}

logoutButton.addEventListener('click', () => {
  window.InventoryAuth.logout(session);
});

refreshButton.addEventListener('click', async () => {
  try {
    await refreshPage();
  } catch (error) {
    setMessage(error.message || 'No se pudo actualizar la pantalla de rutas', true);
  }
});

newRouteButton.addEventListener('click', () => {
  resetDraftRoute();
  renderAll();
});

saveRouteButton.addEventListener('click', async () => {
  saveRouteButton.disabled = true;
  saveRouteButton.textContent = 'Guardando...';
  try {
    await saveRoute();
    setMessage('Ruta guardada correctamente');
  } catch (error) {
    setMessage(error.message || 'No se pudo guardar la ruta', true);
  } finally {
    saveRouteButton.disabled = false;
    saveRouteButton.textContent = 'Guardar ruta';
  }
});

saveSubzonesButton.addEventListener('click', async () => {
  saveSubzonesButton.disabled = true;
  saveSubzonesButton.textContent = 'Guardando...';
  try {
    await saveSubzones();
    setMessage('Subzonas guardadas correctamente');
  } catch (error) {
    setMessage(error.message || 'No se pudieron guardar las subzonas', true);
  } finally {
    saveSubzonesButton.disabled = false;
    saveSubzonesButton.textContent = 'Guardar subzonas';
  }
});

saveAssignmentsButton.addEventListener('click', async () => {
  saveAssignmentsButton.disabled = true;
  saveAssignmentsButton.textContent = 'Guardando...';
  try {
    await saveAssignments();
    setMessage('Agentes guardados correctamente');
  } catch (error) {
    setMessage(error.message || 'No se pudieron guardar los agentes', true);
  } finally {
    saveAssignmentsButton.disabled = false;
    saveAssignmentsButton.textContent = 'Guardar agentes';
  }
});

goalsAgentSelect.addEventListener('change', () => {
  selectGoalsAgent(goalsAgentSelect.value);
});

addGoalButton.addEventListener('click', () => {
  if (!selectedGoalsAgentId) return;
  goalsDraft.push(emptyGoal());
  renderGoalsTable();
});

routesGoalsBody.addEventListener('input', (event) => {
  const row = event.target.closest('[data-goal-index]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const index = Number(row.dataset.goalIndex);
  const numericFields = new Set(['targetAmount', 'currentAmount']);
  goalsDraft[index][field] = numericFields.has(field) ? Number(event.target.value || 0) : event.target.value;
});

routesGoalsBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-goal]');
  if (!button) return;
  goalsDraft.splice(Number(button.dataset.removeGoal), 1);
  renderGoalsTable();
});

saveGoalsButton.addEventListener('click', async () => {
  saveGoalsButton.disabled = true;
  saveGoalsButton.textContent = 'Guardando...';
  try {
    await saveGoals();
    setMessage('Metas guardadas correctamente');
  } catch (error) {
    setMessage(error.message || 'No se pudieron guardar las metas', true);
  } finally {
    saveGoalsButton.disabled = !selectedGoalsAgentId;
    saveGoalsButton.textContent = 'Guardar metas';
  }
});

routeSearchInput.addEventListener('input', renderRoutesList);

routesList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-route-id]');
  if (!button) return;
  selectedRouteId = button.dataset.routeId;
  renderRoutesList();
  try {
    await loadRouteDetail();
  } catch (error) {
    setMessage(error.message || 'No se pudo cargar el detalle de la ruta', true);
  }
});

routesSubzonesPanel.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked) selectedSubzoneIds.add(checkbox.value);
  else selectedSubzoneIds.delete(checkbox.value);
});

routesAssignmentsPanel.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked) selectedAgentIds.add(checkbox.value);
  else selectedAgentIds.delete(checkbox.value);
});

sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;
refreshPage().catch((error) => {
  routesList.innerHTML = '<p class="muted">No fue posible cargar las rutas comerciales.</p>';
  setMessage(error.message || 'No se pudo cargar la pantalla de rutas', true);
});

