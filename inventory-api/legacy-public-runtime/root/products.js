const inventorySession = window.InventorySession;
const STORAGE_KEY = inventorySession.STORAGE_KEY;
const session = inventorySession.read();
const permissions = new Set(session?.user?.permissions || []);

const canViewProducts = permissions.has('products.view') || permissions.has('products.manage');
const canManageProducts = permissions.has('products.manage');
const canViewInventory = permissions.has('inventory.view') || permissions.has('inventory.manage');
const canManageInventory = permissions.has('inventory.manage');

if (!session?.user || !session?.user?.companyId || !canViewProducts) {
  window.location.href = session?.user ? '/no-access.html' : '/';
}

const elements = {
  session: document.getElementById('products-session'),
  banner: document.getElementById('products-banner'),
  tableBody: document.getElementById('products-table-body'),
  resultCount: document.getElementById('products-result-count'),
  search: document.getElementById('product-search'),
  warehouseFilter: document.getElementById('product-warehouse-filter'),
  typeFilter: document.getElementById('product-type-filter'),
  lotStatusFilter: document.getElementById('product-lot-status-filter'),
  stockOnly: document.getElementById('product-stock-only'),
  clearFilters: document.getElementById('clear-product-filters'),
  refresh: document.getElementById('refresh-products-button'),
  logout: document.getElementById('logout-button'),
  createButton: document.getElementById('create-product-button'),
  registerButton: document.getElementById('register-lot-button'),
  kpiTotal: document.getElementById('products-kpi-total'),
  kpiStock: document.getElementById('products-kpi-stock'),
  kpiEmpty: document.getElementById('products-kpi-empty'),
  kpiCritical: document.getElementById('products-kpi-critical'),
  drawer: document.getElementById('product-detail-drawer'),
  drawerBackdrop: document.getElementById('product-drawer-backdrop'),
  drawerTitle: document.getElementById('drawer-title'),
  drawerSubtitle: document.getElementById('drawer-subtitle'),
  drawerSummary: document.getElementById('drawer-summary'),
  drawerSummaryTab: document.getElementById('product-tab-summary'),
  drawerWarehousesTab: document.getElementById('product-tab-warehouses'),
  drawerLotsTab: document.getElementById('product-tab-lots'),
  drawerRegisterButton: document.getElementById('drawer-register-lot-button'),
  createModal: document.getElementById('create-product-modal'),
  createForm: document.getElementById('create-product-form'),
  createLots: document.getElementById('create-product-lots'),
  addInitialLot: document.getElementById('add-initial-lot-button'),
  createError: document.getElementById('create-product-error'),
  submitCreate: document.getElementById('submit-create-product'),
  registerModal: document.getElementById('register-lot-modal'),
  registerForm: document.getElementById('register-lot-form'),
  registerError: document.getElementById('register-lot-error'),
  submitRegister: document.getElementById('submit-register-lot'),
};

const lotDates = window.InventoryLotDates;
const productsShared = window.RootProductsShared;

let products = [];
let warehouses = [];
let selectedProductId = null;
let bannerTimer = null;
let activeModal = null;
let lastModalTrigger = null;

elements.session.textContent = `Sesión activa: ${session.user.fullName} (${session.user.username})`;
elements.createButton.classList.toggle('hidden', !canManageProducts);
elements.registerButton.classList.toggle('hidden', !canManageInventory);
elements.drawerRegisterButton.classList.toggle('hidden', !canManageInventory);

const escapeHtml = productsShared.escapeHtml;
const number = productsShared.number;
const formatQuantity = productsShared.formatQuantity;
const formatMoney = productsShared.formatMoney;
const dateKey = (value) => lotDates.dateKey(value);
const todayInGuatemala = () => lotDates.todayInGuatemala();
const addDaysToDateKey = productsShared.addDaysToDateKey;
const formatDate = (value) => productsShared.formatDate(value, lotDates);
const toApiDate = (value) => lotDates.toApiLotDate(value);
const productTypeLabel = productsShared.productTypeLabel;
const lotStatusLabel = productsShared.lotStatusLabel;
const qaStatusLabel = productsShared.qaStatusLabel;

