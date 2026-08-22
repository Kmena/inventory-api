/**
 * Warehouse SPA — Production event controllers.
 *
 * Attaches DOM event handlers after renderers paint the UI.
 * Each attach* function takes (container, session, deps) and wires events.
 *
 * Pure helper functions extracted to production.exec-helpers.js (NFR-006).
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// Lazy reference: helpers are registered before controllers in index.html.
function helpers() {
  return WarehouseShell.require('views.productionExecHelpers');
}

// -----------------------------------------------------------------------
// Lot picker live validation (DOM-attaching; calls helpers for pure logic)
// -----------------------------------------------------------------------

function updateLotTotals(container) {
  container.querySelectorAll('.lot-picker-block').forEach((block) => {
    const required = Number(
      block.closest('[data-required-qty]')?.dataset?.requiredQty
      ?? block.dataset?.requiredQty
      ?? 0,
    );

    let total = 0;
    block.querySelectorAll('.lot-row').forEach((row) => {
      const lotId = row.querySelector('.lot-select')?.value;
      const qty = Number(row.querySelector('.lot-qty')?.value || 0);
      if (lotId && qty > 0) { total += qty; }
    });

    const tolerancePct = Number(block.dataset.tolerancePct ?? 5) / 100;
    const allowedMax = required > 0 ? required * (1 + tolerancePct) : Infinity;
    const overLimit = required > 0 && total > allowedMax + 0.0001;
    const underRequired = required > 0 && total + 0.0001 < required;
    block.dataset.overLimit = overLimit ? 'true' : 'false';
    block.dataset.underRequired = underRequired ? 'true' : 'false';

    const display = block.querySelector('.lot-total-display');
    if (display) {
      const unit = block.dataset.unit || '';
      const difference = Math.abs(total - required);
      let suffix = '';
      if (underRequired) {
        suffix = ` · Pendiente: ${difference} ${unit}`;
      } else if (required > 0 && total > required + 0.0001) {
        suffix = ` · Excedente: ${difference} ${unit}`;
      }
      display.textContent = `Total: ${total} ${unit}${suffix}`;
      display.style.color = overLimit ? 'var(--color-danger,#c00)' : 'var(--color-success,green)';
    }

    const excessMsg = block.querySelector('.lot-excess-msg');
    if (excessMsg) {
      if (overLimit) {
        excessMsg.textContent = '⚠ Consumo excede tolerancia. Se requerirá justificación.';
        excessMsg.style.display = '';
      } else if (underRequired) {
        excessMsg.textContent = '⚠ Falta cantidad por asignar para cubrir el requerido.';
        excessMsg.style.display = '';
      } else if (required > 0 && total > required + 0.0001) {
        excessMsg.textContent = '⚠ Cantidad mayor al requerido. Revisa antes de confirmar.';
        excessMsg.style.display = '';
      } else {
        excessMsg.style.display = 'none';
      }
    }
  });
}

function addLotRowToBlock(block) {
  const h = helpers();
  let lots = [];
  try { lots = JSON.parse(block.dataset.lots || '[]'); } catch (_) { /* ignore */ }
  const unit = block.dataset.unit || '';
  const rowsContainer = block.querySelector('.lot-rows-container');
  if (!rowsContainer) { return; }

  const row = document.createElement('div');
  row.className = 'lot-row';
  row.style.cssText = 'display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.4rem';
  row.innerHTML = `
    <label style="flex:1;min-width:200px"><span>Lote *</span>
      <select class="lot-select" required aria-label="Seleccionar lote">
        ${h.buildLotOptionsHtml(lots, unit)}
      </select>
    </label>
    <label style="width:110px"><span>Cantidad *</span>
      <input type="number" class="lot-qty" min="0.001" step="any" required
             aria-label="Cantidad a consumir" />
    </label>
    <button type="button" class="secondary-button remove-lot-row-btn"
            title="Quitar fila" style="align-self:flex-end">✕</button>`;

  const removeBtn = row.querySelector('.remove-lot-row-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      row.remove();
      const owner = block.closest('section, form, [class]') || block;
      updateLotTotals(owner);
      h.syncExecutionOverrideState(owner);
    });
  }
  const qtyInput = row.querySelector('.lot-qty');
  const selInput = row.querySelector('.lot-select');
  if (qtyInput) {
    qtyInput.addEventListener('input', () => {
      const owner = block.closest('section, form, [class]') || block;
      updateLotTotals(owner);
      h.syncExecutionOverrideState(owner);
    });
  }
  if (selInput) {
    selInput.addEventListener('change', () => {
      const owner = block.closest('section, form, [class]') || block;
      updateLotTotals(owner);
      h.syncExecutionOverrideState(owner);
    });
  }
  rowsContainer.appendChild(row);
}

