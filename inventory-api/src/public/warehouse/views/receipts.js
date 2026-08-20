/**
 * Warehouse SPA — Receipts view.
 *
 * Implements the 4-step receipt workflow:
 *  Step 1: Record arrival (quantity, lot, expiration per item)
 *  Step 2: QA inspection (accepted / partially accepted / rejected)
 *  Step 3: Photo evidence (optional)
 *  Step 4: Confirm receipt → POST /api/receipts/:id/confirm
 *
 * Permission: warehouse.receive (confirmation) | quality.inspect (inspection)
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

const RECEIPT_STATUS_LABELS = /** @type {Record<string, string>} */ ({
  PENDING_INSPECTION: 'Pendiente inspeccion',
  ACCEPTED:           'Aceptado',
  PARTIALLY_ACCEPTED: 'Aceptado parcial',
  REJECTED:           'Rechazado',
  CONFIRMED:          'Confirmado',
  REVERSED:           'Revertido',
});

const RECEIPT_STATUS_BADGE = /** @type {Record<string, string>} */ ({
  PENDING_INSPECTION: 'wh-badge--pending',
  ACCEPTED:           'wh-badge--confirmed',
  PARTIALLY_ACCEPTED: 'wh-badge--partial',
  REJECTED:           'wh-badge--rejected',
  CONFIRMED:          'wh-badge--confirmed',
  REVERSED:           'wh-badge--hold',
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderStatusBadge(status) {
  const label = RECEIPT_STATUS_LABELS[status] || status;
  const cls = RECEIPT_STATUS_BADGE[status] || 'wh-badge--pending';
  return `<span class="wh-badge ${cls}">${escapeHtml(label)}</span>`;
}

// -----------------------------------------------------------------------
// Receipt list view
// -----------------------------------------------------------------------

function renderReceiptList(container, session) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');
  const state = WarehouseShell.require('state');
  const permissions = state.derivePermissions(session);

  container.innerHTML = `
    <div class="warehouse-section">
      <div class="wh-order-detail__header">
        <h2 class="warehouse-section__title" style="flex:1">Recepciones pendientes</h2>
        ${permissions.canReceive
          ? `<button type="button"
                     class="primary-button"
                     id="receipts-new-from-po-btn"
                     aria-label="Crear nueva recepción desde una Orden de Compra">
               + Nueva desde OC
             </button>`
          : ''}
      </div>
      <p id="receipts-status" role="status" aria-live="polite">Cargando recepciones...</p>
      <ul id="receipts-list" class="warehouse-card-list" aria-label="Lista de recepciones"></ul>
    </div>
  `;

  container.querySelector('#receipts-new-from-po-btn')
    ?.addEventListener('click', () => { app.navigate('receive-from-po'); });

  const statusEl = /** @type {HTMLElement} */ (container.querySelector('#receipts-status'));
  const listEl = /** @type {HTMLElement} */ (container.querySelector('#receipts-list'));

  api.listPendingReceipts(session)
    .then((/** @type {any[]} */ receipts) => {
      statusEl.hidden = true;
      if (!receipts || receipts.length === 0) {
        listEl.innerHTML = '<li class="warehouse-empty">No hay recepciones pendientes.</li>';
        return;
      }

      listEl.innerHTML = '';
      for (const receipt of receipts) {
        const li = document.createElement('li');
        li.innerHTML = `
          <article class="wh-receipt-card">
            <div class="wh-receipt-card__header">
              <span class="wh-receipt-card__id">#${escapeHtml(String(receipt.id))}</span>
              ${renderStatusBadge(receipt.status)}
            </div>
            <p class="wh-receipt-card__meta">
              Proveedor: ${escapeHtml(receipt.supplier?.name || receipt.supplierId || '—')}
            </p>
            <p class="wh-receipt-card__meta">
              ${escapeHtml(String(receipt.items?.length || 0))} items
              · ${escapeHtml(receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString('es') : '—')}
            </p>
            <div class="wh-receipt-card__cta">
              <button type="button" class="primary-button wh-receipt-card__view-btn"
                      data-receipt-id="${escapeHtml(String(receipt.id))}">Ver →</button>
            </div>
          </article>
        `;
        listEl.append(li);
      }

      listEl.addEventListener('click', (evt) => {
        const btn = /** @type {HTMLElement} */ (evt.target);
        if (btn.classList.contains('wh-receipt-card__view-btn')) {
          const rid = btn.dataset.receiptId;
          if (rid) { app.navigate('receipts', { id: rid, step: '1' }); }
        }
      });
    })
    .catch((/** @type {any} */ err) => {
      statusEl.textContent = err?.message || 'Error al cargar recepciones.';
    });
}

// -----------------------------------------------------------------------
// Receipt detail view (4-step workflow)
// -----------------------------------------------------------------------

function renderReceiptDetail(container, session, params) {
  const app = WarehouseShell.require('app');
  const api = WarehouseShell.require('warehouseApi');

  const receiptId = params.id;
  const step = parseInt(params.step || '1', 10);

  if (!receiptId) {
    app.navigate('receipts');
    return;
  }

  container.innerHTML = `
    <div class="warehouse-section">
      <button type="button" class="wh-back-btn" id="back-to-list">← Recepciones</button>
      <p id="receipt-detail-status" role="status" aria-live="polite">Cargando recepcion...</p>
      <div id="receipt-detail-content"></div>
    </div>
  `;

  const statusEl = /** @type {HTMLElement} */ (container.querySelector('#receipt-detail-status'));
  const contentEl = /** @type {HTMLElement} */ (container.querySelector('#receipt-detail-content'));
  const backBtn = container.querySelector('#back-to-list');
  if (backBtn) { backBtn.addEventListener('click', () => { app.navigate('receipts'); }); }

  api.getReceipt(session, receiptId)
    .then((/** @type {any} */ receipt) => {
      statusEl.hidden = true;
      renderStep(contentEl, session, receipt, step, params);
    })
    .catch((/** @type {any} */ err) => {
      statusEl.textContent = err?.message || 'Error al cargar la recepcion.';
    });
}

function renderStep(container, session, receipt, step, params) {
  const app = WarehouseShell.require('app');
  const stepLabels = ['Llegada', 'Inspeccion', 'Evidencia', 'Confirmar'];

  container.innerHTML = `
    <header class="wh-receipt-detail__header">
      <span class="wh-receipt-card__id">#${escapeHtml(String(receipt.id))}</span>
      ${renderStatusBadge(receipt.status)}
    </header>
    ${renderStepper(step, stepLabels)}
    <div id="step-content"></div>
    <div class="wh-step-nav" id="step-nav"></div>
  `;

  const stepContent = /** @type {HTMLElement} */ (container.querySelector('#step-content'));
  const stepNav = /** @type {HTMLElement} */ (container.querySelector('#step-nav'));

  function goToStep(s) {
    app.navigate('receipts', { ...params, step: String(s) });
  }

  if (step === 1) {
    renderStepArrival(stepContent, stepNav, receipt, params, goToStep);
  } else if (step === 2) {
    renderStepInspection(stepContent, stepNav, session, receipt, params, goToStep);
  } else if (step === 3) {
    renderStepEvidence(stepContent, stepNav, receipt, params, goToStep);
  } else if (step === 4) {
    renderStepConfirm(stepContent, stepNav, session, receipt, params, goToStep);
  } else {
    goToStep(1);
  }
}

function renderStepper(activeStep, labels) {
  let html = '<div class="wh-stepper" aria-label="Progreso del proceso">';
  for (let i = 0; i < labels.length; i++) {
    const stepNum = i + 1;
    let dotClass = 'wh-stepper__dot';
    if (stepNum < activeStep) { dotClass += ' wh-stepper__dot--done'; }
    else if (stepNum === activeStep) { dotClass += ' wh-stepper__dot--active'; }

    if (i > 0) {
      const lineClass = stepNum <= activeStep ? 'wh-stepper__line wh-stepper__line--done' : 'wh-stepper__line';
      html += `<div class="${lineClass}" aria-hidden="true"></div>`;
    }
    html += `<div class="${dotClass}" aria-label="Paso ${stepNum}: ${labels[i]}">${stepNum}</div>`;
  }
  html += '</div>';
  return html;
}

// Step 1: Arrival (display only — capturing happens via inspection endpoint)
// Shared helpers (Step 1, Step 2, Step 4 all display item info)
function getItemProductName(item, idx) {
  return item.product?.name || item.productName || `Item ${idx + 1}`;
}

function getItemProductSku(item) {
  return item.product?.sku || item.product?.code || '';
}

function getItemInspectionStatus(item) {
  const inspection = latestInspection(item);
  return inspection ? inspection.result : 'PENDING_INSPECTION';
}

function getItemAcceptedQuantity(item) {
  const inspection = latestInspection(item);
  return inspection ? Number(inspection.quantityAccepted ?? 0) : 0;
}

function renderStepArrival(container, nav, receipt, params, goToStep) {
  const items = receipt.items || [];
  container.innerHTML = `
    <section class="wh-step-section">
      <h2 class="wh-step-section__title">Paso 1 — Registrar llegada</h2>
      <p class="wh-step-section__hint">Revise los items de la recepcion y verifique las cantidades y lotes registradas al crear la recepcion.</p>
      <ul class="wh-item-list">
        ${items.map((/** @type {any} */ item, idx) => {
          const sku = getItemProductSku(item);
          return `
          <li class="wh-item-card">
            <h3 class="wh-item-card__name">
              ${escapeHtml(getItemProductName(item, idx))}
              ${sku ? `<small style="font-weight:400">&nbsp;· ${escapeHtml(sku)}</small>` : ''}
            </h3>
            <p class="wh-item-card__meta">Solicitado: <strong>${escapeHtml(String(item.requestedQuantity || 0))}</strong></p>
            <p class="wh-item-card__meta">Recibido: <strong>${escapeHtml(String(item.receivedQuantity ?? 0))}</strong></p>
            ${item.lotNumber ? `<p class="wh-item-card__meta">Lote: <strong>${escapeHtml(item.lotNumber)}</strong></p>` : ''}
            <p class="wh-item-card__meta">Estado: ${renderStatusBadge(getItemInspectionStatus(item))}</p>
          </li>
        `;
        }).join('')}
      </ul>
    </section>
  `;

  nav.innerHTML = `
    <button type="button" class="primary-button" id="go-to-step-2">Ir a Inspeccion →</button>
  `;
  nav.querySelector('#go-to-step-2')?.addEventListener('click', () => goToStep(2));
}

// Step 2: Interactive inspection form (per-item)
function latestInspection(item) {
  const inspections = item.inspections || [];
  if (inspections.length === 0) { return null; }
  const sorted = inspections.slice().sort((a, b) => {
    const da = new Date(a.inspectedAt || a.createdAt || 0).getTime();
    const db = new Date(b.inspectedAt || b.createdAt || 0).getTime();
    return db - da;
  });
  return sorted[0];
}

function renderInspectedItemReadOnly(item, idx) {
  const inspection = latestInspection(item);
  return `
    <li class="wh-item-card wh-item-card--inspected">
      <h3 class="wh-item-card__name">${escapeHtml(getItemProductName(item, idx))}</h3>
      <p class="wh-item-card__meta">Recibido: <strong>${escapeHtml(String(item.receivedQuantity ?? 0))}</strong></p>
      <p class="wh-item-card__meta">Aceptado: <strong>${escapeHtml(String(inspection.quantityAccepted ?? 0))}</strong></p>
      <p class="wh-item-card__meta">Rechazado: <strong>${escapeHtml(String(inspection.quantityRejected ?? 0))}</strong></p>
      <p class="wh-item-card__meta">Resultado: ${renderStatusBadge(inspection.result)}</p>
      ${inspection.observations
        ? `<p class="wh-item-card__meta">Observaciones: ${escapeHtml(inspection.observations)}</p>`
        : ''}
    </li>
  `;
}

function renderPendingItemForm(item, idx) {
  const itemId = String(item.id);
  const received = Number(item.receivedQuantity ?? 0);
  return `
    <li class="wh-item-card wh-item-card--pending" data-item-id="${escapeHtml(itemId)}">
      <h3 class="wh-item-card__name">${escapeHtml(getItemProductName(item, idx))}</h3>
      <p class="wh-item-card__meta">Recibido: <strong>${escapeHtml(String(received))}</strong></p>

      <div class="field">
        <label for="inspect-qty-accepted-${escapeHtml(itemId)}">Cantidad aceptada *</label>
        <input type="number"
               id="inspect-qty-accepted-${escapeHtml(itemId)}"
               class="inspect-qty-accepted"
               min="0" max="${escapeHtml(String(received))}"
               value="${escapeHtml(String(received))}"
               required aria-required="true" />
      </div>

      <div class="field">
        <label for="inspect-qty-rejected-${escapeHtml(itemId)}">Cantidad rechazada</label>
        <input type="number"
               id="inspect-qty-rejected-${escapeHtml(itemId)}"
               class="inspect-qty-rejected"
               min="0" max="${escapeHtml(String(received))}"
               value="0" />
      </div>

      <div class="field">
        <label for="inspect-result-${escapeHtml(itemId)}">Resultado *</label>
        <select id="inspect-result-${escapeHtml(itemId)}" class="inspect-result" required aria-required="true">
          <option value="ACCEPTED">Aceptado</option>
          <option value="PARTIALLY_ACCEPTED">Aceptado parcial</option>
          <option value="REJECTED">Rechazado</option>
        </select>
      </div>

      <div class="field">
        <label for="inspect-observations-${escapeHtml(itemId)}">Observaciones</label>
        <textarea id="inspect-observations-${escapeHtml(itemId)}"
                  class="inspect-observations"
                  rows="2" maxlength="1000"
                  placeholder="Notas de la inspeccion (opcional)"></textarea>
      </div>

      <button type="button"
              class="primary-button inspect-save-btn"
              id="inspect-save-btn-${escapeHtml(itemId)}"
              data-item-id="${escapeHtml(itemId)}">
        Guardar inspeccion
      </button>
      <p class="wh-error-msg" id="inspect-error-${escapeHtml(itemId)}" role="alert" aria-live="assertive" hidden></p>
    </li>
  `;
}

function validateInspectionInputs(accepted, rejected, result, received) {
  if (!Number.isFinite(accepted) || accepted < 0) { return 'La cantidad aceptada debe ser un numero >= 0.'; }
  if (!Number.isFinite(rejected) || rejected < 0) { return 'La cantidad rechazada debe ser un numero >= 0.'; }
  if (accepted + rejected > received) { return 'La suma de aceptado + rechazado no puede superar lo recibido.'; }
  if (result === 'REJECTED' && accepted > 0) { return 'Si el resultado es RECHAZADO, la cantidad aceptada debe ser 0.'; }
  if (result === 'ACCEPTED' && rejected > 0) { return 'Si el resultado es ACEPTADO, la cantidad rechazada debe ser 0.'; }
  return null;
}

function wireInspectionSaveHandler(container, api, session, receipt, item, params) {
  const itemId = String(item.id);
  const escapedId = window.CSS && window.CSS.escape ? window.CSS.escape(itemId) : itemId;
  const saveBtn = /** @type {HTMLButtonElement | null} */ (container.querySelector(`#inspect-save-btn-${escapedId}`));
  const errorEl = /** @type {HTMLElement | null} */ (container.querySelector(`#inspect-error-${escapedId}`));
  if (!saveBtn || !errorEl) { return; }

  saveBtn.addEventListener('click', async () => {
    const acceptedInput = /** @type {HTMLInputElement} */ (container.querySelector(`#inspect-qty-accepted-${escapedId}`));
    const rejectedInput = /** @type {HTMLInputElement} */ (container.querySelector(`#inspect-qty-rejected-${escapedId}`));
    const resultSelect = /** @type {HTMLSelectElement} */ (container.querySelector(`#inspect-result-${escapedId}`));
    const observationsEl = /** @type {HTMLTextAreaElement} */ (container.querySelector(`#inspect-observations-${escapedId}`));

    const accepted = Number(acceptedInput.value);
    const rejected = Number(rejectedInput.value || 0);
    const result = resultSelect.value;
    const received = Number(item.receivedQuantity ?? 0);
    const observations = observationsEl.value.trim();

    errorEl.hidden = true;
    const validationError = validateInspectionInputs(accepted, rejected, result, received);
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      return;
    }

    saveBtn.disabled = true;
    const originalLabel = saveBtn.textContent;
    saveBtn.textContent = 'Guardando...';

    try {
      await api.inspectReceiptItem(session, receipt.id, item.id, {
        result: result,
        quantityAccepted: accepted,
        quantityRejected: rejected,
        observations: observations || null,
      });
      const app = WarehouseShell.require('app');
      // Force reload by re-navigating; fetches fresh receipt with new inspection
      app.navigate('receipts', { ...params, step: '2' });
    } catch (err) {
      errorEl.textContent = err?.message || 'No se pudo guardar la inspeccion.';
      errorEl.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = originalLabel;
    }
  });
}

