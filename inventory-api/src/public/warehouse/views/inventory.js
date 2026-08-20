/**
 * Warehouse SPA — Inventory view.
 *
 * Two sub-views driven by hash params:
 *  - List:   #inventory                 → table of products with total quantity
 *  - Detail: #inventory?productId=<id>  → per-warehouse lot breakdown for one product
 *
 * Data source: GET /api/inventory/stocks (auth: inventory.stocks.list)
 * Payload:     { items: WarehouseStock[], lots: WarehouseLotStock[] }
 *
 * Notes:
 *  - All decimal quantities arrive as strings from Prisma → parse with Number().
 *  - Aggregation across warehouses happens client-side (simple Map reduce).
 *  - No mutations; this view is strictly read-only.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// -----------------------------------------------------------------------
// Formatting helpers (Zen of Python: readability counts)
// -----------------------------------------------------------------------

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatQuantity(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) { return '0'; }
  // Trim trailing zeros without losing precision (e.g. 12.500 → 12.5, 12.000 → 12)
  return n.toLocaleString('es-CR', { maximumFractionDigits: 3 });
}

function formatDate(value) {
  if (!value) { return '—'; }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { return '—'; }
  return d.toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// -----------------------------------------------------------------------
// Aggregation helpers
// -----------------------------------------------------------------------

/**
 * Reduce raw WarehouseStock rows into one entry per product with the summed
 * quantity across every warehouse (single source of truth for the list view).
 */