function attachLotPickerHandlers(container) {
  const h = helpers();
  container.querySelectorAll('.lot-picker-block').forEach((block) => {
    block.querySelectorAll('.lot-select, .lot-qty').forEach((input) => {
      input.addEventListener('change', () => { updateLotTotals(container); h.syncExecutionOverrideState(container); });
      input.addEventListener('input', () => { updateLotTotals(container); h.syncExecutionOverrideState(container); });
    });
    block.querySelectorAll('.remove-lot-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.lot-row')?.remove();
        updateLotTotals(container);
        h.syncExecutionOverrideState(container);
      });
    });
    const addBtn = block.querySelector('.add-lot-row-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addLotRowToBlock(block);
        updateLotTotals(container);
        h.syncExecutionOverrideState(container);
      });
    }
  });
  updateLotTotals(container);
  h.syncExecutionOverrideState(container);
}

// -----------------------------------------------------------------------
// QA capture live tolerance (inline within execute-stage form)
// -----------------------------------------------------------------------

function attachQaCaptureHandlers(container) {
  const h = helpers();
  container.querySelectorAll('.exec-qa-actual, .exec-qa-unit').forEach((input) => {
    input.addEventListener('input', () => h.syncExecutionOverrideState(container));
    input.addEventListener('change', () => h.syncExecutionOverrideState(container));
  });
  h.syncExecutionOverrideState(container);
}

// -----------------------------------------------------------------------
// QA analysis form (inspector de calidad)
// -----------------------------------------------------------------------

async function attachQaAnalysisHandlers(container, session, order, snapshotStage, reloadFn) {
  const api = WarehouseShell.require('warehouseApi');
  const renderers = WarehouseShell.require('views.productionRenderers');
  const h = helpers();
  const stageId = snapshotStage?.id;
  const slotId = `qa-form-${stageId}-slot`;
  const slot = container.querySelector(`#${slotId}`);
  if (!slot) { return; }

  slot.innerHTML = renderers.renderQaAnalysisForm(snapshotStage, stageId);
  const expectedParams = Array.isArray(snapshotStage?.expectedParameters) ? snapshotStage.expectedParameters : [];

  slot.querySelectorAll('.qa-param-row').forEach((row) => {
    row.querySelector('.qa-result-value')?.addEventListener('input', () => {
      h.evaluateQaResultBadge(row, expectedParams);
    });
  });

  const resultSelect = slot.querySelector('.qa-result-select');
  const correctiveBlock = slot.querySelector('.qa-corrective-block');
  resultSelect?.addEventListener('change', () => {
    const needsAction = ['CONDITIONALLY_ACCEPTED', 'REJECTED'].includes(resultSelect.value);
    if (correctiveBlock) { correctiveBlock.style.display = needsAction ? '' : 'none'; }
    const textarea = correctiveBlock?.querySelector('.qa-corrective-action');
    if (textarea) { textarea.required = needsAction; }
  });

  slot.querySelector('.add-qa-param-btn')?.addEventListener('click', () => {
    const paramsContainer = slot.querySelector('.qa-params-container');
    if (!paramsContainer) { return; }
    const row = document.createElement('div');
    row.className = 'qa-param-row';
    row.style.cssText = 'display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.4rem';
    const uid = `extra-${Date.now()}`;
    row.innerHTML = `
      <label style="min-width:140px"><span>Parametro *</span>
        <input type="text" class="qa-extra-param-name" placeholder="Ej: pH" />
      </label>
      <label style="width:100px"><span>Valor *</span>
        <input type="number" step="any" class="qa-result-value" aria-label="Valor" />
      </label>
      <label style="width:80px"><span>Unidad</span>
        <input type="text" class="qa-result-unit" aria-label="Unidad" />
      </label>
      <button type="button" class="secondary-button" style="align-self:flex-end" title="Quitar">✕</button>`;
    row.dataset.paramName = uid;
    row.querySelector('input[type="text"].qa-extra-param-name')?.addEventListener('input', (e) => {
      row.dataset.paramName = /** @type {HTMLInputElement} */ (e.target).value.trim() || uid;
    });
    row.querySelector('button')?.addEventListener('click', () => row.remove());
    paramsContainer.appendChild(row);
  });

  slot.querySelector('.qa-submit-btn')?.addEventListener('click', async () => {
    const submitBtn = slot.querySelector('.qa-submit-btn');
    const errEl = slot.querySelector('.qa-error');
    try {
      const payload = h.collectQaPayload(slot, snapshotStage);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }
      if (errEl) { errEl.hidden = true; }
      await api.createProductionQAInspection(session, order.id, stageId, payload);
      const app = WarehouseShell.require('app');
      app.showToast('Analisis QA registrado ✓');
      reloadFn();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar analisis QA'; }
      if (errEl) {
        errEl.textContent = err?.message || 'No se pudo registrar el analisis QA.';
        errEl.hidden = false;
      }
    }
  });
}