function renderStepInspection(container, nav, session, receipt, params, goToStep) {
  const api = WarehouseShell.require('warehouseApi');
  const items = receipt.items || [];

  const itemsHtml = items.map((/** @type {any} */ item, idx) => {
    const hasInspection = (item.inspections || []).length > 0;
    return hasInspection
      ? renderInspectedItemReadOnly(item, idx)
      : renderPendingItemForm(item, idx);
  }).join('');

  const allInspected = items.length > 0
    && items.every((/** @type {any} */ item) => (item.inspections || []).length > 0);

  container.innerHTML = `
    <section class="wh-step-section">
      <h2 class="wh-step-section__title">Paso 2 — Inspeccion de items</h2>
      <p class="wh-step-section__hint">Registre el resultado de inspeccion de cada item. Debe inspeccionar todos antes de continuar.</p>
      <ul class="wh-item-list">${itemsHtml}</ul>
    </section>
  `;

  for (const item of items) {
    const alreadyInspected = (item.inspections || []).length > 0;
    if (!alreadyInspected) {
      wireInspectionSaveHandler(container, api, session, receipt, item, params);
    }
  }

  nav.innerHTML = `
    <button type="button" class="secondary-button" id="back-to-step-1">← Llegada</button>
    <button type="button" class="primary-button" id="go-to-step-3" ${allInspected ? '' : 'disabled aria-disabled="true"'}>Ir a Evidencia →</button>
    ${allInspected ? '' : '<p class="wh-step-section__hint">Complete la inspeccion de todos los items para avanzar.</p>'}
  `;
  nav.querySelector('#back-to-step-1')?.addEventListener('click', () => goToStep(1));
  nav.querySelector('#go-to-step-3')?.addEventListener('click', () => { if (allInspected) { goToStep(3); } });
}

