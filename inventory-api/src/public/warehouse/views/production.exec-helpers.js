/**
 * Warehouse SPA — Production execution helpers (pure DOM utilities).
 *
 * Contains stateless helper functions used by production.controllers.js:
 *  - Lot picker live-validation helpers
 *  - QA tolerance evaluation helpers
 *  - Payload-collection helpers
 *
 * Registered as 'views.productionExecHelpers' so controllers.js can
 * obtain them via WarehouseShell.require().
 *
 * NFR-006: extracted from production.controllers.js to keep every
 * file ≤ 600 lines. No DOM-attaching side effects here.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// -----------------------------------------------------------------------
// Lot option HTML builder
// -----------------------------------------------------------------------

function buildLotOptionsHtml(lots, unit) {
  const placeholder = '<option value="">Selecciona un lote...</option>';
  return placeholder + lots.map((lot) => {
    const expLabel = lot.expirationDate ? String(lot.expirationDate).slice(0, 10) : 'Sin venc.';
    const label = `${lot.lotNumber || `Lote #${lot.lotId}`} — Venc: ${expLabel} — Disp: ${lot.availableQuantity ?? '?'} ${unit}`;
    return `<option value="${String(lot.lotId)}">${label}</option>`;
  }).join('');
}

// -----------------------------------------------------------------------
// QA inspector result badge (for the separate QA-analysis form)
// -----------------------------------------------------------------------

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
// Inline execution QA (execute-stage form)
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

// -----------------------------------------------------------------------
// Override state synchronisation (called after every user input change)
// -----------------------------------------------------------------------

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

  if (overrideBlock) { overrideBlock.hidden = !needsOverride; }
  if (overrideInput) { overrideInput.required = needsOverride; }
  if (overrideHelp) {
    const reasons = [];
    if (qaState.hasOutOfTolerance) { reasons.push('uno o más parámetros QA están fuera de tolerancia'); }
    if (hasOverLimitLots) { reasons.push('el consumo excede la tolerancia permitida'); }
    overrideHelp.textContent = reasons.length
      ? `Se requiere justificación porque ${reasons.join(' y ')}.`
      : '';
  }
  if (warningEl) {
    const warnings = [];
    if (hasUnderRequiredLots) { warnings.push('Hay insumos con cantidad asignada menor al requerido.'); }
    warningEl.textContent = warnings.join(' ');
    warningEl.hidden = warnings.length === 0;
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

// -----------------------------------------------------------------------
// Payload collection helpers
// -----------------------------------------------------------------------

function collectExecutionPayload(formContainer) {
  const startedAtEl = formContainer.querySelector('.exec-started-at');
  const endedAtEl = formContainer.querySelector('.exec-ended-at');
  const notesEl = formContainer.querySelector('.exec-notes');

  const startedAt = startedAtEl?.value || null;
  const endedAt = endedAtEl?.value || null;

  if (!startedAt || !endedAt) {
    throw new Error('Error interno: no se pudieron registrar los tiempos de ejecucion.');
  }

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

function syncQaRejectionFlowState(formContainer) {
  const result = formContainer.querySelector('.qa-result-select')?.value;
  const rejectionFlow = formContainer.querySelector('.qa-rejection-flow');
  const priorStageSelector = formContainer.querySelector('.qa-prior-stage-selector');
  const invalidatedSection = formContainer.querySelector('.qa-invalidated-stages-section');
  const continuationPoint = formContainer.querySelector('.qa-continuation-radio:checked')?.value || 'CURRENT';

  if (rejectionFlow) {
    rejectionFlow.hidden = result !== 'REJECTED';
  }

  const showPriorStage = result === 'REJECTED' && continuationPoint === 'PRIOR_STAGE';
  if (priorStageSelector) { priorStageSelector.hidden = !showPriorStage; }
  if (invalidatedSection) { invalidatedSection.hidden = !showPriorStage; }

  formContainer.querySelectorAll('.qa-invalidated-stage-card').forEach((card) => {
    if (!showPriorStage) {
      card.hidden = true;
      return;
    }
    const selectedStageId = formContainer.querySelector('.qa-continuation-stage-select')?.value || '';
    const cardStageOrder = Number(card.dataset.stageOrder || 0);
    const selectedStageOrder = Number(
      formContainer.querySelector('.qa-continuation-stage-select')?.selectedOptions?.[0]?.dataset?.stageOrder || 0,
    );
    card.hidden = !selectedStageId || cardStageOrder < selectedStageOrder;
  });

  formContainer.querySelectorAll('.qa-disposition-row').forEach((row) => {
    const disposition = row.querySelector('.qa-disposition-select')?.value || '';
    const qtyBlock = row.querySelector('.qa-disposition-qty-block');
    const qtyLabel = row.querySelector('.qa-disposition-qty-label');
    const qtyInput = row.querySelector('.qa-disposition-qty');
    const needsVisibleQuantity = disposition === 'RETURN';

    if (qtyBlock) { qtyBlock.style.display = needsVisibleQuantity ? '' : 'none'; }
    if (qtyInput) {
      qtyInput.required = needsVisibleQuantity;
      if (!needsVisibleQuantity) { qtyInput.value = ''; }
    }
    if (qtyLabel) {
      qtyLabel.textContent = disposition === 'RETURN' ? 'Cantidad a devolver *' : 'Cantidad *';
    }
  });

  // Auto-manage replacement checkbox: active when any visible material is DISCARD or RECOLLECT.
  const replacementCheckbox = /** @type {HTMLInputElement|null} */ (formContainer.querySelector('.qa-requires-replacement-stage'));
  if (replacementCheckbox) {
    const visibleDispositions = Array.from(
      formContainer.querySelectorAll('.qa-rejection-flow .qa-disposition-select'),
    ).filter((sel) => !sel.closest('[hidden]'));
    const needsReplacement = visibleDispositions.some(
      (sel) => sel.value === 'DISCARD' || sel.value === 'RECOLLECT',
    );
    replacementCheckbox.checked = needsReplacement;
  }
}