// -----------------------------------------------------------------------
// Stage execution inline form attachment
// -----------------------------------------------------------------------

async function attachExecuteStageHandlers(container, session, order, snapshotStage, reloadFn) {
  const api = WarehouseShell.require('warehouseApi');
  const renderers = WarehouseShell.require('views.productionRenderers');
  const h = helpers();
  const stageId = snapshotStage?.id;
  const slotId = `exec-form-${stageId}-slot`;
  const slot = container.querySelector(`#${slotId}`);
  if (!slot) { return; }

  let lotPickerHtml = '';
  let lotModels = [];
  try {
    const availableLotsResponse = await api.getAvailableLotsForStage(session, order.id, stageId);
    const productionState = WarehouseShell.require('views.productionState');
    lotModels = productionState.buildLotPickerModel(availableLotsResponse, {});
    lotPickerHtml = lotModels.length
      ? `<section class="wh-step-section" aria-label="Selector de lotes">
           <h4 class="wh-step-section__title">Consumo de insumos (FEFO/FIFO)</h4>
           ${lotModels.map((m) => {
             const html = renderers.renderLotPicker(m);
             return html.replace(
               'class="lot-picker-block"',
               `class="lot-picker-block" data-required-qty="${m.requiredQuantity}" data-tolerance-pct="${m.toleranceDefaultPercent}"`,
             );
           }).join('')}
         </section>`
      : '<p class="wh-caption muted">Esta etapa no requiere insumos de lote.</p>';
  } catch (_err) {
    lotPickerHtml = '<p class="wh-caption muted">No se pudo cargar lotes disponibles.</p>';
  }

  const formHtml = renderers.renderExecuteStageForm(order, snapshotStage, stageId, lotPickerHtml);
  slot.innerHTML = formHtml;

  const startedEl = slot.querySelector('.exec-started-at');
  if (startedEl) { startedEl.value = new Date().toISOString(); }

  attachLotPickerHandlers(slot);

  slot.querySelectorAll('.exec-qa-actual, .exec-qa-unit').forEach((input) => {
    input.addEventListener('input', () => h.syncExecutionOverrideState(slot));
    input.addEventListener('change', () => h.syncExecutionOverrideState(slot));
  });
  slot.querySelector('.exec-override-justification')?.addEventListener('input', () => {
    h.syncExecutionOverrideState(slot);
  });
  h.syncExecutionOverrideState(slot);

  slot.querySelector('.exec-cancel-btn')?.addEventListener('click', () => {
    slot.innerHTML = '';
    const execBtn = container.querySelector(`.wh-execute-stage-btn[data-stage-id="${stageId}"]`);
    if (execBtn) { execBtn.disabled = false; execBtn.setAttribute('aria-expanded', 'false'); }
  });

  slot.querySelector('.exec-submit-btn')?.addEventListener('click', async () => {
    const submitBtn = slot.querySelector('.exec-submit-btn');
    const errEl = slot.querySelector('.exec-error');
    const endedEl2 = slot.querySelector('.exec-ended-at');
    if (endedEl2) { endedEl2.value = new Date().toISOString(); }

    try {
      const executionState = h.syncExecutionOverrideState(slot);
      if (executionState.hasMissingQaValue) {
        throw new Error('Debes completar todos los parámetros QA requeridos.');
      }
      if (executionState.needsOverride && !executionState.hasValidOverride) {
        slot.querySelector('.exec-override-justification')?.focus();
        throw new Error('Agrega una justificación de al menos 10 caracteres para continuar.');
      }

      const payload = h.collectExecutionPayload(slot);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Completando...'; }
      if (errEl) { errEl.hidden = true; }

      const api2 = WarehouseShell.require('warehouseApi');
      await api2.executeProductionStage(session, order.id, stageId, payload);
      const app = WarehouseShell.require('app');
      app.showToast('Etapa completada ✓');
      reloadFn();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Completar etapa ✓'; }
      if (errEl) { errEl.textContent = err?.message || 'No se pudo completar la etapa.'; errEl.hidden = false; }
    }
  });
}