function aggregateStocksByProduct(items) {
  const byProduct = new Map();
  for (const row of items || []) {
    const productId = String(row.productId);
    const existing = byProduct.get(productId);
    const quantity = Number(row.quantity ?? 0);
    const reserved = Number(row.reservedQuantity ?? 0);
    if (existing) {
      existing.quantity += quantity;
      existing.reserved += reserved;
      existing.warehouseCount += 1;
    } else {
      byProduct.set(productId, {
        productId,
        name: row.product?.name || `Producto ${productId}`,
        code: row.product?.code || row.product?.sku || '',
        quantity,
        reserved,
        warehouseCount: 1,
      });
    }
  }
  return Array.from(byProduct.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Group lot-level stocks by warehouse for the detail view. Each warehouse
 * ends up with a list of its lots and a running quantity total.
 */
function groupLotsByWarehouse(lots, productId) {
  const byWarehouse = new Map();
  const target = String(productId);
  for (const row of lots || []) {
    if (String(row.productId) !== target) { continue; }
    const wid = String(row.warehouseId);
    if (!byWarehouse.has(wid)) {
      byWarehouse.set(wid, {
        warehouseId: wid,
        warehouseName: row.warehouse?.name || `Bodega ${wid}`,
        lots: [],
        totalQuantity: 0,
      });
    }
    const bucket = byWarehouse.get(wid);
    const quantity = Number(row.quantity ?? 0);
    bucket.lots.push({
      lotId: String(row.lotId),
      internalLotNumber: row.lot?.internalLotNumber || `Lote ${row.lotId}`,
      manufacturerLotNumber: row.lot?.manufacturerLotNumber || '',
      expirationDate: row.lot?.expirationDate || null,
      qaStatus: row.lot?.qaStatus || null,
      quantity,
      reserved: Number(row.reservedQuantity ?? 0),
    });
    bucket.totalQuantity += quantity;
  }
  return Array.from(byWarehouse.values()).sort((a, b) => a.warehouseName.localeCompare(b.warehouseName, 'es'));
}

// -----------------------------------------------------------------------
// List view rendering
// -----------------------------------------------------------------------

function renderProductList(container, products) {
  if (products.length === 0) {
    container.innerHTML = `
      <div class="warehouse-section">
        <h2 class="warehouse-section__title">Inventario</h2>
        <p class="warehouse-message">No hay productos con stock registrado.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="warehouse-section">
      <h2 class="warehouse-section__title">Inventario (${products.length} productos)</h2>
      <p class="warehouse-section__hint">Toque una fila para ver el detalle de lotes por bodega.</p>
      <table class="wh-inventory-table" role="grid" aria-label="Listado de productos en inventario">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Codigo</th>
            <th scope="col" style="text-align:right">Cantidad total</th>
            <th scope="col" style="text-align:right">Bodegas</th>
          </tr>
        </thead>
        <tbody>
          ${products.map((p) => `
            <tr class="wh-inventory-row" data-product-id="${escapeHtml(p.productId)}" tabindex="0" role="button" aria-label="Ver detalle de ${escapeHtml(p.name)}">
              <td>${escapeHtml(p.name)}</td>
              <td>${escapeHtml(p.code || '—')}</td>
              <td style="text-align:right"><strong>${escapeHtml(formatQuantity(p.quantity))}</strong></td>
              <td style="text-align:right">${escapeHtml(String(p.warehouseCount))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const app = WarehouseShell.require('app');
  const openDetail = (productId) => { app.navigate('inventory', { productId }); };

  container.querySelectorAll('.wh-inventory-row').forEach((row) => {
    const el = /** @type {HTMLElement} */ (row);
    const productId = el.dataset.productId;
    if (!productId) { return; }
    el.addEventListener('click', () => openDetail(productId));
    el.addEventListener('keydown', (ev) => {
      const key = /** @type {KeyboardEvent} */ (ev).key;
      if (key === 'Enter' || key === ' ') {
        ev.preventDefault();
        openDetail(productId);
      }
    });
  });
}

// -----------------------------------------------------------------------
// Detail view rendering
// -----------------------------------------------------------------------

function renderProductDetail(container, productId, aggregated, warehouseGroups) {
  const product = aggregated.find((p) => p.productId === String(productId));

  if (!product) {
    container.innerHTML = `
      <div class="warehouse-section">
        <p class="warehouse-message">No se encontro stock para este producto.</p>
        <button type="button" class="secondary-button" id="wh-inv-back">← Volver al inventario</button>
      </div>
    `;
    wireBackButton(container);
    return;
  }

  const lotsCount = warehouseGroups.reduce((sum, w) => sum + w.lots.length, 0);

  container.innerHTML = `
    <div class="warehouse-section">
      <button type="button" class="secondary-button" id="wh-inv-back" style="margin-bottom:12px">← Volver al inventario</button>
      <h2 class="warehouse-section__title">${escapeHtml(product.name)}</h2>
      <p class="warehouse-section__hint">
        Codigo: <strong>${escapeHtml(product.code || '—')}</strong>
        &nbsp;·&nbsp; Cantidad total: <strong>${escapeHtml(formatQuantity(product.quantity))}</strong>
        &nbsp;·&nbsp; Lotes: <strong>${escapeHtml(String(lotsCount))}</strong>
        &nbsp;·&nbsp; Bodegas: <strong>${escapeHtml(String(warehouseGroups.length))}</strong>
      </p>

      ${warehouseGroups.length === 0
        ? '<p class="warehouse-message">Este producto no tiene lotes registrados. El stock puede ser antiguo (sin trazabilidad de lote).</p>'
        : warehouseGroups.map((wh) => `
          <section class="wh-inventory-warehouse" aria-label="Bodega ${escapeHtml(wh.warehouseName)}">
            <h3 class="wh-inventory-warehouse__title">
              🏬 ${escapeHtml(wh.warehouseName)}
              <small style="font-weight:400">
                (${escapeHtml(String(wh.lots.length))} lote${wh.lots.length === 1 ? '' : 's'} ·
                ${escapeHtml(formatQuantity(wh.totalQuantity))} total)
              </small>
            </h3>
            <table class="wh-inventory-lot-table" role="grid" aria-label="Lotes en ${escapeHtml(wh.warehouseName)}">
              <thead>
                <tr>
                  <th scope="col">Lote interno</th>
                  <th scope="col">Lote fabricante</th>
                  <th scope="col">Vencimiento</th>
                  <th scope="col">QA</th>
                  <th scope="col" style="text-align:right">Cantidad</th>
                  <th scope="col" style="text-align:right">Reservado</th>
                </tr>
              </thead>
              <tbody>
                ${wh.lots.map((lot) => `
                  <tr>
                    <td>${escapeHtml(lot.internalLotNumber)}</td>
                    <td>${escapeHtml(lot.manufacturerLotNumber || '—')}</td>
                    <td>${escapeHtml(formatDate(lot.expirationDate))}</td>
                    <td>${escapeHtml(lot.qaStatus || '—')}</td>
                    <td style="text-align:right"><strong>${escapeHtml(formatQuantity(lot.quantity))}</strong></td>
                    <td style="text-align:right">${escapeHtml(formatQuantity(lot.reserved))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        `).join('')}
    </div>
  `;

  wireBackButton(container);
}

function wireBackButton(container) {
  const backBtn = container.querySelector('#wh-inv-back');
  if (!backBtn) { return; }
  backBtn.addEventListener('click', () => {
    const app = WarehouseShell.require('app');
    app.navigate('inventory');
  });
}

// -----------------------------------------------------------------------
// Top-level render entry point
// -----------------------------------------------------------------------

async function render(container, session, params = {}) {
  const api = WarehouseShell.require('warehouseApi');

  container.innerHTML = `
    <div class="warehouse-section">
      <p class="warehouse-message" aria-live="polite">Cargando inventario...</p>
    </div>
  `;

  let payload;
  try {
    payload = await api.listInventoryStocks(session);
  } catch (err) {
    container.innerHTML = `
      <div class="warehouse-section">
        <p class="warehouse-error" role="alert">${escapeHtml(err?.message || 'No se pudo cargar el inventario.')}</p>
      </div>
    `;
    return;
  }

  const items = payload?.items || [];
  const lots = payload?.lots || [];
  const products = aggregateStocksByProduct(items);

  if (params && params.productId) {
    const warehouseGroups = groupLotsByWarehouse(lots, params.productId);
    renderProductDetail(container, params.productId, products, warehouseGroups);
  } else {
    renderProductList(container, products);
  }
}

WarehouseShell.register('views.inventory', { render });
})();
