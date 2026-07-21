const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const message = document.getElementById('products-message');
const importMessage = document.getElementById('import-message');
const importProgress = document.getElementById('import-progress');
const createProductMessage = document.getElementById('create-product-message');
const welcomeMessage = document.getElementById('welcome-message');
const productsBody = document.getElementById('products-body');
const logoutButton = document.getElementById('logout-button');
const excelFileInput = document.getElementById('excel-file');
const importButton = document.getElementById('import-button');
const importWarehouseSelect = document.getElementById('import-warehouse');
const importPreviewWrapper = document.getElementById('import-preview-wrapper');
const importPreviewBody = document.getElementById('import-preview-body');
const productForm = document.getElementById('product-form');
const createProductPanel = document.getElementById('create-product-panel');
const createProductButton = document.getElementById('create-product-button');
const addLotButton = document.getElementById('add-lot-button');
const initialLotsList = document.getElementById('initial-lots-list');
const inventoryAlertsSection = document.getElementById('inventory-alerts-section');
const refreshAlertsButton = document.getElementById('refresh-alerts-button');
const alertsMessage = document.getElementById('alerts-message');
const alertsBody = document.getElementById('alerts-body');
const alertDetailPanel = document.getElementById('alert-detail-panel');
const alertDetailContent = document.getElementById('alert-detail-content');
const lotDates = window.InventoryLotDates;

const IMPORT_CHUNK_SIZE = 100;

let currentProducts = [];
let currentAlerts = [];
let selectedAlertId = null;
let warehouses = [];
let importRows = [];
let lotRowCounter = 0;

const permissions = session?.user?.permissions || [];
const canAccessWarehouse = session?.user?.role?.code === 'warehouse' || permissions.includes('warehouse.access');
const canImportProducts = permissions.includes('products.import') || permissions.includes('products.manage');
const canManageProducts = permissions.includes('products.manage');
const canViewInventoryAlerts = permissions.includes('inventory.view') || permissions.includes('inventory.manage') || permissions.includes('inventory.qa.manage');
const canManageInventoryAlerts = permissions.includes('inventory.manage') || permissions.includes('inventory.qa.manage');

if (!session?.token || !canAccessWarehouse) {
  window.location.href = '/';
}

welcomeMessage.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

if (!canImportProducts) {
  document.querySelectorAll('.import-panel')[1]?.classList.add('hidden');
}

if (!canManageProducts) {
  createProductPanel.classList.add('hidden');
}

if (!canViewInventoryAlerts) {
  inventoryAlertsSection.classList.add('hidden');
}