// Step 3: Photo evidence
function renderStepEvidence(container, nav, receipt, params, goToStep) {
  const captures = WarehouseShell.require('captures');

  container.innerHTML = '<section class="wh-step-section"><h2 class="wh-step-section__title">Paso 3 — Evidencia (opcional)</h2><div class="wh-alert wh-alert--info" role="note">Las fotos capturadas en esta version se usan como apoyo visual local durante la revision y aun no se cargan al servidor.</div></section>';
  const section = container.querySelector('.wh-step-section');

  const photoCapture = captures.createPhotoCapture({
    label: 'Evidencia fotografica de llegada (opcional)',
    multiple: true,
    onFilesChanged: (_files) => { /* files reserved for future upload feature */ },
  });
  if (section) { section.append(photoCapture); }

  nav.innerHTML = `
    <button type="button" class="secondary-button" id="back-to-step-2">← Inspeccion</button>
    <button type="button" class="primary-button" id="go-to-step-4">Ir a Confirmar →</button>
  `;
  nav.querySelector('#back-to-step-2')?.addEventListener('click', () => {
    photoCapture.destroy?.();
    goToStep(2);
  });
  nav.querySelector('#go-to-step-4')?.addEventListener('click', () => {
    photoCapture.destroy?.();
    goToStep(4);
  });
}

