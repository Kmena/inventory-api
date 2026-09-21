/**
 * Warehouse SPA — Inventory Requests view.
 *
 * Shows pending/in-progress movement requests so warehouse operators can:
 *   - Confirm pickup (TRANSFER: PENDING → IN_PROGRESS)
 *   - Execute request (ADJUSTMENT or TRANSFER: → COMPLETED)
 *
 * Data source: GET /api/inventory/requests
 * Permissions: inventory.requests.execute
 */
(() => {
'use strict';

const WarehouseShell = /** @type {any} */ (window).WarehouseShell;
const warehouseApi = WarehouseShell.require('warehouseApi');

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (_) { return '—'; }
}

const STATUS_LABEL = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En tránsito',
  DELIVERED: 'Entregado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const TYPE_LABEL = {
  ADJUSTMENT: 'Ajuste',
  TRANSFER: 'Traslado',
};

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderEmpty() {
  return `
    <div class="warehouse-section">
      <p class="warehouse-empty">No hay solicitudes pendientes.</p>
    </div>
  `;
}

function renderRequestRow(req) {
  const id = esc(String(req.id || ''));
  const type = esc(TYPE_LABEL[req.type] || req.type || '');
  const status = req.status || '';
  const statusLabel = esc(STATUS_LABEL[status] || status);
  const lotLabel = esc(req.lot?.lotNumber || req.lot?.internalLotNumber || String(req.lotId || ''));
  const productName = esc(req.product?.name || String(req.productId || ''));
  const sourceWarehouse = esc(req.sourceWarehouse?.name || String(req.sourceWarehouseId || ''));
  const destWarehouse = req.destinationWarehouse?.name
    ? esc(req.destinationWarehouse.name)
    : req.destinationWarehouseId
      ? esc(String(req.destinationWarehouseId))
      : '—';
  const requestedAt = esc(fmtDate(req.requestedAt));

  const isTransfer = req.type === 'TRANSFER';
  const canPickup          = isTransfer && status === 'PENDING';
  const canConfirmDelivery = isTransfer && status === 'IN_PROGRESS';
  const canFinalize        = isTransfer && status === 'DELIVERED';
  const canExecuteAdjust   = !isTransfer && status === 'PENDING';

  const actions = [
    canPickup
      ? `<button type="button" class="warehouse-button secondary" data-pickup-request-id="${id}">Confirmar pickup</button>`
      : '',
    canConfirmDelivery
      ? `<button type="button" class="warehouse-button secondary" data-confirm-delivery-request-id="${id}">Confirmar entrega</button>`
      : '',
    canFinalize
      ? `<button type="button" class="warehouse-button" data-execute-request-id="${id}" data-request-type="${esc(req.type || '')}">Finalizar</button>`
      : '',
    canExecuteAdjust
      ? `<button type="button" class="warehouse-button" data-execute-request-id="${id}" data-request-type="${esc(req.type || '')}">Ejecutar</button>`
      : '',
  ].filter(Boolean).join(' ');

  return `
    <tr>
      <td>${type}</td>
      <td>${lotLabel}</td>
      <td>${productName}</td>
      <td>${sourceWarehouse}</td>
      <td>${destWarehouse}</td>
      <td><span class="warehouse-badge">${statusLabel}</span></td>
      <td>${requestedAt}</td>
      <td class="warehouse-actions">${actions || '—'}</td>
    </tr>
  `;
}