excelFileInput.addEventListener('change', handleExcelSelection);
importButton.addEventListener('click', submitSelectedImports);
productForm.addEventListener('submit', submitProduct);
addLotButton.addEventListener('click', () => addLotRow());
if (canViewInventoryAlerts) {
  refreshAlertsButton.addEventListener('click', () => {
    loadAlerts().catch((error) => {
      alertsMessage.textContent = error.message || 'No se pudieron cargar las alertas';
      alertsMessage.className = 'message error';
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return escapeHtml(value);
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(normalized) ? null : normalized;
}

function toApiDate(value) {
  return lotDates.toApiLotDate(value);
}

function buildDescription(row) {
  const parts = [
    normalizeText(row['Codigo Barras']) && `Codigo barras: ${normalizeText(row['Codigo Barras'])}`,
    normalizeText(row['Codigo Cabys']) && `CABYS: ${normalizeText(row['Codigo Cabys'])}`,
    normalizeText(row.Registromedicamento) && `Registro: ${normalizeText(row.Registromedicamento)}`,
  ].filter(Boolean);

  return parts.join(' | ') || null;
}

function warehouseOptions(selectedId = '') {
  return warehouses
    .filter((warehouse) => warehouse.isActive)
    .map((warehouse) => `
      <option value="${warehouse.id}" ${String(warehouse.id) === String(selectedId) ? 'selected' : ''}>
        ${escapeHtml(warehouse.code)} ��� ${escapeHtml(warehouse.name)}
      </option>
    `)
    .join('');
}

function renderWarehouseSelectors() {
  const options = warehouseOptions();
  importWarehouseSelect.innerHTML = options || '<option value="">No hay bodegas activas</option>';
}

function addLotRow(initial = {}) {
  if (!warehouses.length) {
    createProductMessage.textContent = 'Primero debe existir al menos una bodega activa.';
    createProductMessage.className = 'message error';
    return;
  }

  lotRowCounter += 1;
  const row = document.createElement('div');
  row.className = 'initial-lot-row';
  row.dataset.rowId = String(lotRowCounter);
  row.innerHTML = `
    <label>
      Bodega
      <select name="warehouseId" required>${warehouseOptions(initial.warehouseId)}</select>
    </label>
    <label>
      Lote interno
      <input name="internalLotNumber" type="text" maxlength="100" value="${escapeHtml(initial.internalLotNumber || '')}" required />
    </label>
    <label>
      Lote fabricante
      <input name="manufacturerLotNumber" type="text" maxlength="100" value="${escapeHtml(initial.manufacturerLotNumber || '')}" />
    </label>
    <label>
      Cantidad
      <input name="quantity" type="number" min="0.001" step="0.001" value="${escapeHtml(initial.quantity || '')}" required />
    </label>
    <label>
      Vencimiento
      <input name="expirationDate" type="date" value="${escapeHtml(initial.expirationDate || '')}" />
    </label>
    <button class="secondary-button remove-lot-button" type="button">Quitar</button>
  `;

  row.querySelector('.remove-lot-button').addEventListener('click', () => row.remove());
  row.querySelector('[name="expirationDate"]').min = lotDates.todayInGuatemala();
  initialLotsList.appendChild(row);
}

function readInitialLots() {
  return [...initialLotsList.querySelectorAll('.initial-lot-row')].map((row) => {
    const expirationDate = row.querySelector('[name="expirationDate"]').value;
    const dateError = lotDates.validateLotDates({ expirationDate, rejectExpiredExpiration: true });
    if (dateError) {
      throw new Error(dateError);
    }
    return {
      warehouseId: row.querySelector('[name="warehouseId"]').value,
      internalLotNumber: row.querySelector('[name="internalLotNumber"]').value.trim(),
      manufacturerLotNumber: row.querySelector('[name="manufacturerLotNumber"]').value.trim() || null,
      quantity: Number(row.querySelector('[name="quantity"]').value),
      expirationDate: toApiDate(expirationDate),
    };
  });
}

function renderProductDistribution(product) {
  const lots = product.warehouseLotStocks || [];
  if (!lots.length) return '<span class="muted">Sin existencias asignadas</span>';

  return lots
    .filter((stock) => Number(stock.quantity) > 0 || Number(stock.reservedQuantity) > 0)
    .map((stock) => `
      <span class="stock-allocation">
        ${escapeHtml(stock.warehouse.code)} ��� ${escapeHtml(stock.lot.internalLotNumber || stock.lot.lotNumber || 'Sin lote')}:
        ${escapeHtml(stock.quantity)} (${escapeHtml(stock.reservedQuantity)} reservado)
      </span>
    `)
    .join('');
}

function renderProducts(products) {
  if (!products.length) {
    productsBody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay productos registrados.</td></tr>';
    return;
  }

  productsBody.innerHTML = products
    .map((product) => `
      <tr>
        <td>${formatValue(product.id)}</td>
        <td>${formatValue(product.code)}</td>
        <td>${formatValue(product.name)}</td>
        <td>${formatValue(product.unit)}</td>
        <td>${formatValue(product.price)}</td>
        <td>${formatValue(product.quantity)}</td>
        <td>${formatValue(product.reservedQuantity)}</td>
        <td><div class="stock-allocation-list">${renderProductDistribution(product)}</div></td>
      </tr>
    `)
    .join('');
}

function renderAlertDetail(alert) {
  selectedAlertId = alert.id;
  alertDetailPanel.classList.remove('hidden');
  alertDetailContent.innerHTML = `
    <div class="pricing-grid">
      <div><strong>Tipo:</strong> ${formatValue(alert.alertType)}</div>
      <div><strong>Estado:</strong> ${formatValue(alert.status)}</div>
      <div><strong>Severidad:</strong> ${formatValue(alert.severity)}</div>
      <div><strong>Producto:</strong> ${formatValue(alert.product?.name)} (${formatValue(alert.product?.code)})</div>
      <div><strong>Lote:</strong> ${formatValue(alert.lot?.internalLotNumber)}</div>
      <div><strong>Bodega:</strong> ${formatValue(alert.warehouse?.name)}</div>
    </div>
    <p><strong>Mensaje:</strong> ${formatValue(alert.message)}</p>
    <pre>${escapeHtml(JSON.stringify(alert.metadata || {}, null, 2))}</pre>
  `;
}

function alertActionButtons(alert) {
  const buttons = [`<button class="secondary-button alert-detail-button" type="button" data-alert-id="${alert.id}">Ver detalle</button>`];

  if (canManageInventoryAlerts && alert.availableActions.includes('ACKNOWLEDGED')) {
    buttons.push(`<button class="secondary-button alert-status-button" type="button" data-alert-id="${alert.id}" data-status="ACKNOWLEDGED">Acusar recibo</button>`);
  }
  if (canManageInventoryAlerts && alert.availableActions.includes('RESOLVED')) {
    buttons.push(`<button class="secondary-button alert-status-button" type="button" data-alert-id="${alert.id}" data-status="RESOLVED">Resolver</button>`);
  }

  return buttons.join(' ');
}

function renderAlerts(alerts) {
  currentAlerts = alerts;

  if (!alerts.length) {
    alertsBody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay alertas de inventario activas o registradas.</td></tr>';
    alertDetailPanel.classList.add('hidden');
    alertDetailContent.textContent = 'Seleccione una alerta para revisar su contexto.';
    return;
  }

  alertsBody.innerHTML = alerts
    .map((alert) => `
      <tr>
        <td>${formatValue(alert.status)}</td>
        <td>${formatValue(alert.alertType)}</td>
        <td>${formatValue(alert.severity)}</td>
        <td>${formatValue(alert.product?.name)}</td>
        <td>${formatValue(alert.lot?.internalLotNumber)}</td>
        <td>${formatValue(alert.warehouse?.name)}</td>
        <td>${formatValue(alert.message)}</td>
        <td><div class="stock-allocation-list">${alertActionButtons(alert)}</div></td>
      </tr>
    `)
    .join('');

  if (selectedAlertId) {
    const selectedAlert = currentAlerts.find((alert) => String(alert.id) === String(selectedAlertId));
    if (selectedAlert) {
      renderAlertDetail(selectedAlert);
    }
  }
}

async function loadAlerts() {
  if (!canViewInventoryAlerts) {
    return;
  }

  alertsMessage.textContent = '';
  alertsMessage.className = 'message';
  const data = await apiFetch('/api/inventory/alerts?page=1&pageSize=20');
  renderAlerts(data.items || []);
}

async function showAlertDetail(alertId) {
  try {
    const alert = await apiFetch(`/api/inventory/alerts/${alertId}`);
    renderAlertDetail(alert);
  } catch (error) {
    alertsMessage.textContent = error.message || 'No se pudo cargar el detalle de la alerta';
    alertsMessage.className = 'message error';
  }
}

async function updateAlertStatus(alertId, status) {
  const note = window.prompt(
    status === 'RESOLVED'
      ? 'Ingrese una nota breve de resolucion para la alerta.'
      : 'Ingrese una nota breve para registrar la atencion de la alerta.',
    '',
  );

  if (note === null) {
    return;
  }

  try {
    alertsMessage.textContent = '';
    alertsMessage.className = 'message';
    const updatedAlert = await apiFetch(`/api/inventory/alerts/${alertId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    });
    alertsMessage.textContent = `Alerta ${updatedAlert.id} actualizada a ${updatedAlert.status}.`;
    await loadAlerts();
    renderAlertDetail(updatedAlert);
  } catch (error) {
    alertsMessage.textContent = error.message || 'No se pudo actualizar la alerta';
    alertsMessage.className = 'message error';
  }
}

alertsBody.addEventListener('click', (event) => {
  const detailButton = event.target.closest('.alert-detail-button');
  if (detailButton) {
    showAlertDetail(detailButton.dataset.alertId);
    return;
  }

  const statusButton = event.target.closest('.alert-status-button');
  if (statusButton) {
    updateAlertStatus(statusButton.dataset.alertId, statusButton.dataset.status);
  }
});

function renderImportPreview() {
  if (!importRows.length) {
    importPreviewWrapper.classList.add('hidden');
    importButton.disabled = true;
    return;
  }

  importPreviewWrapper.classList.remove('hidden');
  importButton.disabled = false;

  importPreviewBody.innerHTML = importRows
    .map((row, index) => `
      <tr>
        <td>
          <input type="checkbox" data-index="${index}" class="row-selector" ${row.selected ? 'checked' : ''} />
        </td>
        <td>
          <span class="badge ${row.exists ? 'badge-warning' : 'badge-success'}">${row.exists ? 'Actualizar datos' : 'Crear con lote'}</span>
        </td>
        <td>${formatValue(row.id)}</td>
        <td>${formatValue(row.name)}</td>
        <td>${formatValue(row.code)}</td>
        <td>${formatValue(row.price)}</td>
        <td>${formatValue(row.quantity)}${row.exists ? ' (no se modifica)' : ''}</td>
        <td>${formatValue(row.categoryName)}</td>
      </tr>
    `)
    .join('');

  document.querySelectorAll('.row-selector').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const index = Number(event.target.dataset.index);
      importRows[index].selected = event.target.checked;
    });
  });
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  });
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = '/';
    }
    const validationMessage = data?.details?.fieldErrors
      ? Object.values(data.details.fieldErrors).flat().join(' ')
      : null;
    throw new Error(validationMessage || data?.message || 'No se pudo completar la operacion');
  }

  return data;
}

async function loadWarehouses() {
  const data = await apiFetch('/api/warehouses/company');
  warehouses = data.items || [];
  renderWarehouseSelectors();
}

async function loadProducts() {
  try {
    const data = await apiFetch('/api/products');
    currentProducts = data;
    renderProducts(data);
  } catch (error) {
    productsBody.innerHTML = '<tr><td colspan="8" class="empty-state">No fue posible cargar los productos.</td></tr>';
    message.textContent = error.message || 'Ocurrio un error inesperado';
    message.classList.add('error');
  }
}

async function submitProduct(event) {
  event.preventDefault();
  createProductMessage.textContent = '';
  createProductMessage.className = 'message';

  const formData = new FormData(productForm);

  try {
    const initialLots = readInitialLots();
    const lotCodes = initialLots.map((lot) => lot.internalLotNumber.toLowerCase());
    if (new Set(lotCodes).size !== lotCodes.length) {
      throw new Error('Cada lote inicial debe tener un numero interno diferente.');
    }

    const payload = {
      code: normalizeText(formData.get('code')) || undefined,
      name: normalizeText(formData.get('name')),
      unit: normalizeText(formData.get('unit')) || 'UN',
      price: normalizeNumber(formData.get('price')),
      productType: formData.get('productType').toString(),
      lotStrategy: 'TRACKED',
      inCatalog: true,
      initialLots,
    };

    createProductButton.disabled = true;
    createProductButton.textContent = 'Creando...';

    const product = await apiFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    createProductMessage.textContent = `Producto ${product.name} creado con ${initialLots.length} lote(s).`;
    productForm.reset();
    initialLotsList.innerHTML = '';
    addLotRow();
    await loadProducts();
  } catch (error) {
    createProductMessage.textContent = error.message || 'No se pudo crear el producto';
    createProductMessage.className = 'message error';
  } finally {
    createProductButton.disabled = false;
    createProductButton.textContent = 'Crear producto';
  }
}

async function handleExcelSelection(event) {
  importMessage.textContent = '';
  importMessage.className = 'message';
  const [file] = event.target.files;

  if (!file) {
    importRows = [];
    renderImportPreview();
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    const existingIds = new Set(currentProducts.map((product) => String(product.id)));
    const importTimestamp = Date.now();

    importRows = rows
      .map((row) => {
        const id = normalizeNumber(row['Codigo Cliente']);
        const name = normalizeText(row.Descripcion);

        if (!id || !name) return null;

        const normalizedId = String(Math.trunc(id));
        return {
          id: normalizedId,
          selected: true,
          exists: existingIds.has(normalizedId),
          code: normalizeText(row['Codigo Cliente']),
          name,
          description: buildDescription(row),
          unit: 'UN',
          cabysCode: normalizeText(row['Codigo Cabys']) || null,
          currency: 'CRC',
          price: normalizeNumber(row['Precio Con Iva']) ?? normalizeNumber(row['Valor Unitario']),
          quantity: normalizeNumber(row.Existencias) ?? 0,
          categoryName: normalizeText(row['Familia Producto']) || null,
          internalLotNumber: `IMPORT-${normalizedId}-${importTimestamp}`,
        };
      })
      .filter(Boolean);

    if (!importRows.length) {
      throw new Error('El archivo no contiene filas validas para importar');
    }

    const existingCount = importRows.filter((row) => row.exists).length;
    importMessage.textContent = `Archivo cargado: ${importRows.length} filas validas. ${existingCount} actualizaran unicamente datos del catalogo.`;
    renderImportPreview();
  } catch (error) {
    importRows = [];
    renderImportPreview();
    importMessage.textContent = error.message || 'No se pudo leer el archivo Excel';
    importMessage.className = 'message error';
  }
}

function buildImportPayloadRows(rows) {
  const warehouseId = importWarehouseSelect.value;

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    unit: row.unit,
    cabysCode: row.cabysCode,
    currency: row.currency,
    price: row.price,
    quantity: row.exists ? 0 : row.quantity,
    categoryName: row.categoryName,
    warehouseId: row.exists || row.quantity <= 0 ? null : warehouseId,
    internalLotNumber: row.exists || row.quantity <= 0 ? null : row.internalLotNumber,
    inCatalog: true,
    overwrite: row.exists,
  }));
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function sendImportChunk(rows) {
  return apiFetch('/api/products/import', {
    method: 'POST',
    body: JSON.stringify({ rows: buildImportPayloadRows(rows) }),
  });
}

async function submitSelectedImports() {
  const selectedRows = importRows.filter((row) => row.selected);
  if (!selectedRows.length) {
    importMessage.textContent = 'Seleccione al menos un producto para importar.';
    importMessage.className = 'message error';
    return;
  }

  if (selectedRows.some((row) => !row.exists && row.quantity > 0) && !importWarehouseSelect.value) {
    importMessage.textContent = 'Seleccione la bodega para las existencias importadas.';
    importMessage.className = 'message error';
    return;
  }

  const rowsToUpdate = selectedRows.filter((row) => row.exists);
  if (rowsToUpdate.length) {
    const confirmed = window.confirm(`Hay ${rowsToUpdate.length} producto(s) existentes. Se actualizara el catalogo sin modificar sus existencias. ���Continuar?`);
    if (!confirmed) return;
  }

  importButton.disabled = true;
  importButton.textContent = 'Importando...';
  importMessage.textContent = '';
  importProgress.textContent = '';

  const chunks = chunkArray(selectedRows, IMPORT_CHUNK_SIZE);
  const totals = { created: 0, updated: 0, skipped: 0 };

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      importProgress.textContent = `Procesando bloque ${index + 1} de ${chunks.length}...`;
      const result = await sendImportChunk(chunks[index]);
      totals.created += result.created.length;
      totals.updated += result.updated.length;
      totals.skipped += result.skipped.length;
    }

    importMessage.textContent = `Importacion completada. Creados: ${totals.created}, actualizados: ${totals.updated}, omitidos: ${totals.skipped}.`;
    importProgress.textContent = `Se procesaron ${selectedRows.length} fila(s) en ${chunks.length} bloque(s).`;
    importRows = [];
    excelFileInput.value = '';
    renderImportPreview();
    await loadProducts();
  } catch (error) {
    importMessage.textContent = error.message || 'No se pudo completar la importacion';
    importMessage.className = 'message error';
    importProgress.textContent = 'La importacion se detuvo antes de completar todos los bloques.';
    importProgress.className = 'message error';
  } finally {
    importButton.disabled = false;
    importButton.textContent = 'Subir seleccionados';
  }
}

Promise.all([
  loadWarehouses(),
  loadProducts(),
  canViewInventoryAlerts ? loadAlerts() : Promise.resolve(),
])
  .then(() => {
    if (canManageProducts && warehouses.length) addLotRow();
  })
  .catch((error) => {
    message.textContent = error.message || 'No se pudo cargar la configuracion de inventario';
    message.className = 'message error';
  });