// Step 4: Confirm
function renderStepConfirm(container, nav, session, receipt, params, goToStep) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');
  const items = receipt.items || [];

  const acceptedItems = items.filter((/** @type {any} */ i) => getItemAcceptedQuantity(i) > 0);

  container.innerHTML = `
    <section class="wh-step-section">
      <h2 class="wh-step-section__title">Paso 4 — Confirmar recepcion</h2>
      <p class="wh-step-section__hint">Revise el resumen antes de confirmar.</p>
      <ul class="wh-item-list">
        ${items.map((/** @type {any} */ item, idx) => {
          const result = getItemInspectionStatus(item);
          const accepted = getItemAcceptedQuantity(item);
          return `
            <li class="wh-item-card wh-item-card--result-${result.toLowerCase()}">
              <h3 class="wh-item-card__name">${escapeHtml(getItemProductName(item, idx))}</h3>
              <p class="wh-item-card__meta">${renderStatusBadge(result)}</p>
              ${accepted > 0
                ? `<p class="wh-item-card__meta">Stock a crear: <strong>+${escapeHtml(String(accepted))}</strong></p>`
                : ''}
            </li>
          `;
        }).join('')}
      </ul>
      ${acceptedItems.length === 0
        ? '<p class="wh-alert wh-alert--warning">No hay items aceptados. No se creara stock.</p>'
        : ''}
      <div class="wh-alert wh-alert--info" role="note" aria-label="Advertencia de accion irreversible">
        Esta accion no puede deshacerse. Solo se puede revertir mediante un movimiento de reversal.
      </div>
    </section>
  `;

  nav.innerHTML = `
    <button type="button" class="secondary-button" id="back-to-step-3">← Evidencia</button>
    <button type="button" class="primary-button" id="confirm-receipt-btn">Confirmar recepcion ✓</button>
    <p id="confirm-error" class="wh-error-msg" hidden></p>
  `;

  nav.querySelector('#back-to-step-3')?.addEventListener('click', () => goToStep(3));

  const confirmBtn = /** @type {HTMLButtonElement | null} */ (nav.querySelector('#confirm-receipt-btn'));
  const errorEl = /** @type {HTMLElement | null} */ (nav.querySelector('#confirm-error'));

  confirmBtn?.addEventListener('click', () => {
    if (!confirmBtn) { return; }
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirmando...';
    if (errorEl) { errorEl.hidden = true; }

    api.confirmReceipt(session, receipt.id)
      .then(() => {
        app.showToast('Recepcion confirmada exitosamente ✓');
        app.navigate('receipts');
      })
      .catch((/** @type {any} */ err) => {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar recepcion ✓';
        if (errorEl) {
          errorEl.textContent = err?.message || 'No se pudo confirmar la recepcion. Intente de nuevo.';
          errorEl.hidden = false;
        }
      });
  });
}

// -----------------------------------------------------------------------
// Main render entry point
// -----------------------------------------------------------------------

function render(container, session, params) {
  if (params.id) {
    renderReceiptDetail(container, session, params);
  } else {
    renderReceiptList(container, session);
  }
}

WarehouseShell.register('views.receipts', { render });
})();