// -----------------------------------------------------------------------
// Order list handlers
// -----------------------------------------------------------------------

function attachOrderListHandlers(container) {
  const app = WarehouseShell.require('app');
  container.querySelector('#prod-new-cta')?.addEventListener('click', () => {
    app.navigate('production', { action: 'new' });
  });
  container.querySelectorAll('.wh-order-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const oid = btn.dataset.orderId;
      if (oid) { app.navigate('production', { id: oid }); }
    });
  });
}

// -----------------------------------------------------------------------
// Order detail handlers
// -----------------------------------------------------------------------

function attachOrderDetailHandlers(container, session, order, stagesVm, reloadFn) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');

  container.querySelector('#view-recipe-btn')?.addEventListener('click', () => {
    app.navigate('recipe-consultation', { orderId: String(order.id) });
  });
  container.querySelector('#back-to-orders')?.addEventListener('click', () => {
    app.navigate('production');
  });

  const submitBtn2 = container.querySelector('#submit-production-btn');
  const submitErr2 = container.querySelector('#submit-production-error');
  submitBtn2?.addEventListener('click', () => {
    if (submitBtn2) { submitBtn2.disabled = true; submitBtn2.textContent = 'Enviando...'; }
    if (submitErr2) { submitErr2.hidden = true; }
    api.submitProductionOrder(session, order.id)
      .then(() => { app.showToast('Orden enviada a aprobacion ✓'); reloadFn(); })
      .catch((err) => {
        if (submitBtn2) { submitBtn2.disabled = false; submitBtn2.textContent = '📤 Enviar a aprobacion'; }
        if (submitErr2) { submitErr2.textContent = err?.message || 'No se pudo enviar.'; submitErr2.hidden = false; }
      });
  });

  const approveBtn = container.querySelector('#approve-production-btn');
  const approveErr = container.querySelector('#approve-production-error');
  approveBtn?.addEventListener('click', () => {
    if (approveBtn) { approveBtn.disabled = true; approveBtn.textContent = 'Aprobando...'; }
    if (approveErr) { approveErr.hidden = true; }
    api.approveProductionOrder(session, order.id, {})
      .then(() => { app.showToast('Orden aprobada ✓'); reloadFn(); })
      .catch((err) => {
        if (approveBtn) { approveBtn.disabled = false; approveBtn.textContent = '✓ Aprobar orden'; }
        if (approveErr) { approveErr.textContent = err?.message || 'No se pudo aprobar.'; approveErr.hidden = false; }
      });
  });

  const startBtn = container.querySelector('#start-production-btn');
  const startErr = container.querySelector('#start-production-error');
  startBtn?.addEventListener('click', () => {
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Iniciando...'; }
    if (startErr) { startErr.hidden = true; }
    api.startProductionOrder(session, order.id)
      .then(() => { app.showToast('Orden iniciada ✓'); reloadFn(); })
      .catch((err) => {
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = '▶ Iniciar produccion'; }
        if (startErr) { startErr.textContent = err?.message || 'No se pudo iniciar.'; startErr.hidden = false; }
      });
  });

  container.querySelectorAll('.wh-execute-stage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stageId = btn.dataset.stageId;
      const vm = stagesVm.find((v) => String(v.stage?.id) === String(stageId));
      if (!vm) { return; }
      btn.disabled = true;
      btn.setAttribute('aria-expanded', 'true');
      attachExecuteStageHandlers(container, session, order, vm.stage, reloadFn);
    });
  });

  container.querySelectorAll('.wh-qa-stage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stageId = btn.dataset.stageId;
      const vm = stagesVm.find((v) => String(v.stage?.id) === String(stageId));
      if (!vm) { return; }
      btn.disabled = true;
      btn.setAttribute('aria-expanded', 'true');
      attachQaAnalysisHandlers(container, session, order, vm.stage, reloadFn);
    });
  });

  const completeBtn = container.querySelector('#complete-order-btn');
  const completeErr = container.querySelector('#complete-order-error');
  completeBtn?.addEventListener('click', () => {
    const qtyEl      = container.querySelector('#prod-produced-qty');
    const destWhEl   = container.querySelector('#prod-dest-warehouse');
    const lotCodeEl  = container.querySelector('#prod-lot-code');
    const prodDateEl = container.querySelector('#prod-production-date');
    const expDateEl  = container.querySelector('#prod-expiration-date');
    const obsEl      = container.querySelector('#prod-complete-obs');
    const qty        = Number(qtyEl?.value || 0);
    const destWhId   = destWhEl?.value?.trim() || undefined;
    const lotCode    = lotCodeEl?.value?.trim() || undefined;
    const prodDate   = prodDateEl?.value || undefined;
    const expDate    = expDateEl?.value || undefined;

    if (!qty || qty <= 0) {
      if (completeErr) { completeErr.textContent = 'La cantidad producida debe ser mayor a 0.'; completeErr.hidden = false; }
      qtyEl?.focus(); return;
    }
    if (!destWhId) {
      if (completeErr) { completeErr.textContent = 'Selecciona la bodega donde se ingresara el producto terminado.'; completeErr.hidden = false; }
      destWhEl?.focus(); return;
    }
    if (!lotCode) {
      if (completeErr) { completeErr.textContent = 'El codigo de lote del producto terminado es obligatorio.'; completeErr.hidden = false; }
      lotCodeEl?.focus(); return;
    }
    if (!prodDate) {
      if (completeErr) { completeErr.textContent = 'La fecha de produccion es obligatoria.'; completeErr.hidden = false; }
      prodDateEl?.focus(); return;
    }
    const expInput = /** @type {HTMLInputElement|null} */ (expDateEl);
    if (expInput?.required && !expDate) {
      if (completeErr) { completeErr.textContent = 'Este producto requiere fecha de vencimiento.'; completeErr.hidden = false; }
      expInput.focus(); return;
    }

    if (completeBtn) { completeBtn.disabled = true; completeBtn.textContent = 'Completando...'; }
    if (completeErr) { completeErr.hidden = true; }

    const payload = {
      producedQuantity: qty,
      destinationWarehouseId: destWhId,
      lotCode,
      productionDate: prodDate ? new Date(prodDate).toISOString() : undefined,
      expirationDate: expDate ? new Date(expDate).toISOString() : undefined,
      note: obsEl?.value?.trim() || undefined,
    };

    api.completeProductionOrder(session, order.id, payload)
      .then(() => { app.showToast('Orden completada ✓'); app.navigate('production'); })
      .catch((err) => {
        if (completeBtn) { completeBtn.disabled = false; completeBtn.textContent = 'Completar orden ✓'; }
        if (completeErr) { completeErr.textContent = err?.message || 'No se pudo completar la orden.'; completeErr.hidden = false; }
      });
  });
}

WarehouseShell.register('views.productionControllers', {
  attachExecuteStageHandlers,
  attachLotPickerHandlers,
  attachOrderDetailHandlers,
  attachOrderListHandlers,
  attachQaAnalysisHandlers,
  collectExecutionPayload: () => helpers().collectExecutionPayload,
  evaluateInlineExecutionQa: () => helpers().evaluateInlineExecutionQa,
  syncExecutionOverrideState: () => helpers().syncExecutionOverrideState,
});
})();