function getLotHealth(stock) {
  const today = todayInGuatemala();
  const warningDate = addDaysToDateKey(today, 30);
  const expiration = dateKey(stock.lot?.expirationDate);
  const derived = stock.lot?.derivedUsability || null;
  const expired = derived ? Boolean(derived.expired) : Boolean(expiration && expiration <= today);
  const expiring = Boolean(expiration && expiration > today && expiration <= warningDate);
  const sellable = derived
    ? number(stock.quantity) > 0 && Boolean(derived.sellable)
    : number(stock.quantity) > 0
      && stock.lot?.status === 'AVAILABLE'
      && stock.lot?.qaStatus === 'APPROVED'
      && !expired;
  const critical = number(stock.quantity) > 0
    && (!sellable || expiring);

  return { expired, expiring, sellable, critical };
}

function summarizeProduct(product) {
  const lotStocks = canViewInventory ? (product.warehouseLotStocks || []) : [];
  const positiveLots = lotStocks.filter((stock) => number(stock.quantity) > 0);
  const stock = positiveLots.reduce((sum, item) => sum + number(item.quantity), 0);
  const reserved = positiveLots.reduce((sum, item) => sum + number(item.reservedQuantity), 0);
  const warehouseIds = new Set(positiveLots.map((item) => String(item.warehouseId || item.warehouse?.id)));
  const activeLots = positiveLots.filter((item) => getLotHealth(item).sellable);
  const criticalLotIds = new Set(
    positiveLots
      .filter((item) => getLotHealth(item).critical)
      .map((item) => String(item.lotId || item.lot?.id)),
  );

  return {
    product,
    lotStocks,
    stock,
    reserved,
    available: Math.max(0, stock - reserved),
    warehouseCount: warehouseIds.size,
    activeLotCount: new Set(activeLots.map((item) => String(item.lotId || item.lot?.id))).size,
    criticalLotCount: criticalLotIds.size,
  };
}

function showBanner(text, type = 'success') {
  clearTimeout(bannerTimer);
  elements.banner.textContent = text;
  elements.banner.className = `products-banner ${type}`;
  bannerTimer = setTimeout(() => elements.banner.classList.add('hidden'), 6000);
}

function setInlineError(element, text = '') {
  element.textContent = text;
  element.className = text ? 'message error' : 'message';
}

function applyLotDateConstraints(scope) {
  scope.querySelectorAll('input[name="expirationDate"]').forEach((input) => {
    input.min = todayInGuatemala();
  });
}

function syncDrawerInteractivity() {
  const modalOverDrawer = Boolean(activeModal && elements.drawer.classList.contains('open'));
  document.body.classList.toggle('drawer-modal-open', modalOverDrawer);
  if (elements.drawer.classList.contains('open')) {
    elements.drawer.setAttribute('aria-hidden', modalOverDrawer ? 'true' : 'false');
  }
}

const apiFetch = (url, options = {}) => productsShared.apiFetch(session, STORAGE_KEY, url, options);

function renderWarehouseFilter() {
  elements.warehouseFilter.innerHTML = '<option value="">Todas</option>'
    + warehouses
      .filter((warehouse) => warehouse.isActive)
      .map((warehouse) => `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} · ${escapeHtml(warehouse.name)}</option>`)
      .join('');
}