function collectDispositionEntries(section) {
  if (!section) {
    throw new Error('Debes completar la gestión del rechazo antes de registrar la inspección.');
  }

  return Array.from(section.querySelectorAll('.qa-disposition-row')).map((row) => {
    const disposition = row.querySelector('.qa-disposition-select')?.value || '';
    const productId = row.dataset.productId;
    const lotId = row.dataset.lotId;
    const consumedQuantity = Number(row.dataset.consumedQuantity || 0);
    const qtyInputValue = row.querySelector('.qa-disposition-qty')?.value || '';

    if (!disposition) {
      throw new Error('Debes completar la disposición de material antes de registrar el rechazo.');
    }

    if (disposition === 'RETURN') {
      const quantity = Number(qtyInputValue);
      if (!(quantity > 0)) {
        throw new Error('Indica la cantidad a devolver.');
      }
      return { productId: Number(productId), lotId: Number(lotId), disposition, quantity };
    }

    // REUSE: material stays in production, no backend action needed.
    // Included here for completeness; filtered out before sending to API.
    return {
      productId: Number(productId),
      lotId: Number(lotId),
      disposition,
      quantity: consumedQuantity,
    };
  });
}

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

  if (result !== 'REJECTED') {
    return { result, expectedParameters, actualResults, observations, correctiveAction };
  }

  const rejectionFlow = formContainer.querySelector('.qa-rejection-flow');
  const rejectedSection = rejectionFlow?.querySelector('.qa-material-disposition-section');
  // REUSE dispositions are UI-only (no backend action). Filter them out before sending.
  const materialDispositions = collectDispositionEntries(rejectedSection)
    .filter((d) => d.disposition !== 'REUSE');
  const continuationPoint = formContainer.querySelector('.qa-continuation-radio:checked')?.value || 'CURRENT';
  // Replacement checkbox is now auto-managed by syncQaRejectionFlowState.
  const requiresReplacementStage = formContainer.querySelector('.qa-requires-replacement-stage')?.checked === true;

  // Replacement items: only include rows where material needs to be replaced
  // (DISCARD = damaged/contaminated, RECOLLECT = needs fresh material).
  const buildReplacementItems = () => {
    if (!rejectionFlow) { return []; }
    const rows = Array.from(rejectionFlow.querySelectorAll('.qa-disposition-row'))
      .filter((row) => !row.closest('[hidden]'));
    const byProduct = new Map();
    rows.forEach((row) => {
      const disposition = row.querySelector('.qa-disposition-select')?.value || '';
      if (disposition !== 'DISCARD' && disposition !== 'RECOLLECT') { return; }
      const productId = row.getAttribute('data-product-id');
      const quantity = Number(row.getAttribute('data-consumed-quantity') || '0');
      const unit = row.getAttribute('data-unit') || undefined;
      if (!productId || quantity <= 0) { return; }
      const current = byProduct.get(productId) || { productId: Number(productId), quantity: 0, unit };
      current.quantity += quantity;
      if (!current.unit && unit) { current.unit = unit; }
      byProduct.set(productId, current);
    });
    return Array.from(byProduct.values()).filter((item) => item.quantity > 0);
  };

  if (continuationPoint !== 'PRIOR_STAGE') {
    return {
      result,
      expectedParameters,
      actualResults,
      observations,
      correctiveAction,
      continuationPoint: 'CURRENT',
      materialDispositions,
      requiresReplacementStage,
      replacementItems: requiresReplacementStage ? buildReplacementItems() : undefined,
    };
  }

  const continuationStageSelect = formContainer.querySelector('.qa-continuation-stage-select');
  const continuationStageId = continuationStageSelect?.value || '';
  if (!continuationStageId) {
    throw new Error('Selecciona la etapa a la que regresará la producción.');
  }

  const selectedStageOrder = Number(continuationStageSelect?.selectedOptions?.[0]?.dataset?.stageOrder || 0);
  const invalidatedStagesDispositions = Array.from(
    formContainer.querySelectorAll('.qa-invalidated-stage-card'),
  ).filter((card) => !card.hidden && Number(card.dataset.stageOrder || 0) >= selectedStageOrder)
    .map((card) => ({
      stageExecutionId: Number(card.dataset.executionId),
      dispositions: collectDispositionEntries(card),
    }));

  if (!invalidatedStagesDispositions.length) {
    throw new Error('Completa la disposición de materiales de todas las etapas afectadas.');
  }

  return {
    result,
    expectedParameters,
    actualResults,
    observations,
    correctiveAction,
    continuationPoint,
    continuationStageId: Number(continuationStageId),
    materialDispositions,
    invalidatedStagesDispositions,
    requiresReplacementStage,
    replacementItems: requiresReplacementStage ? buildReplacementItems() : undefined,
  };
}

WarehouseShell.register('views.productionExecHelpers', {
  buildLotOptionsHtml,
  evaluateQaResultBadge,
  evaluateInlineExecutionQa,
  syncExecutionOverrideState,
  syncQaRejectionFlowState,
  collectExecutionPayload,
  collectQaPayload,
});
})();