function renderRequestsTable(items) {
  return `
    <div class="warehouse-section">
      <h3 class="warehouse-section-title">Solicitudes de movimiento</h3>
      <div class="warehouse-table-wrapper">
        <table class="warehouse-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Lote</th>
              <th>Producto</th>
              <th>Bodega origen</th>
              <th>Destino</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(renderRequestRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPickupModal(req) {
  const id = esc(String(req.id || ''));
  const lotLabel = esc(req.lot?.lotNumber || req.lot?.internalLotNumber || String(req.lotId || ''));
  const productName = esc(req.product?.name || String(req.productId || ''));
  return `
    <div class="warehouse-modal-backdrop" id="ir-pickup-modal" role="dialog" aria-modal="true" aria-labelledby="ir-pickup-modal-title">
      <div class="warehouse-modal">
        <h3 id="ir-pickup-modal-title">Confirmar pickup — Solicitud #${id}</h3>
        <dl class="warehouse-detail-list">
          <dt>Lote</dt><dd>${lotLabel}</dd>
          <dt>Producto</dt><dd>${productName}</dd>
        </dl>
        <form id="ir-pickup-form">
          <input type="hidden" name="requestId" value="${id}" />
          <label class="warehouse-label">
            <span>Nota del operador</span>
            <input type="text" name="operatorNote" maxlength="500" class="warehouse-input" placeholder="Opcional" />
          </label>
          <div class="warehouse-action-row">
            <button type="submit" class="warehouse-button">Confirmar pickup</button>
            <button type="button" id="ir-pickup-cancel" class="warehouse-button secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/** Catálogo de motivos de ajuste con etiquetas legibles para el operador. */
const ADJUSTMENT_REASONS = [
  { value: 'PHYSICAL_COUNT',        label: 'Conteo físico' },
  { value: 'DAMAGED_GOODS',         label: 'Producto dañado' },
  { value: 'EXPIRED_PRODUCT',       label: 'Producto vencido' },
  { value: 'LOSS_OR_THEFT',         label: 'Robo o extravío' },
  { value: 'RECORDING_ERROR',       label: 'Error de registro previo' },
  { value: 'PRODUCTION_ADJUSTMENT', label: 'Ajuste por producción' },
  { value: 'PRODUCTION_RETURN',     label: 'Devolución de producción' },
  { value: 'MANUAL_ADJUSTMENT',     label: 'Otro' },
];

function renderExecuteAdjustmentModal(req) {
  const id = esc(String(req.id || ''));
  const lotLabel = esc(req.lot?.lotNumber || req.lot?.internalLotNumber || String(req.lotId || ''));
  const productName = esc(req.product?.name || String(req.productId || ''));
  const warehouseName = esc(req.sourceWarehouse?.name || String(req.sourceWarehouseId || ''));
  const adminNote = req.note ? esc(req.note) : null;

  // Stock real por bodega — viene de warehouseStocks incluido en el API
  const ws = (req.lot?.warehouseLotStocks ?? []).find((s) => s.warehouseId === req.sourceWarehouseId);
  const stockActual = ws != null ? Number(ws.quantity) : null;
  const stockDisplay = stockActual != null ? String(stockActual) : '—';

  const reasonOptions = ADJUSTMENT_REASONS
    .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
    .join('');

  return `
    <div class="warehouse-modal-backdrop" id="ir-execute-modal" role="dialog" aria-modal="true" aria-labelledby="ir-execute-modal-title">
      <div class="warehouse-modal">
        <h3 id="ir-execute-modal-title">Registrar ajuste — Solicitud #${id}</h3>
        <dl class="warehouse-detail-list">
          <dt>Lote</dt><dd>${lotLabel}</dd>
          <dt>Producto</dt><dd>${productName}</dd>
          <dt>Bodega</dt><dd>${warehouseName}</dd>
          <dt>Stock en sistema</dt><dd><strong>${stockDisplay} uds.</strong></dd>
          ${adminNote ? `<dt>Instrucción</dt><dd class="ir-admin-note">${adminNote}</dd>` : ''}
        </dl>
        <form id="ir-execute-form">
          <input type="hidden" name="requestId" value="${id}" />
          <input type="hidden" name="stockActual" value="${stockActual ?? ''}" />
          <label class="warehouse-label">
            <span>Tipo de ajuste *</span>
            <select name="adjustmentType" id="ir-adjustment-type" class="warehouse-input" required>
              <option value="count">Conté el lote — ingreso total contado</option>
              <option value="damage">Doy de baja producto — ingreso cantidad a retirar</option>
            </select>
          </label>
          <label class="warehouse-label">
            <span id="ir-qty-span">Cantidad contada *</span>
            <input type="number" name="countedQty" id="ir-counted-qty" step="any" min="0" class="warehouse-input" required />
          </label>
          <p id="ir-adjustment-preview" class="warehouse-adjustment-preview" hidden></p>
          <label class="warehouse-label">
            <span>Motivo *</span>
            <select name="reasonCode" class="warehouse-input" required>
              ${reasonOptions}
            </select>
          </label>
          <label class="warehouse-label">
            <span>Nota del operador</span>
            <input type="text" name="operatorNote" maxlength="500" class="warehouse-input" placeholder="Opcional" />
          </label>
          <div class="warehouse-action-row">
            <button type="submit" class="warehouse-button">Registrar ajuste</button>
            <button type="button" id="ir-execute-cancel" class="warehouse-button secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderConfirmDeliveryModal(req) {
  const id = esc(String(req.id || ''));
  const lotLabel = esc(req.lot?.lotNumber || req.lot?.internalLotNumber || String(req.lotId || ''));
  const productName = esc(req.product?.name || String(req.productId || ''));
  const destWarehouse = esc(req.destinationWarehouse?.name || String(req.destinationWarehouseId || ''));
  return `
    <div class="warehouse-modal-backdrop" id="ir-confirm-delivery-modal" role="dialog" aria-modal="true" aria-labelledby="ir-confirm-delivery-modal-title">
      <div class="warehouse-modal">
        <h3 id="ir-confirm-delivery-modal-title">Confirmar entrega — Solicitud #${id}</h3>
        <dl class="warehouse-detail-list">
          <dt>Lote</dt><dd>${lotLabel}</dd>
          <dt>Producto</dt><dd>${productName}</dd>
          <dt>Destino</dt><dd>${destWarehouse}</dd>
        </dl>
        <form id="ir-confirm-delivery-form">
          <input type="hidden" name="requestId" value="${id}" />
          <label class="warehouse-label">
            <span>Nota del operador</span>
            <input type="text" name="operatorNote" maxlength="500" class="warehouse-input" placeholder="Opcional" />
          </label>
          <div class="warehouse-action-row">
            <button type="submit" class="warehouse-button">Confirmar entrega</button>
            <button type="button" id="ir-confirm-delivery-cancel" class="warehouse-button secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderExecuteTransferModal(req) {
  const id = esc(String(req.id || ''));
  const lotLabel = esc(req.lot?.lotNumber || req.lot?.internalLotNumber || String(req.lotId || ''));
  const productName = esc(req.product?.name || String(req.productId || ''));
  return `
    <div class="warehouse-modal-backdrop" id="ir-execute-modal" role="dialog" aria-modal="true" aria-labelledby="ir-execute-modal-title">
      <div class="warehouse-modal">
        <h3 id="ir-execute-modal-title">Ejecutar traslado — Solicitud #${id}</h3>
        <dl class="warehouse-detail-list">
          <dt>Lote</dt><dd>${lotLabel}</dd>
          <dt>Producto</dt><dd>${productName}</dd>
        </dl>
        <form id="ir-execute-form">
          <input type="hidden" name="requestId" value="${id}" />
          <label class="warehouse-label">
            <span>Nota del operador</span>
            <input type="text" name="operatorNote" maxlength="500" class="warehouse-input" placeholder="Opcional" />
          </label>
          <div class="warehouse-action-row">
            <button type="submit" class="warehouse-button">Confirmar traslado</button>
            <button type="button" id="ir-execute-cancel" class="warehouse-button secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderMessage(text, isError = false) {
  return `<p class="warehouse-message ${isError ? 'warehouse-message--error' : 'warehouse-message--success'}">${esc(text)}</p>`;
}

// ─── Main view ───────────────────────────────────────────────────────────────

async function render(container, session) {
  container.innerHTML = '<p class="warehouse-empty">Cargando solicitudes...</p>';

  try {
    const response = await warehouseApi.listInventoryRequests(session, { status: 'PENDING,IN_PROGRESS,DELIVERED' });
    const items = Array.isArray(response) ? response : (response?.items || []);

    if (!items.length) {
      container.innerHTML = renderEmpty();
      return;
    }

    container.innerHTML = renderRequestsTable(items);
    const messageRegion = document.createElement('div');
    messageRegion.id = 'ir-message';
    container.prepend(messageRegion);

    container.addEventListener('click', async (event) => {
      const target = /** @type {HTMLElement|null} */ (event.target instanceof window.HTMLElement ? event.target : null);
      if (!target) return;

      // Pickup button
      const pickupBtn = target.closest('[data-pickup-request-id]');
      if (pickupBtn instanceof window.HTMLElement) {
        const reqId = pickupBtn.getAttribute('data-pickup-request-id');
        const req = items.find((r) => String(r.id) === reqId);
        if (!req) return;
        const existingModal = document.getElementById('ir-pickup-modal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', renderPickupModal(req));

        const modal = document.getElementById('ir-pickup-modal');
        const cancelBtn = document.getElementById('ir-pickup-cancel');
        const form = document.getElementById('ir-pickup-form');
        if (cancelBtn) cancelBtn.addEventListener('click', () => modal && modal.remove());

        if (form instanceof window.HTMLFormElement) {
          form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const fd = new window.FormData(form);
            try {
              await warehouseApi.pickupInventoryRequest(session, reqId, {
                operatorNote: fd.get('operatorNote') || undefined,
              });
              if (modal) modal.remove();
              messageRegion.innerHTML = renderMessage('Pickup confirmado. El traslado está en tránsito.');
              await render(container, session);
            } catch (err) {
              messageRegion.innerHTML = renderMessage((/** @type {any} */ (err))?.message || 'No se pudo confirmar pickup.', true);
              if (modal) modal.remove();
            }
          });
        }
        return;
      }

      // Confirm delivery button
      const confirmDeliveryBtn = target.closest('[data-confirm-delivery-request-id]');
      if (confirmDeliveryBtn instanceof window.HTMLElement) {
        const reqId = confirmDeliveryBtn.getAttribute('data-confirm-delivery-request-id');
        const req = items.find((r) => String(r.id) === reqId);
        if (!req) return;
        const existingModal = document.getElementById('ir-confirm-delivery-modal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', renderConfirmDeliveryModal(req));

        const modal = document.getElementById('ir-confirm-delivery-modal');
        const cancelBtn = document.getElementById('ir-confirm-delivery-cancel');
        const form = document.getElementById('ir-confirm-delivery-form');
        if (cancelBtn) cancelBtn.addEventListener('click', () => modal && modal.remove());

        if (form instanceof window.HTMLFormElement) {
          form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const fd = new window.FormData(form);
            try {
              await warehouseApi.confirmDeliveryInventoryRequest(session, reqId, {
                operatorNote: fd.get('operatorNote') || undefined,
              });
              if (modal) modal.remove();
              messageRegion.innerHTML = renderMessage('Entrega confirmada. Listo para finalizar.');
              await render(container, session);
            } catch (err) {
              messageRegion.innerHTML = renderMessage((/** @type {any} */ (err))?.message || 'No se pudo confirmar la entrega.', true);
              if (modal) modal.remove();
            }
          });
        }
        return;
      }

      // Execute / Finalizar button
      const executeBtn = target.closest('[data-execute-request-id]');
      if (executeBtn instanceof window.HTMLElement) {
        const reqId = executeBtn.getAttribute('data-execute-request-id');
        const reqType = executeBtn.getAttribute('data-request-type');
        const req = items.find((r) => String(r.id) === reqId);
        if (!req) return;
        const existingModal = document.getElementById('ir-execute-modal');
        if (existingModal) existingModal.remove();
        const modalHtml = reqType === 'TRANSFER'
          ? renderExecuteTransferModal(req)
          : renderExecuteAdjustmentModal(req);
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('ir-execute-modal');
        const cancelBtn = document.getElementById('ir-execute-cancel');
        const form = document.getElementById('ir-execute-form');
        if (cancelBtn) cancelBtn.addEventListener('click', () => modal && modal.remove());

        // Preview dinámico solo para ajustes
        if (reqType === 'ADJUSTMENT' && form instanceof window.HTMLFormElement) {
          const adjustTypeSelect = form.querySelector('#ir-adjustment-type');
          const countedInput    = form.querySelector('#ir-counted-qty');
          const preview         = form.querySelector('#ir-adjustment-preview');
          const qtySpan         = form.querySelector('#ir-qty-span');
          const stockActualVal  = Number(form.querySelector('[name="stockActual"]')?.value ?? '') || 0;

          /** Actualiza el label del campo y el preview en tiempo real. */
          function updateAdjustmentPreview() {
            const type    = /** @type {HTMLSelectElement|null} */ (adjustTypeSelect)?.value;
            const counted = Number(/** @type {HTMLInputElement|null} */ (countedInput)?.value);
            if (qtySpan) qtySpan.textContent = type === 'damage' ? 'Cantidad a dar de baja *' : 'Cantidad contada *';
            if (!/** @type {HTMLInputElement|null} */ (countedInput)?.value || Number.isNaN(counted) || counted < 0) {
              if (preview) /** @type {HTMLElement} */ (preview).hidden = true;
              return;
            }
            let resultQty, deltaLabel, cls;
            if (type === 'damage') {
              resultQty  = stockActualVal - counted;
              deltaLabel = `\u2212${counted}`;
              cls        = 'warehouse-adjustment-preview--out';
            } else {
              const delta = counted - stockActualVal;
              resultQty  = counted;
              if (delta > 0)      { deltaLabel = `+${delta}`;  cls = 'warehouse-adjustment-preview--in'; }
              else if (delta < 0) { deltaLabel = `${delta}`;   cls = 'warehouse-adjustment-preview--out'; }
              else                { deltaLabel = 'sin cambio'; cls = ''; }
            }
            if (preview) {
              /** @type {HTMLElement} */ (preview).hidden    = false;
              /** @type {HTMLElement} */ (preview).textContent = `${stockActualVal} \u2192 ${resultQty} (${deltaLabel})`;
              /** @type {HTMLElement} */ (preview).className  = `warehouse-adjustment-preview ${cls}`;
            }
          }
          if (adjustTypeSelect) adjustTypeSelect.addEventListener('change', updateAdjustmentPreview);
          if (countedInput)     countedInput.addEventListener('input', updateAdjustmentPreview);
        }

        if (form instanceof window.HTMLFormElement) {
          form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            if (!form.reportValidity()) return;
            const fd      = new window.FormData(form);
            const payload = { operatorNote: fd.get('operatorNote') || undefined };

            if (reqType === 'ADJUSTMENT') {
              const adjustType  = fd.get('adjustmentType');
              const counted     = Number(fd.get('countedQty'));
              const stockActual = Number(fd.get('stockActual')) || 0;
              let direction, actualQuantity;
              if (adjustType === 'damage') {
                direction      = 'OUT';
                actualQuantity = counted;
              } else {
                const delta = counted - stockActual;
                if (delta === 0) {
                  messageRegion.innerHTML = renderMessage('El conteo coincide con el stock del sistema. No se realizó ajuste.', true);
                  if (modal) modal.remove();
                  return;
                }
                direction      = delta > 0 ? 'IN' : 'OUT';
                actualQuantity = Math.abs(delta);
              }
              /** @type {any} */ (payload).direction      = direction;
              /** @type {any} */ (payload).actualQuantity = actualQuantity;
              /** @type {any} */ (payload).reasonCode     = fd.get('reasonCode');
            }

            try {
              await warehouseApi.executeInventoryRequest(session, reqId, payload);
              if (modal) modal.remove();
              const lotNum    = req.lot?.lotNumber || req.lot?.internalLotNumber || '';
              const whName    = req.sourceWarehouse?.name || 'la bodega';
              messageRegion.innerHTML = renderMessage(`Ajuste registrado. Lote ${lotNum} actualizado en ${whName}.`);
              await render(container, session);
            } catch (err) {
              messageRegion.innerHTML = renderMessage((/** @type {any} */ (err))?.message || 'No se pudo ejecutar la solicitud.', true);
              if (modal) modal.remove();
            }
          });
        }
        return;
      }
    });
  } catch (err) {
    container.innerHTML = renderMessage((/** @type {any} */ (err))?.message || 'No se pudieron cargar las solicitudes.', true);
  }
}

WarehouseShell.register('views.inventoryRequests', { render });
})();
