const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();

const sessionLabel = document.getElementById('warehouses-session');
const logoutButton = document.getElementById('logout-button');
const refreshButton = document.getElementById('refresh-warehouses-button');
const warehouseForm = document.getElementById('warehouse-form');
const warehouseFilterForm = document.getElementById('warehouse-filter-form');
const typeHint = document.getElementById('warehouse-type-hint');
const message = document.getElementById('warehouses-message');
const warehousesList = document.getElementById('warehouses-list');
const createWarehouseButton = document.getElementById('create-warehouse-button');
const typeSelect = warehouseForm.elements.warehouseType;
const sellableCheckbox = warehouseForm.elements.isSellableSource;
const activeCheckbox = warehouseForm.elements.isActive;
const searchInput = document.getElementById('warehouse-search-input');
const typeFilter = document.getElementById('warehouse-type-filter');

const summaryTotal = document.getElementById('summary-total');
const summaryActive = document.getElementById('summary-active');
const summarySellable = document.getElementById('summary-sellable');
const summaryVirtual = document.getElementById('summary-virtual');

let warehouses = [];
let warehouseTypes = [];

if (!session?.user || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
  window.location.href = '/';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = 'message';
  if (isError) {
    message.classList.add('error');
  }
}

function renderSummary(summary) {
  summaryTotal.textContent = String(summary?.total || 0);
  summaryActive.textContent = String(summary?.active || 0);
  summarySellable.textContent = String(summary?.sellable || 0);
  summaryVirtual.textContent = String(summary?.virtual || 0);
}

function renderTypeOptions() {
  const options = warehouseTypes
    .map((type) => `<option value="${type.value}">${type.label}</option>`)
    .join('');

  typeSelect.innerHTML = `<option value="">Seleccione un tipo</option>${options}`;
  typeFilter.innerHTML = `<option value="">Todos</option>${options}`;
}

function updateTypeHint() {
  const selected = warehouseTypes.find((type) => type.value === typeSelect.value);
  if (!selected) {
    typeHint.textContent = '';
    sellableCheckbox.checked = false;
    sellableCheckbox.disabled = false;
    return;
  }

  typeHint.textContent = selected.description;
  sellableCheckbox.checked = selected.defaultSellableSource;
  sellableCheckbox.disabled = selected.isVirtual;
}

function getFilteredWarehouses() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;

  return warehouses.filter((warehouse) => {
    const matchesQuery = !query
      || `${warehouse.name} ${warehouse.code}`.toLowerCase().includes(query);
    const matchesType = !selectedType || warehouse.warehouseType === selectedType;
    return matchesQuery && matchesType;
  });
}

function buildBadges(warehouse) {
  const badges = [
    warehouse.warehouseTypeLabel,
    warehouse.isVirtual ? 'Virtual' : 'Fisica',
    warehouse.isSellableSource ? 'Fuente de venta' : 'Sin despacho',
    warehouse.isActive ? 'Activa' : 'Inactiva',
  ];

  return badges.map((badge) => `<span>${badge}</span>`).join('');
}

function renderWarehouses() {
  const filteredWarehouses = getFilteredWarehouses();

  if (!filteredWarehouses.length) {
    warehousesList.innerHTML = '<p class="muted">No hay bodegas que coincidan con el filtro actual.</p>';
    return;
  }

  warehousesList.innerHTML = filteredWarehouses
    .map((warehouse) => `
      <article class="role-card">
        <div>
          <h3>${warehouse.name}</h3>
          <p class="muted">${warehouse.code} · ${warehouse.warehouseTypeDescription}</p>
        </div>
        <div class="permission-tags">
          ${buildBadges(warehouse)}
        </div>
      </article>
    `)
    .join('');
}

async function loadWarehouses() {
  const data = await inventoryAuth.fetchJson(session, '/api/warehouses/company', {
    fallbackMessage: 'No se pudieron cargar las bodegas',
  });

  warehouses = data.items || [];
  warehouseTypes = data.warehouseTypes || [];
  renderSummary(data.summary);
  renderTypeOptions();
  updateTypeHint();
  renderWarehouses();
}

logoutButton.addEventListener('click', () => {
  window.InventoryAuth.logout(session);
});

refreshButton.addEventListener('click', async () => {
  setMessage('');
  try {
    await loadWarehouses();
  } catch (error) {
    setMessage(error.message || 'No se pudieron cargar las bodegas', true);
  }
});

typeSelect.addEventListener('change', updateTypeHint);
searchInput.addEventListener('input', renderWarehouses);
typeFilter.addEventListener('change', renderWarehouses);
warehouseFilterForm.addEventListener('submit', (event) => event.preventDefault());

warehouseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  createWarehouseButton.disabled = true;
  createWarehouseButton.textContent = 'Creando...';

  const data = new FormData(warehouseForm);
  const payload = {
    code: data.get('code').toString().trim(),
    name: data.get('name').toString().trim(),
    warehouseType: data.get('warehouseType').toString(),
    isSellableSource: sellableCheckbox.checked,
    isActive: activeCheckbox.checked,
  };

  try {
    await inventoryAuth.fetchJson(session, '/api/warehouses/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la bodega',
    });

    warehouseForm.reset();
    activeCheckbox.checked = true;
    updateTypeHint();
    setMessage('Bodega creada correctamente');
    await loadWarehouses();
  } catch (error) {
    setMessage(error.message || 'No se pudo crear la bodega', true);
  } finally {
    createWarehouseButton.disabled = false;
    createWarehouseButton.textContent = 'Crear bodega';
  }
});

loadWarehouses().catch((error) => {
  warehousesList.innerHTML = '<p class="muted">No fue posible cargar las bodegas.</p>';
  setMessage(error.message || 'No se pudieron cargar las bodegas', true);
});