function renderTypeFilter() {
  const types = [...new Set(products.map((product) => product.productType).filter(Boolean))].sort();
  elements.typeFilter.innerHTML = '<option value="">Todos</option>'
    + types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(productTypeLabel(type))}</option>`).join('');
}

function productMatchesFilters(summary) {
  const query = elements.search.value.trim().toLowerCase();
  const warehouseId = elements.warehouseFilter.value;
  const type = elements.typeFilter.value;
  const lotStatus = elements.lotStatusFilter.value;

  const matchesQuery = !query
    || `${summary.product.code || ''} ${summary.product.name || ''}`.toLowerCase().includes(query);
  const matchesWarehouse = !warehouseId
    || summary.lotStocks.some((stock) => String(stock.warehouseId || stock.warehouse?.id) === warehouseId && number(stock.quantity) > 0);
  const matchesType = !type || summary.product.productType === type;
  const matchesStock = !elements.stockOnly.checked || summary.stock > 0;
  const matchesLotStatus = !lotStatus
    || (lotStatus === 'CRITICAL'
      ? summary.lotStocks.some((stock) => getLotHealth(stock).critical)
      : summary.lotStocks.some((stock) => stock.lot?.status === lotStatus && number(stock.quantity) > 0));

  return matchesQuery && matchesWarehouse && matchesType && matchesStock && matchesLotStatus;
}

function renderKpis(summaries) {
  if (!canViewInventory) {
    elements.kpiTotal.textContent = String(summaries.length);
    elements.kpiStock.textContent = '—';
    elements.kpiEmpty.textContent = '—';
    elements.kpiCritical.textContent = '—';
    return;
  }

  elements.kpiTotal.textContent = String(summaries.length);
  elements.kpiStock.textContent = String(summaries.filter((item) => item.stock > 0).length);
  elements.kpiEmpty.textContent = String(summaries.filter((item) => item.stock <= 0).length);
  elements.kpiCritical.textContent = String(summaries.reduce((sum, item) => sum + item.criticalLotCount, 0));
}

function renderProducts() {
  const summaries = products.map(summarizeProduct);
  const filtered = summaries.filter(productMatchesFilters);
  renderKpis(summaries);
  elements.resultCount.textContent = `${filtered.length} de ${products.length} producto(s)`;

  if (!filtered.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay productos que coincidan con los filtros.</td></tr>';
    return;
  }

  elements.tableBody.innerHTML = filtered.map((summary) => {
    const product = summary.product;
    const stockCells = canViewInventory
      ? `
        <td class="numeric-cell" data-label="Stock">${formatQuantity(summary.stock)}</td>
        <td class="numeric-cell" data-label="Reservado">${formatQuantity(summary.reserved)}</td>
        <td class="numeric-cell" data-label="Disponible">${formatQuantity(summary.available)}</td>
        <td class="numeric-cell" data-label="Bodegas">${summary.warehouseCount}</td>
        <td class="numeric-cell" data-label="Lotes activos">
          <span class="${summary.criticalLotCount ? 'products-count-warning' : ''}">${summary.activeLotCount}</span>
          ${summary.criticalLotCount ? `<small>${summary.criticalLotCount} alerta(s)</small>` : ''}
        </td>
      `
      : '<td colspan="5" class="muted products-no-inventory">Sin permiso para consultar inventario</td>';

    return `
      <tr>
        <td data-label="Producto">
          <div class="product-name-cell">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.code || 'Sin código')}</span>
          </div>
        </td>
        <td data-label="Tipo"><span class="products-type-chip">${escapeHtml(productTypeLabel(product.productType))}</span></td>
        ${stockCells}
        <td class="products-action-cell">
          <button class="table-action-link secondary-button" type="button" data-view-product="${product.id}">Ver detalle</button>
        </td>
      </tr>
    `;
  }).join('');

  elements.tableBody.querySelectorAll('[data-view-product]').forEach((button) => {
    button.addEventListener('click', () => openProductDrawer(button.dataset.viewProduct));
  });
}

function statusChip(value, kind = 'lot') {
  const label = kind === 'qa' ? qaStatusLabel(value) : lotStatusLabel(value);
  return productsShared.statusChip(value, label, escapeHtml);
}

function warehouseRows(summary) {
  const grouped = new Map();
  summary.lotStocks.forEach((stock) => {
    if (number(stock.quantity) <= 0 && number(stock.reservedQuantity) <= 0) return;
    const id = String(stock.warehouseId || stock.warehouse?.id);
    const current = grouped.get(id) || {
      warehouse: stock.warehouse,
      quantity: 0,
      reserved: 0,
      lots: new Set(),
    };
    current.quantity += number(stock.quantity);
    current.reserved += number(stock.reservedQuantity);
    current.lots.add(String(stock.lotId || stock.lot?.id));
    grouped.set(id, current);
  });
  return [...grouped.values()];
}

function openProductDrawer(productId) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;
  selectedProductId = String(product.id);
  const summary = summarizeProduct(product);
  elements.drawerTitle.textContent = product.name;
  elements.drawerSubtitle.textContent = `${product.code || 'Sin código'} · ${productTypeLabel(product.productType)}`;
  elements.drawerSummary.innerHTML = canViewInventory
    ? `
      <article><span>Stock total</span><strong>${formatQuantity(summary.stock)}</strong></article>
      <article><span>Reservado</span><strong>${formatQuantity(summary.reserved)}</strong></article>
      <article><span>Disponible</span><strong>${formatQuantity(summary.available)}</strong></article>
    `
    : '<article class="products-summary-restricted"><span>Inventario</span><strong>Acceso restringido</strong></article>';

  elements.drawerSummaryTab.innerHTML = `
    <div class="product-detail-list">
      <div><span>Código</span><strong>${escapeHtml(product.code || '—')}</strong></div>
      <div><span>Unidad</span><strong>${escapeHtml(product.unit || '—')}</strong></div>
      <div><span>Tipo</span><strong>${escapeHtml(productTypeLabel(product.productType))}</strong></div>
      <div><span>Precio</span><strong>${escapeHtml(formatMoney(product.price, product.currency))}</strong></div>
      <div><span>Stock mínimo</span><strong>${product.minStock == null ? '—' : formatQuantity(product.minStock)}</strong></div>
      <div><span>Stock máximo</span><strong>${product.maxStock == null ? '—' : formatQuantity(product.maxStock)}</strong></div>
      <div><span>Estado</span><strong>${product.isActive === false ? 'Inactivo' : 'Activo'}</strong></div>
      <div><span>Trazabilidad</span><strong>Obligatoria por lote</strong></div>
    </div>
  `;

  if (!canViewInventory) {
    const restricted = '<div class="products-empty-panel">No tiene permiso para consultar existencias.</div>';
    elements.drawerWarehousesTab.innerHTML = restricted;
    elements.drawerLotsTab.innerHTML = restricted;
  } else {
    const rows = warehouseRows(summary);
    elements.drawerWarehousesTab.innerHTML = rows.length
      ? `<div class="table-wrapper"><table class="product-detail-table">
          <thead><tr><th>Bodega</th><th>Tipo</th><th>Cantidad</th><th>Reservado</th><th>Lotes</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.warehouse?.name || '—')}<small>${escapeHtml(row.warehouse?.code || '')}</small></td>
              <td>${escapeHtml(row.warehouse?.warehouseType || '—')}</td>
              <td>${formatQuantity(row.quantity)}</td>
              <td>${formatQuantity(row.reserved)}</td>
              <td>${row.lots.size}</td>
            </tr>`).join('')}</tbody>
        </table></div>`
      : '<div class="products-empty-panel">Este producto todavía no tiene existencias por bodega.</div>';

    const lotRows = summary.lotStocks
      .filter((stock) => number(stock.quantity) > 0 || number(stock.reservedQuantity) > 0)
      .sort((a, b) => String(a.lot?.expirationDate || '9999').localeCompare(String(b.lot?.expirationDate || '9999')));
    elements.drawerLotsTab.innerHTML = lotRows.length
      ? `<div class="table-wrapper"><table class="product-detail-table product-lots-table">
          <thead><tr><th>Lote interno</th><th>Fabricante</th><th>Bodega</th><th>Cantidad</th><th>Estado</th><th>QA</th><th>Vence</th></tr></thead>
          <tbody>${lotRows.map((stock) => {
            const health = getLotHealth(stock);
            return `<tr class="${health.critical ? 'product-lot-critical' : ''}">
              <td><strong>${escapeHtml(stock.lot?.internalLotNumber || stock.lot?.lotNumber || '—')}</strong></td>
              <td>${escapeHtml(stock.lot?.manufacturerLotNumber || '—')}</td>
              <td>${escapeHtml(stock.warehouse?.code || stock.warehouse?.name || '—')}</td>
              <td>${formatQuantity(stock.quantity)}<small>${formatQuantity(stock.reservedQuantity)} reservado</small></td>
              <td>${statusChip(health.expired ? 'EXPIRED' : stock.lot?.status)}</td>
              <td>${statusChip(stock.lot?.qaStatus, 'qa')}</td>
              <td>${formatDate(stock.lot?.expirationDate)}${health.expiring ? '<small class="products-expiring">Vence en 30 días o menos</small>' : ''}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>`
      : '<div class="products-empty-panel">Este producto todavía no tiene lotes con existencias.</div>';
  }

  selectProductTab('summary');
  elements.drawer.classList.add('open');
  elements.drawer.setAttribute('aria-hidden', 'false');
  elements.drawerBackdrop.classList.remove('hidden');
  document.body.classList.add('products-overlay-open');
  syncDrawerInteractivity();
  document.getElementById('close-product-drawer').focus();
}

function closeProductDrawer() {
  if (activeModal) return;
  elements.drawer.classList.remove('open');
  elements.drawer.setAttribute('aria-hidden', 'true');
  elements.drawerBackdrop.classList.add('hidden');
  document.body.classList.remove('products-overlay-open');
  syncDrawerInteractivity();
}

function selectProductTab(tabName) {
  document.querySelectorAll('[data-product-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.productTab === tabName);
  });
  ['summary', 'warehouses', 'lots'].forEach((name) => {
    document.getElementById(`product-tab-${name}`).classList.toggle('hidden', name !== tabName);
  });
}

function warehouseOptions(selectedId = '') {
  return warehouses
    .filter((warehouse) => warehouse.isActive)
    .map((warehouse) => `<option value="${warehouse.id}" ${String(warehouse.id) === String(selectedId) ? 'selected' : ''}>
      ${escapeHtml(warehouse.code)} · ${escapeHtml(warehouse.name)}
    </option>`)
    .join('');
}

function productOptions(selectedId = '') {
  return products
    .filter((product) => product.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((product) => `<option value="${product.id}" ${String(product.id) === String(selectedId) ? 'selected' : ''}>
      ${escapeHtml(product.code || 'S/C')} · ${escapeHtml(product.name)}
    </option>`)
    .join('');
}

function openModal(modal, focusSelector, trigger = document.activeElement) {
  activeModal = modal;
  lastModalTrigger = trigger instanceof HTMLElement ? trigger : null;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('products-overlay-open');
  syncDrawerInteractivity();
  const focusTarget = modal.querySelector(focusSelector);
  setTimeout(() => focusTarget?.focus(), 0);
}

function closeModal(modal) {
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (activeModal === modal) {
    activeModal = null;
  }
  syncDrawerInteractivity();
  if (!elements.drawer.classList.contains('open')) {
    document.body.classList.remove('products-overlay-open');
  }
  const restoreTarget = lastModalTrigger;
  lastModalTrigger = null;
  setTimeout(() => restoreTarget?.focus?.(), 0);
}

function addInitialLotRow(initial = {}) {
  if (!warehouses.some((warehouse) => warehouse.isActive)) {
    setInlineError(elements.createError, 'Debe crear una bodega activa antes de registrar existencias.');
    return;
  }
  const row = document.createElement('div');
  row.className = 'initial-lot-row products-initial-lot-row';
  row.innerHTML = `
    <label class="field">
      <span>Bodega</span>
      <select name="warehouseId" required>${warehouseOptions(initial.warehouseId)}</select>
    </label>
    <label class="field">
      <span>Lote interno</span>
      <input name="internalLotNumber" type="text" maxlength="100" value="${escapeHtml(initial.internalLotNumber || '')}" required />
    </label>
    <label class="field">
      <span>Lote fabricante</span>
      <input name="manufacturerLotNumber" type="text" maxlength="100" value="${escapeHtml(initial.manufacturerLotNumber || '')}" />
    </label>
    <label class="field">
      <span>Cantidad</span>
      <input name="quantity" type="number" min="0.01" step="0.01" value="${escapeHtml(initial.quantity || '')}" required />
    </label>
    <label class="field">
      <span>Vencimiento</span>
      <input name="expirationDate" type="date" value="${escapeHtml(initial.expirationDate || '')}" />
    </label>
    <button class="secondary-button remove-lot-button" type="button">Quitar</button>
  `;
  row.querySelector('.remove-lot-button').addEventListener('click', () => row.remove());
  applyLotDateConstraints(row);
  elements.createLots.appendChild(row);
}

function readInitialLots() {
  const lots = [...elements.createLots.querySelectorAll('.products-initial-lot-row')].map((row) => {
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
  const normalized = lots.map((lot) => lot.internalLotNumber.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Cada lote inicial debe tener un numero interno diferente.');
  }
  if (lots.some((lot) => !Number.isFinite(lot.quantity) || lot.quantity <= 0)) {
    throw new Error('Cada lote debe tener una cantidad mayor que cero.');
  }
  return lots;
}

function openCreateProductModal(trigger = document.activeElement) {
  setInlineError(elements.createError);
  elements.createLots.innerHTML = '';
  openModal(elements.createModal, '[name="name"]', trigger);
}

function openRegisterLotModal(productId = '', trigger = document.activeElement) {
  setInlineError(elements.registerError);
  elements.registerForm.reset();
  elements.registerForm.elements.productId.innerHTML = productOptions(productId);
  elements.registerForm.elements.warehouseId.innerHTML = warehouseOptions();
  elements.registerForm.elements.entryDate.value = todayInGuatemala();
  applyLotDateConstraints(elements.registerForm);
  applyWarehouseDefaults();
  openModal(elements.registerModal, '[name="productId"]', trigger);
}

function applyWarehouseDefaults() {
  const warehouseId = elements.registerForm.elements.warehouseId.value;
  const warehouse = warehouses.find((item) => String(item.id) === String(warehouseId));
  const quarantine = warehouse?.warehouseType === 'QUARANTINE';
  const hint = document.getElementById('entry-state-hint');
  if (hint) {
    hint.textContent = quarantine
      ? 'Cuarentena · QA pendiente'
      : 'Disponible · QA aprobado por política de ingreso';
  }
}

async function submitCreateProduct(event) {
  event.preventDefault();
  setInlineError(elements.createError);
  const form = new FormData(elements.createForm);

  try {
    const initialLots = readInitialLots();
    const minStock = form.get('minStock') === '' ? undefined : Number(form.get('minStock'));
    const maxStock = form.get('maxStock') === '' ? undefined : Number(form.get('maxStock'));
    if (minStock !== undefined && maxStock !== undefined && minStock > maxStock) {
      throw new Error('El stock mínimo no puede ser mayor que el máximo.');
    }

    const payload = {
      code: form.get('code').trim() || undefined,
      name: form.get('name').trim(),
      unit: form.get('unit').trim(),
      productType: form.get('productType'),
      lotStrategy: 'TRACKED',
      inCatalog: true,
      initialLots,
      quantity: initialLots.reduce((sum, lot) => sum + lot.quantity, 0),
      ...(form.get('price') === '' ? {} : { price: Number(form.get('price')) }),
      ...(minStock === undefined ? {} : { minStock }),
      ...(maxStock === undefined ? {} : { maxStock }),
    };

    elements.submitCreate.disabled = true;
    elements.submitCreate.textContent = 'Creando…';
    const result = await apiFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    closeModal(elements.createModal);
    elements.createForm.reset();
    elements.createForm.elements.unit.value = 'UN';
    showBanner(`Producto ${result.name} creado correctamente.`);
    await loadData();
  } catch (error) {
    setInlineError(elements.createError, error.message);
  } finally {
    elements.submitCreate.disabled = false;
    elements.submitCreate.textContent = 'Crear producto';
  }
}

async function submitRegisterLot(event) {
  event.preventDefault();
  setInlineError(elements.registerError);
  const form = new FormData(elements.registerForm);
  const quantity = Number(form.get('quantity'));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    setInlineError(elements.registerError, 'La cantidad debe ser mayor que cero.');
    return;
  }

  const dateFields = {
    entryDate: form.get('entryDate'),
    productionDate: form.get('productionDate'),
    expirationDate: form.get('expirationDate'),
  };
  const dateError = lotDates.validateLotDates({
    ...dateFields,
    rejectExpiredExpiration: true,
  });
  if (dateError) {
    setInlineError(elements.registerError, dateError);
    return;
  }

  const payload = {
    productId: form.get('productId'),
    warehouseId: form.get('warehouseId'),
    quantity,
    reasonCode: 'MANUAL_ENTRY',
    internalLotNumber: form.get('internalLotNumber').trim(),
    manufacturerLotNumber: form.get('manufacturerLotNumber').trim() || null,
    entryDate: toApiDate(dateFields.entryDate),
    productionDate: toApiDate(dateFields.productionDate),
    expirationDate: toApiDate(dateFields.expirationDate),
    note: form.get('note').trim() || 'Entrada manual de inventario',
    useLot: true,
  };

  try {
    elements.submitRegister.disabled = true;
    elements.submitRegister.textContent = 'Registrando…';
    const result = await apiFetch('/api/inventory/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    closeModal(elements.registerModal);
    const requestedLot = payload.internalLotNumber;
    const createdLot = result?.lot?.internalLotNumber || requestedLot;
    showBanner(
      createdLot === requestedLot
        ? `Entrada registrada en el lote ${createdLot}.`
        : `El lote ${requestedLot} ya existía; la entrada se registró como ${createdLot}.`,
      createdLot === requestedLot ? 'success' : 'warning',
    );
    await loadData();
    if (selectedProductId) openProductDrawer(selectedProductId);
  } catch (error) {
    setInlineError(elements.registerError, error.message);
  } finally {
    elements.submitRegister.disabled = false;
    elements.submitRegister.textContent = 'Registrar entrada';
  }
}

async function loadData() {
  elements.refresh.disabled = true;
  elements.resultCount.textContent = 'Cargando productos…';
  try {
    const requests = [apiFetch('/api/products')];
    if (canViewInventory) requests.push(apiFetch('/api/warehouses/company'));
    const [productData, warehouseData] = await Promise.all(requests);
    products = Array.isArray(productData) ? productData : [];
    warehouses = warehouseData?.items || [];
    renderWarehouseFilter();
    renderTypeFilter();
    renderProducts();
  } catch (error) {
    elements.tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No fue posible cargar los productos.</td></tr>';
    elements.resultCount.textContent = 'Error de carga';
    showBanner(error.message, 'error');
  } finally {
    elements.refresh.disabled = false;
  }
}

[elements.search, elements.warehouseFilter, elements.typeFilter, elements.lotStatusFilter, elements.stockOnly]
  .forEach((control) => control.addEventListener(control === elements.search ? 'input' : 'change', renderProducts));

elements.clearFilters.addEventListener('click', () => {
  elements.search.value = '';
  elements.warehouseFilter.value = '';
  elements.typeFilter.value = '';
  elements.lotStatusFilter.value = '';
  elements.stockOnly.checked = false;
  renderProducts();
});

elements.logout.addEventListener('click', () => {
  window.InventoryAuth.logout(session);
});
elements.refresh.addEventListener('click', loadData);
elements.createButton.addEventListener('click', (event) => openCreateProductModal(event.currentTarget));
elements.registerButton.addEventListener('click', (event) => openRegisterLotModal('', event.currentTarget));
elements.addInitialLot.addEventListener('click', () => addInitialLotRow());
elements.createForm.addEventListener('submit', submitCreateProduct);
elements.registerForm.addEventListener('submit', submitRegisterLot);
elements.registerForm.elements.warehouseId.addEventListener('change', applyWarehouseDefaults);
elements.drawerRegisterButton.addEventListener('click', (event) => openRegisterLotModal(selectedProductId, event.currentTarget));
document.getElementById('close-product-drawer').addEventListener('click', closeProductDrawer);
document.getElementById('drawer-close-button').addEventListener('click', closeProductDrawer);
elements.drawerBackdrop.addEventListener('click', closeProductDrawer);

document.querySelectorAll('[data-product-tab]').forEach((button) => {
  button.addEventListener('click', () => selectProductTab(button.dataset.productTab));
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.closeModal)));
});
document.querySelectorAll('.modal-backdrop').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal);
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!elements.createModal.classList.contains('hidden')) closeModal(elements.createModal);
  else if (!elements.registerModal.classList.contains('hidden')) closeModal(elements.registerModal);
  else if (elements.drawer.classList.contains('open')) closeProductDrawer();
});

if (!canViewInventory) {
  elements.warehouseFilter.disabled = true;
  elements.lotStatusFilter.disabled = true;
  elements.stockOnly.disabled = true;
  showBanner('Puede consultar el catálogo, pero no tiene permiso para ver existencias o lotes.', 'warning');
}

loadData();











