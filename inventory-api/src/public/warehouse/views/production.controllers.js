/**
 * Warehouse SPA — Production event controllers.
 *
 * Attaches DOM event handlers after renderers paint the UI.
 * Each attach* function takes (container, session, deps) and wires events.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// -----------------------------------------------------------------------
// Lot picker live validation
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

function buildLotOptionsHtml(lots, unit) {
  const placeholder = '<option value="">Selecciona un lote...</option>';
  return placeholder + lots.map((lot) => {
    const expLabel = lot.expirationDate ? String(lot.expirationDate).slice(0, 10) : 'Sin venc.';
    const label = `${lot.lotNumber || `Lote #${lot.lotId}`} — Venc: ${expLabel} — Disp: ${lot.availableQuantity ?? '?'} ${unit}`;
    return `<option value="${String(lot.lotId)}">${label}</option>`;
  }).join('');
}

function addLotRowToBlock(block) {
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
        ${buildLotOptionsHtml(lots, unit)}
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
      syncExecutionOverrideState(owner);
    });
  }
  const qty = row.querySelector('.lot-qty');
  const sel = row.querySelector('.lot-select');
  if (qty) { qty.addEventListener('input', () => { const owner = block.closest('section, form, [class]') || block; updateLotTotals(owner); syncExecutionOverrideState(owner); }); }
  if (sel) { sel.addEventListener('change', () => { const owner = block.closest('section, form, [class]') || block; updateLotTotals(owner); syncExecutionOverrideState(owner); }); }

  rowsContainer.appendChild(row);
}

function attachLotPickerHandlers(container) {
  container.querySelectorAll('.lot-picker-block').forEach((block) => {
    // Wire existing rows
    block.querySelectorAll('.lot-select, .lot-qty').forEach((input) => {
      input.addEventListener('change', () => { updateLotTotals(container); syncExecutionOverrideState(container); });
      input.addEventListener('input', () => { updateLotTotals(container); syncExecutionOverrideState(container); });
    });
    // Wire remove buttons on initial rows
    block.querySelectorAll('.remove-lot-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.lot-row')?.remove();
        updateLotTotals(container);
        syncExecutionOverrideState(container);
      });
    });
    // Wire add-lot-row button
    const addBtn = block.querySelector('.add-lot-row-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addLotRowToBlock(block);
        updateLotTotals(container);
        syncExecutionOverrideState(container);
      });
    }
  });
  updateLotTotals(container);
  syncExecutionOverrideState(container);
}

// -----------------------------------------------------------------------
// QA capture live tolerance badge
// -----------------------------------------------------------------------

// evaluateQaResult: badge en tiempo real para el formulario del inspector QA
function evaluateQaResultBadge(row, expectedParams) {
  const paramName = row.dataset.paramName;
  const expected = (expectedParams || []).find((p) => p.name === paramName);
  const badge = row.querySelector('.qa-result-badge');
  const input = row.querySelector('.qa-result-value');
  if (!badge || !input) { return; }

  const actual = Number(input.value);
  if (input.value === '' || Number.isNaN(actual) || !expected) {
    badge.textContent = '';
    return;
  }
  const expectedVal = Number(expected.expectedValue);
  const minTol = Number(expected.minTolerance ?? 0);
  const maxTol = Number(expected.maxTolerance ?? 0);
  const within = actual >= (expectedVal - minTol) && actual <= (expectedVal + maxTol);
  badge.textContent = within ? '✓' : '⚠ fuera de rango';
  badge.style.color = within ? 'var(--color-success,green)' : 'var(--color-warning,#b86000)';
}

// -----------------------------------------------------------------------
// Collect execution payload from the inline form
// -----------------------------------------------------------------------

function evaluateInlineExecutionQa(formContainer) {
  let hasOutOfTolerance = false;
  let hasMissingQaValue = false;

  formContainer.querySelectorAll('.exec-qa-row').forEach((row) => {
    const input = row.querySelector('.exec-qa-actual');
    const badge = row.querySelector('.exec-qa-badge');
    const rawValue = input?.value ?? '';

    if (!rawValue) {
      row.dataset.withinTolerance = '';
      if (badge) {
        badge.textContent = 'Pendiente';
        badge.style.color = 'var(--color-text-muted,#666)';
      }
      hasMissingQaValue = true;
      return;
    }

    const actualValue = Number(rawValue);
    const expectedValue = Number(row.dataset.expectedValue ?? 0);
    const minTolerance = Number(row.dataset.minTolerance ?? 0);
    const maxTolerance = Number(row.dataset.maxTolerance ?? 0);
    const withinTolerance = !Number.isNaN(actualValue)
      && actualValue >= expectedValue - minTolerance
      && actualValue <= expectedValue + maxTolerance;

    row.dataset.withinTolerance = withinTolerance ? 'true' : 'false';
    if (!withinTolerance) {
      hasOutOfTolerance = true;
    }

    if (badge) {
      badge.textContent = withinTolerance ? '✓ Dentro de rango' : '⚠ Fuera de rango';
      badge.style.color = withinTolerance ? 'var(--color-success,green)' : 'var(--color-warning,#b86000)';
    }
  });

  return { hasMissingQaValue, hasOutOfTolerance };
}

function syncExecutionOverrideState(formContainer) {
  const overrideBlock = formContainer.querySelector('.exec-override-block');
  const overrideInput = formContainer.querySelector('.exec-override-justification');
  const overrideHelp = formContainer.querySelector('.exec-override-help');
  const warningEl = formContainer.querySelector('.exec-warning');
  const submitBtn = formContainer.querySelector('.exec-submit-btn');

  const qaState = evaluateInlineExecutionQa(formContainer);
  const lotBlocks = Array.from(formContainer.querySelectorAll('.lot-picker-block'));
  const hasOverLimitLots = lotBlocks.some((block) => block.dataset.overLimit === 'true');
  const hasUnderRequiredLots = lotBlocks.some((block) => block.dataset.underRequired === 'true');
  const needsOverride = qaState.hasOutOfTolerance || hasOverLimitLots;
  const overrideValue = overrideInput?.value?.trim() || '';
  const hasValidOverride = overrideValue.length >= 10;

  if (overrideBlock) {
    overrideBlock.hidden = !needsOverride;
  }
  if (overrideInput) {
    overrideInput.required = needsOverride;
  }
  if (overrideHelp) {
    const reasons = [];
    if (qaState.hasOutOfTolerance) {
      reasons.push('uno o más parámetros QA están fuera de tolerancia');
    }
    if (hasOverLimitLots) {
      reasons.push('el consumo excede la tolerancia permitida');
    }
    overrideHelp.textContent = reasons.length
      ? `Se requiere justificación porque ${reasons.join(' y ')}.`
      : '';
  }
  if (warningEl) {
    if (needsOverride && !hasValidOverride) {
      warningEl.textContent = 'Agrega una justificación de al menos 10 caracteres para continuar.';
      warningEl.hidden = false;
    } else if (hasUnderRequiredLots) {
      warningEl.textContent = 'Revisa los lotes: aún falta cantidad por asignar en uno o más insumos.';
      warningEl.hidden = false;
    } else {
      warningEl.hidden = true;
      warningEl.textContent = '';
    }
  }
  if (submitBtn) {
    submitBtn.disabled = Boolean(needsOverride && !hasValidOverride);
  }

  return {
    hasMissingQaValue: qaState.hasMissingQaValue,
    hasOutOfTolerance: qaState.hasOutOfTolerance,
    hasOverLimitLots,
    needsOverride,
    hasValidOverride,
  };
}

function collectExecutionPayload(formContainer) {
  const startedAtEl = formContainer.querySelector('.exec-started-at');
  const endedAtEl = formContainer.querySelector('.exec-ended-at');
  const notesEl = formContainer.querySelector('.exec-notes');

  const startedAt = startedAtEl?.value || null;
  const endedAt = endedAtEl?.value || null;

  if (!startedAt || !endedAt) {
    throw new Error('Error interno: no se pudieron registrar los tiempos de ejecucion.');
  }

  // Consumptions from lot picker (dropdown rows)
  const consumptions = [];
  formContainer.querySelectorAll('.lot-picker-block').forEach((block) => {
    const productId = block.dataset.productId;
    block.querySelectorAll('.lot-row').forEach((row) => {
      const lotId = row.querySelector('.lot-select')?.value;
      const qty = Number(row.querySelector('.lot-qty')?.value || 0);
      if (qty > 0 && !lotId) {
        throw new Error('Selecciona un lote para cada cantidad capturada.');
      }
      if (lotId && qty > 0) {
        consumptions.push({ productId: Number(productId), lotId: Number(lotId), quantity: qty });
      }
    });
  });

  const actualParameters = [];
  formContainer.querySelectorAll('.exec-qa-row').forEach((row) => {
    const actualInput = row.querySelector('.exec-qa-actual');
    const unitInput = row.querySelector('.exec-qa-unit');
    const rawActualValue = actualInput?.value ?? '';
    if (!rawActualValue) {
      throw new Error('Debes completar todos los parámetros QA requeridos.');
    }

    actualParameters.push({
      name: row.dataset.paramName,
      actualValue: Number(rawActualValue),
      unit: unitInput?.value?.trim() || row.dataset.paramUnit || undefined,
    });
  });

  const overrideJustification = formContainer.querySelector('.exec-override-justification')?.value?.trim() || undefined;

  return {
    startedAt,
    endedAt,
    consumptions,
    waste: [],
    actualParameters,
    overrideJustification,
    notes: notesEl?.value?.trim() || undefined,
  };
}

// -----------------------------------------------------------------------
// QA analysis form (inspector de calidad)
// -----------------------------------------------------------------------

function collectQaPayload(formContainer, snapshotStage) {
  const result = formContainer.querySelector('.qa-result-select')?.value;
  if (!result) { throw new Error('Selecciona un resultado (Aprobado / Aceptado / Rechazado).'); }

  const actualResults = [];
  formContainer.querySelectorAll('.qa-param-row').forEach((row) => {
    const name = row.dataset.paramName || row.querySelector('[data-param-name]')?.dataset?.paramName || '';
    const val = row.querySelector('.qa-result-value')?.value;
    const unit = row.querySelector('.qa-result-unit')?.value?.trim() || '';
    if (name && val !== '' && val !== undefined) {
      actualResults.push({ name, value: Number(val), unit: unit || undefined });
    }
  });

  const expectedParameters = (snapshotStage?.expectedParameters || []).map((p) => ({
    name: p.name,
    value: p.expectedValue,
    unit: p.unit || undefined,
  }));

  const observations = formContainer.querySelector('.qa-observations')?.value?.trim() || undefined;
  const correctiveAction = formContainer.querySelector('.qa-corrective-action')?.value?.trim() || undefined;

  if (['CONDITIONALLY_ACCEPTED', 'REJECTED'].includes(result) && !correctiveAction) {
    throw new Error('La accion correctiva es obligatoria para resultados no aprobados.');
  }

  return { result, expectedParameters, actualResults, observations, correctiveAction };
}

async function attachQaAnalysisHandlers(container, session, order, snapshotStage, reloadFn) {
  const api = WarehouseShell.require('warehouseApi');
  const renderers = WarehouseShell.require('views.productionRenderers');
  const stageId = snapshotStage?.id;
  const slotId = `qa-form-${stageId}-slot`;
  const slot = container.querySelector(`#${slotId}`);
  if (!slot) { return; }

  slot.innerHTML = renderers.renderQaAnalysisForm(snapshotStage, stageId);

  const expectedParams = Array.isArray(snapshotStage?.expectedParameters) ? snapshotStage.expectedParameters : [];

  // Live badge por cada parametro esperado
  slot.querySelectorAll('.qa-param-row').forEach((row) => {
    row.querySelector('.qa-result-value')?.addEventListener('input', () => {
      evaluateQaResultBadge(row, expectedParams);
    });
  });

  // Mostrar/ocultar accion correctiva segun resultado
  const resultSelect = slot.querySelector('.qa-result-select');
  const correctiveBlock = slot.querySelector('.qa-corrective-block');
  resultSelect?.addEventListener('change', () => {
    const needsAction = ['CONDITIONALLY_ACCEPTED', 'REJECTED'].includes(resultSelect.value);
    if (correctiveBlock) { correctiveBlock.style.display = needsAction ? '' : 'none'; }
    const textarea = correctiveBlock?.querySelector('.qa-corrective-action');
    if (textarea) { textarea.required = needsAction; }
  });

  // Agregar parametro extra
  slot.querySelector('.add-qa-param-btn')?.addEventListener('click', () => {
    const container2 = slot.querySelector('.qa-params-container');
    if (!container2) { return; }
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
    // name real lo leeremos del input qa-extra-param-name al colectar
    row.querySelector('input[type="text"].qa-extra-param-name')?.addEventListener('input', (e) => {
      row.dataset.paramName = /** @type {HTMLInputElement} */ (e.target).value.trim() || uid;
    });
    row.querySelector('button')?.addEventListener('click', () => row.remove());
    container2.appendChild(row);
  });

  // Submit
  slot.querySelector('.qa-submit-btn')?.addEventListener('click', async () => {
    const submitBtn = slot.querySelector('.qa-submit-btn');
    const errEl = slot.querySelector('.qa-error');
    try {
      const payload = collectQaPayload(slot, snapshotStage);
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

/**
 * Attaches the execute-stage form and its submit handler.
 * Fetches available lots, renders lot picker + QA, and wires submission.
 */
async function attachExecuteStageHandlers(container, session, order, snapshotStage, reloadFn) {
  const api = WarehouseShell.require('warehouseApi');
  const renderers = WarehouseShell.require('views.productionRenderers');
  const stageId = snapshotStage?.id;
  const slotId = `exec-form-${stageId}-slot`;
  const slot = container.querySelector(`#${slotId}`);
  if (!slot) { return; }

  // Fetch available lots (non-blocking — show form even if it fails)
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
             // Inject data attributes for validation
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

  // Capturar startedAt = ahora que se abre el formulario.
  const startedEl = slot.querySelector('.exec-started-at');
  if (startedEl) { startedEl.value = new Date().toISOString(); }

  // Wire lot picker live validation
  attachLotPickerHandlers(slot);

  slot.querySelectorAll('.exec-qa-actual, .exec-qa-unit').forEach((input) => {
    input.addEventListener('input', () => syncExecutionOverrideState(slot));
    input.addEventListener('change', () => syncExecutionOverrideState(slot));
  });
  slot.querySelector('.exec-override-justification')?.addEventListener('input', () => {
    syncExecutionOverrideState(slot);
  });
  syncExecutionOverrideState(slot);

  // Cancel button
  slot.querySelector('.exec-cancel-btn')?.addEventListener('click', () => {
    slot.innerHTML = '';
    const execBtn = container.querySelector(`.wh-execute-stage-btn[data-stage-id="${stageId}"]`);
    if (execBtn) {
      execBtn.disabled = false;
      execBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Submit button
  slot.querySelector('.exec-submit-btn')?.addEventListener('click', async () => {
    const submitBtn = slot.querySelector('.exec-submit-btn');
    const errEl = slot.querySelector('.exec-error');

    // Capturar endedAt = ahora que el operador confirma la etapa.
    const endedEl2 = slot.querySelector('.exec-ended-at');
    if (endedEl2) { endedEl2.value = new Date().toISOString(); }

    try {
      const executionState = syncExecutionOverrideState(slot);
      if (executionState.hasMissingQaValue) {
        throw new Error('Debes completar todos los parámetros QA requeridos.');
      }
      if (executionState.needsOverride && !executionState.hasValidOverride) {
        const overrideInput = slot.querySelector('.exec-override-justification');
        overrideInput?.focus();
        throw new Error('Agrega una justificación de al menos 10 caracteres para continuar.');
      }

      const payload = collectExecutionPayload(slot);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Completando...'; }
      if (errEl) { errEl.hidden = true; }

      const api2 = WarehouseShell.require('warehouseApi');
      await api2.executeProductionStage(session, order.id, stageId, payload);
      const app = WarehouseShell.require('app');
      app.showToast('Etapa completada ✓');
      reloadFn();
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Completar etapa ✓'; }
      if (errEl) {
        errEl.textContent = err?.message || 'No se pudo completar la etapa.';
        errEl.hidden = false;
      }
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

  // View recipe
  container.querySelector('#view-recipe-btn')?.addEventListener('click', () => {
    app.navigate('recipe-consultation', { orderId: String(order.id) });
  });

  // Back button (delegated to caller via reloadFn → navigate)
  container.querySelector('#back-to-orders')?.addEventListener('click', () => {
    app.navigate('production');
  });

  // Submit for approval (DRAFT -> PENDING_APPROVAL)
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

  // Approve production (PENDING_APPROVAL -> APPROVED)
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

  // Start production
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

  // Execute stage expand button → fetch lots, paint form
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

  // QA analysis button → paint QA form for inspector
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

  // Complete order
  const completeBtn = container.querySelector('#complete-order-btn');
  const completeErr = container.querySelector('#complete-order-error');
  completeBtn?.addEventListener('click', () => {
    const qtyEl       = container.querySelector('#prod-produced-qty');
    const destWhEl    = container.querySelector('#prod-dest-warehouse');
    const lotCodeEl   = container.querySelector('#prod-lot-code');
    const prodDateEl  = container.querySelector('#prod-production-date');
    const expDateEl   = container.querySelector('#prod-expiration-date');
    const obsEl       = container.querySelector('#prod-complete-obs');

    const qty         = Number(qtyEl?.value || 0);
    const destWhId    = destWhEl?.value?.trim() || undefined;
    const lotCode     = lotCodeEl?.value?.trim() || undefined;
    const prodDate    = prodDateEl?.value || undefined;
    const expDate     = expDateEl?.value || undefined;

    if (!qty || qty <= 0) {
      if (completeErr) { completeErr.textContent = 'La cantidad producida debe ser mayor a 0.'; completeErr.hidden = false; }
      qtyEl?.focus();
      return;
    }
    if (!destWhId) {
      if (completeErr) { completeErr.textContent = 'Selecciona la bodega donde se ingresara el producto terminado.'; completeErr.hidden = false; }
      destWhEl?.focus();
      return;
    }
    if (!lotCode) {
      if (completeErr) { completeErr.textContent = 'El codigo de lote del producto terminado es obligatorio.'; completeErr.hidden = false; }
      lotCodeEl?.focus();
      return;
    }
    if (!prodDate) {
      if (completeErr) { completeErr.textContent = 'La fecha de produccion es obligatoria.'; completeErr.hidden = false; }
      prodDateEl?.focus();
      return;
    }
    // Si el campo de vencimiento tiene required (producto lo exige) y está vacío, el browser ya bloquea.
    // Pero hacemos validacion manual por si acaso.
    const expInput = /** @type {HTMLInputElement|null} */ (expDateEl);
    if (expInput?.required && !expDate) {
      if (completeErr) { completeErr.textContent = 'Este producto requiere fecha de vencimiento.'; completeErr.hidden = false; }
      expInput.focus();
      return;
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
  collectExecutionPayload,
  evaluateInlineExecutionQa,
  syncExecutionOverrideState,
});
})();
