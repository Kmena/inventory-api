/**
 * Warehouse SPA — Production rejection/loss renderers.
 *
 * TASK-007: production-stage-rejection-and-reexecution
 *
 * Extracted from production.renderers.js to keep files ≤ 600 lines.
 * Registers functions into WarehouseShell for use by production.controllers.js.
 *
 * All functions return HTML strings. No DOM mutations, no API calls.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Renders the form for declaring post-rejection material losses.
 *
 * Shows all consumptions from the rejected execution.
 * The supervisor declares quantity lost per (product, lot).
 * quantity = 0 means that item is not declared as lost.
 *
 * @param {any} execution - The QA_REJECTED ProductionStageExecution
 * @param {string} orderId
 * @param {string} stageId
 */
function renderStageLossForm(execution, orderId, stageId) {
  const consumptions = Array.isArray(execution?.consumptions) ? execution.consumptions : [];
  const execId = String(execution?.id ?? '');

  const rows = consumptions.map((c, idx) => {
    const productId = String(c.productId ?? '');
    const lotId = String(c.lotId ?? '');
    const qty = Number(c.quantity ?? 0);

    return `
      <tr class="wh-loss-row" data-product-id="${escapeHtml(productId)}" data-lot-id="${escapeHtml(lotId)}">
        <td>Producto #${escapeHtml(productId)}</td>
        <td>Lote #${escapeHtml(lotId)}</td>
        <td>${escapeHtml(String(qty.toFixed(3)))}</td>
        <td>
          <input
            type="number"
            class="wh-loss-qty-input"
            name="loss-qty-${idx}"
            min="0"
            max="${escapeHtml(String(qty))}"
            step="0.001"
            value="0"
            aria-label="Cantidad perdida de producto ${escapeHtml(productId)}, lote ${escapeHtml(lotId)}"
          />
        </td>
        <td>
          <input
            type="text"
            class="wh-loss-reason-input"
            name="loss-reason-${idx}"
            maxlength="100"
            placeholder="CONTAMINATED, BROKEN, EXPIRED_DURING_PROCESS..."
            aria-label="Razón de pérdida"
          />
        </td>
        <td>
          <input
            type="text"
            class="wh-loss-note-input"
            name="loss-note-${idx}"
            maxlength="1000"
            placeholder="Nota opcional"
            aria-label="Nota"
          />
        </td>
      </tr>
    `;
  }).join('');

  const tableHtml = consumptions.length > 0
    ? `
      <table class="wh-table wh-loss-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Lote consumido</th>
            <th>Cantidad consumida</th>
            <th>Cantidad perdida</th>
            <th>Razón (obligatorio si > 0)</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
    : '<p class="wh-caption">No hay consumos registrados en esta ejecución.</p>';

  return `
    <section class="wh-loss-form-section" data-order-id="${escapeHtml(String(orderId))}"
             data-stage-id="${escapeHtml(String(stageId))}"
             data-execution-id="${escapeHtml(execId)}"
             aria-label="Registro de pérdidas de materiales">
      <h3 class="wh-step-section__title">Registrar pérdidas del intento fallido</h3>
      <p class="wh-caption wh-caption--info">
        ⚠️ Este registro es solo para auditoría. El stock ya fue retirado del almacén al ejecutar la etapa.
        Si hay material recuperable, use «Registrar devolución» antes de este formulario.
      </p>
      ${tableHtml}
      <div class="wh-form-actions">
        <button type="button" class="primary-button wh-declare-losses-btn"
                data-order-id="${escapeHtml(String(orderId))}"
                data-stage-id="${escapeHtml(String(stageId))}">
          Declarar pérdidas y continuar
        </button>
      </div>
    </section>
  `;
}

/**
 * Renders the action panel shown AFTER the supervisor has declared losses.
 * Two choices: re-execute the stage, or terminate production (cancel the order).
 *
 * @param {string} orderId
 * @param {string} stageId
 */
function renderPostLossActions(orderId, stageId) {
  return `
    <section class="wh-post-loss-actions" aria-label="Acciones después de registrar pérdidas"
             data-order-id="${escapeHtml(String(orderId))}"
             data-stage-id="${escapeHtml(String(stageId))}">
      <h3 class="wh-step-section__title">¿Qué desea hacer a continuación?</h3>
      <p class="wh-caption">Las pérdidas han sido registradas. Seleccione la siguiente acción:</p>
      <div class="wh-form-actions">
        <button type="button" class="primary-button wh-re-execute-stage-btn"
                data-order-id="${escapeHtml(String(orderId))}"
                data-stage-id="${escapeHtml(String(stageId))}">
          🔄 Re-ejecutar etapa
        </button>
        <button type="button" class="secondary-button danger wh-terminate-production-btn"
                data-order-id="${escapeHtml(String(orderId))}">
          🛑 Terminar producción
        </button>
      </div>
      <p class="wh-caption wh-caption--warning">
        ⚠️ «Terminar producción» cancela la orden definitivamente. Esta acción no se puede deshacer.
      </p>
    </section>
  `;
}

/**
 * Renders a read-only summary of already-declared losses for a stage.
 *
 * @param {any[]} losses - Array of ProductionStageLoss records
 */
function renderStageLossHistory(losses) {
  if (!Array.isArray(losses) || losses.length === 0) {
    return '<p class="wh-caption">Declaración de cero pérdidas — ningún material declarado como perdido.</p>';
  }

  const rows = losses.map((loss) => `
    <tr>
      <td>Producto #${escapeHtml(String(loss.productId ?? ''))}</td>
      <td>Lote #${escapeHtml(String(loss.lotId ?? ''))}</td>
      <td>${escapeHtml(String(Number(loss.quantity ?? 0).toFixed(3)))}</td>
      <td>${escapeHtml(String(loss.reasonCode ?? ''))}</td>
      <td>${escapeHtml(String(loss.note ?? ''))}</td>
    </tr>
  `).join('');

  return `
    <section class="wh-loss-history-section" aria-label="Historial de pérdidas declaradas">
      <h4 class="wh-step-section__title">Pérdidas declaradas</h4>
      <table class="wh-table">
        <thead>
          <tr>
            <th>Producto</th><th>Lote</th><th>Cantidad</th><th>Razón</th><th>Nota</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

/**
 * Renders the full QA rejection panel for a stage.
 * Shown when deriveStageStatus === 'QA_REJECTED_PENDING_LOSSES'.
 *
 * @param {any} execution - The rejected stageExecution
 * @param {string} orderId
 * @param {string} stageId
 */
function renderRejectedStagePanel(execution, orderId, stageId) {
  return `
    <div class="wh-rejected-stage-panel">
      <p class="wh-caption wh-caption--error">
        ❌ Esta etapa fue rechazada por QA. Debe registrar las pérdidas de materiales
        antes de poder re-ejecutarla.
      </p>
      ${renderStageLossForm(execution, orderId, stageId)}
    </div>
  `;
}

/**
 * Renders the panel when losses are already declared and operator can choose next action.
 *
 * @param {any} execution - The rejected stageExecution (lossesAcknowledged=true)
 * @param {string} orderId
 * @param {string} stageId
 */
function renderRejectedStageLossesDonePanel(execution, orderId, stageId) {
  const losses = Array.isArray(execution?.losses) ? execution.losses : [];
  return `
    <div class="wh-rejected-stage-panel wh-rejected-stage-panel--losses-done">
      <p class="wh-caption">✅ Pérdidas declaradas.</p>
      ${renderStageLossHistory(losses)}
      ${renderPostLossActions(orderId, stageId)}
    </div>
  `;
}

// ─── Cancel with stock returns ────────────────────────────────────────────────

/**
 * Aggregates consumptions across ALL stage executions of an order.
 * Returns [{ productId, lotId, productName, quantity }] merged by (productId, lotId).
 *
 * @param {object} order - full production order from API
 */
/**
 * Formatea un ISO datetime a "YYYY-MM-DD" para un <input type="date">.
 * Devuelve '' si el valor es nulo o inválido.
 */
function toDateInputValue(isoDate) {
  if (!isoDate) { return ''; }
  return String(isoDate).substring(0, 10);
}

function aggregateOrderConsumptions(order) {
  const byKey = {};
  const nameLookup = {};
  for (const req of (order.materialRequirements || [])) {
    if (req.productId) {
      // La API incluye req.product (include en repository + serializer)
      nameLookup[String(req.productId)] = req.product?.name || null;
    }
  }
  for (const exec of (order.stageExecutions || [])) {
    for (const c of (exec.consumptions || [])) {
      const key = String(c.productId) + ':' + String(c.lotId);
      if (!byKey[key]) {
        byKey[key] = {
          productId:      c.productId,
          lotId:          c.lotId,
          productName:    nameLookup[String(c.productId)] || null,
          // expirationDate viene de lot incluido en el stageExecution.consumptions
          expirationDate: c.lot?.expirationDate || null,
          quantity:       0,
        };
      }
      byKey[key].quantity += Number(c.quantity || 0);
    }
  }
  return Object.values(byKey).filter((e) => e.quantity > 0);
}

/**
 * Renders the cancel-with-returns panel.
 * One row per (product, lot) consumed across all stage executions.
 * Operator sets quantity to return and whether to use original or new lot.
 *
 * @param {object} order    - full production order
 * @param {string} orderId  - string ID for data attributes
 */
function buildProductNameLookup(order) {
  const productNames = new Map();
  for (const requirement of (order?.materialRequirements || [])) {
    if (requirement?.productId) {
      productNames.set(String(requirement.productId), requirement.product?.name || null);
    }
  }
  return productNames;
}

function renderDispositionRows(consumptions, productNames, rowGroupName) {
  if (!Array.isArray(consumptions) || consumptions.length === 0) {
    return '<p class="wh-caption">No hay consumos registrados para esta ejecución.</p>';
  }

  return `<div class="qa-disposition-table">${consumptions.map((consumption, index) => {
    const productId = String(consumption.productId ?? '');
    const lotId = String(consumption.lotId ?? '');
    const consumedQuantity = Number(consumption.quantity ?? 0);
    const productName = productNames.get(productId) || `Producto #${productId}`;
    const lotLabel = consumption.lot?.internalLotNumber || `Lote #${lotId}`;
    const unit = consumption.unit || productNames.get(`${productId}:unit`) || '';
    // Stage context label shown when consumptions come from prior stages (Option A scope)
    const stageLabel = consumption._stageName
      ? `<span class="wh-caption" style="display:block;color:var(--color-muted,#888);margin-bottom:0.25rem">\u{1F4CC} ${escapeHtml(consumption._stageName)}</span>`
      : '';
    return `
      <div class="qa-disposition-row"
           data-product-id="${escapeHtml(productId)}"
           data-lot-id="${escapeHtml(lotId)}"
           data-consumed-quantity="${escapeHtml(String(consumedQuantity))}"
           data-unit="${escapeHtml(String(unit || ''))}"
           style="border:1px solid var(--border,#ddd);border-radius:8px;padding:0.75rem;margin-bottom:0.5rem">
        ${stageLabel}
        <p style="margin:0 0 0.5rem"><strong>${escapeHtml(productName)}</strong> \u00B7 ${escapeHtml(lotLabel)}</p>
        <p class="wh-caption" style="margin:0 0 0.5rem">Consumido: ${escapeHtml(String(consumedQuantity))} ${escapeHtml(String(unit || ''))}</p>
        <label style="display:block;margin-bottom:0.5rem">
          <span>Disposici\u00F3n *</span>
          <select class="qa-disposition-select" aria-label="Disposici\u00F3n para ${escapeHtml(productName)}" data-row-group="${escapeHtml(rowGroupName)}-${index}">
            <option value="">Selecciona una disposici\u00F3n</option>
            <option value="REUSE">Seguir usando (reutilizar)</option>
            <option value="RETURN">Devolver a inventario</option>
            <option value="DISCARD">Descartar (da\u00F1ado / contaminado)</option>
            <option value="RECOLLECT">Recolectar nuevamente</option>
          </select>
        </label>
        <label class="qa-disposition-qty-block" style="display:none">
          <span class="qa-disposition-qty-label">Cantidad *</span>
          <input type="number" step="any" min="0.001" class="qa-disposition-qty" aria-label="Cantidad para ${escapeHtml(productName)}" />
        </label>
      </div>`;
  }).join('')}</div>`;
}

/**
 * Option A relevant-input scope — client-side mirror of
 * quality-relevant-input-scope.service.js::resolveOptionARelevantInputs.
 *
 * Collects ALL consumptions from non-INVALIDATED stage executions whose
 * stageOrder <= the rejected stage's stageOrder.
 *
 * Deduplicates by (productId, lotId): same material appearing in multiple stages
 * is shown ONCE. Prefers the failed-stage entry as base (for backend compat).
 * Contributing stage names are joined for display context.
 *
 * @param {any} order - full production order with stageExecutions
 * @param {any} snapshotStage - the QA-rejected stage
 * @param {any[]} snapshotStages - all stages from the recipe snapshot (sorted)
 * @returns {{ entries: any[], hasDirectConsumptions: boolean }}
 */
function resolveOptionAConsumptions(order, snapshotStage, snapshotStages) {
  const failedStageIdStr = String(snapshotStage?.id ?? '');

  const stageOrderMap = new Map();
  for (const stage of snapshotStages) {
    stageOrderMap.set(String(stage.id), {
      stageOrder: Number(stage.stageOrder ?? 0),
      stageName: stage.name ?? '',
    });
  }

  const failedInfo = stageOrderMap.get(failedStageIdStr);
  const failedOrder = failedInfo ? failedInfo.stageOrder : Number.MAX_SAFE_INTEGER;

  // Collect raw entries preserving all stage occurrences
  const rawEntries = [];
  let hasDirectConsumptions = false;

  for (const execution of (order?.stageExecutions || [])) {
    if (execution.status === 'INVALIDATED') { continue; }

    const execStageIdStr = String(execution.recipeStageId ?? '');
    const stageInfo = stageOrderMap.get(execStageIdStr);
    const execOrder = stageInfo ? stageInfo.stageOrder : Number.MAX_SAFE_INTEGER;

    if (execOrder > failedOrder) { continue; }

    const isFailedStage = execStageIdStr === failedStageIdStr;

    for (const consumption of (execution.consumptions || [])) {
      if (isFailedStage) { hasDirectConsumptions = true; }
      rawEntries.push(Object.assign({}, consumption, {
        _stageName: stageInfo ? stageInfo.stageName : '',
        _stageOrder: execOrder,
        _isFailedStage: isFailedStage,
      }));
    }
  }

  // Deduplicate by (productId, lotId).
  // Same material consumed in multiple stages → one row.
  // Failed-stage entry is preferred as base (backend validates against it).
  const mergeMap = new Map();
  for (const entry of rawEntries) {
    const key = String(entry.productId) + ':' + String(entry.lotId);
    if (!mergeMap.has(key)) {
      mergeMap.set(key, {
        base: entry,
        stageNames: entry._stageName ? [entry._stageName] : [],
        hasFailedStage: entry._isFailedStage,
      });
    } else {
      const merged = mergeMap.get(key);
      if (entry._stageName && !merged.stageNames.includes(entry._stageName)) {
        merged.stageNames.push(entry._stageName);
      }
      // Promote failed-stage entry so backend quantity validation uses it
      if (entry._isFailedStage && !merged.hasFailedStage) {
        merged.base = entry;
        merged.hasFailedStage = true;
      }
    }
  }

  const entries = Array.from(mergeMap.values()).map(function(m) {
    return Object.assign({}, m.base, {
      _stageName: m.stageNames.join(', '),
      _isFailedStage: m.hasFailedStage,
    });
  });

  return { entries, hasDirectConsumptions };
}

function renderQaRejectionFlow(order, snapshotStage) {
  const productionState = WarehouseShell.require('views.productionState');
  const snapshotStages = Array.isArray(order?.recipeVersionSnapshot?.recipeVersion?.stages)
    ? [...order.recipeVersionSnapshot.recipeVersion.stages].sort((a, b) => Number(a.stageOrder ?? 0) - Number(b.stageOrder ?? 0))
    : [];
  const priorStages = snapshotStages.filter((stage) => Number(stage.stageOrder ?? 0) < Number(snapshotStage?.stageOrder ?? 0));
  const invalidatedExecutions = priorStages
    .map((stage) => ({ stage, execution: productionState.findLatestFinishedExecution(order, stage) }))
    .filter((entry) => entry.execution);
  const productNames = buildProductNameLookup(order);

  // Option A: collect ALL consumptions from non-INVALIDATED executions up to
  // and including the rejected stage — mirrors backend resolveOptionARelevantInputs.
  const { entries: optionAEntries, hasDirectConsumptions } = resolveOptionAConsumptions(
    order, snapshotStage, snapshotStages,
  );

  const dispositionLegend = hasDirectConsumptions
    ? 'Disposici\u00F3n de material \u2014 etapa rechazada'
    : 'Disposici\u00F3n de material \u2014 materiales en alcance del rechazo';

  const priorStagesNote = !hasDirectConsumptions && optionAEntries.length > 0
    ? '<p class="wh-caption wh-caption--info" style="margin-bottom:0.5rem">\u26A0\uFE0F Esta etapa no tiene insumos directos. Se muestran los materiales consumidos en etapas previas incluidas en el alcance del rechazo.</p>'
    : '';

  const dispositionContent = optionAEntries.length > 0
    ? renderDispositionRows(optionAEntries, productNames, 'rejected')
    : '<p class="wh-caption">No hay consumos registrados en ninguna etapa del alcance.</p>';

  return `
    <section class="wh-step-section qa-rejection-flow" hidden aria-label="Gesti\u00F3n del rechazo">
      <h4 class="wh-step-section__title">\u274C Gesti\u00F3n del rechazo</h4>
      <p class="qa-rejection-intro wh-caption">Define qu\u00E9 pasa con el material consumido y desde d\u00F3nde debe continuar la producci\u00F3n.</p>
      <fieldset class="qa-material-disposition-section" style="border:none;padding:0;margin:0 0 1rem 0">
        <legend style="font-weight:600">${dispositionLegend}</legend>
        ${priorStagesNote}
        ${dispositionContent}
      </fieldset>
      <fieldset class="qa-continuation-section" style="border:none;padding:0;margin:0 0 1rem 0">
        <legend style="font-weight:600">Punto de continuación</legend>
        <label style="display:block;margin-bottom:0.35rem"><input type="radio" name="qa-continuation-point-${escapeHtml(String(snapshotStage?.id || 'stage'))}" class="qa-continuation-radio" value="CURRENT" checked /> Repetir esta etapa</label>
        <label style="display:block"><input type="radio" name="qa-continuation-point-${escapeHtml(String(snapshotStage?.id || 'stage'))}" class="qa-continuation-radio" value="PRIOR_STAGE" /> Volver a una etapa previa</label>
      </fieldset>
      <div class="qa-prior-stage-selector" hidden>
        <label><span>Etapa de retorno *</span>
          <select class="qa-continuation-stage-select" aria-label="Etapa de retorno">
            <option value="">Selecciona una etapa</option>
            ${priorStages.map((stage) => `<option value="${escapeHtml(String(stage.id))}" data-stage-order="${escapeHtml(String(stage.stageOrder ?? 0))}">${escapeHtml(stage.name || `Etapa ${stage.stageOrder ?? ''}`)}</option>`).join('')}
          </select>
        </label>
        <p class="wh-caption">Estas ejecuciones quedarán invalidadas y requieren definir disposición de sus materiales consumidos.</p>
      </div>
      <div class="qa-invalidated-stages-section" hidden>
        ${invalidatedExecutions.map((entry) => `
          <fieldset class="qa-invalidated-stage-card" data-stage-id="${escapeHtml(String(entry.stage.id))}" data-stage-order="${escapeHtml(String(entry.stage.stageOrder ?? 0))}" data-execution-id="${escapeHtml(String(entry.execution.id))}" hidden style="border:1px solid var(--border,#ddd);border-radius:8px;padding:0.75rem;margin:0 0 0.75rem 0">
            <legend style="font-weight:600">Etapa afectada: ${escapeHtml(entry.stage.name || `Etapa ${entry.stage.stageOrder ?? ''}`)}</legend>
            ${renderDispositionRows(entry.execution.consumptions || [], productNames, `invalidated-${String(entry.execution.id)}`)}
          </fieldset>`).join('')}
      </div>
      <fieldset class="qa-replacement-recovery-section" style="border:none;padding:0;margin:0 0 1rem 0">
        <legend style="font-weight:600">Reposici\u00F3n de materiales</legend>
        <label style="display:block;margin-bottom:0.35rem">
          <input type="checkbox" class="qa-requires-replacement-stage" />
          Crear etapa de reposici\u00F3n de materiales antes de re-ejecutar
        </label>
        <p class="qa-replacement-auto-note wh-caption" style="margin:0;color:var(--color-muted,#888)">
          Se activa autom\u00E1ticamente cuando hay materiales marcados como Descartar o Recolectar nuevamente.
        </p>
      </fieldset>
      <p class="qa-rejection-error wh-error-msg" hidden role="alert" aria-live="assertive"></p>
    </section>`;
}

function renderCancelWithReturnsPanel(order, orderId) {
  const consumptions = aggregateOrderConsumptions(order);
  const oid = escapeHtml(String(orderId));

  const rowsHtml = consumptions.length === 0
    ? '<p class="wh-caption">No hay consumos de materiales registrados — la orden se cancelara sin devoluciones de stock.</p>'
    : consumptions.map((c, idx) => {
      const pid  = escapeHtml(String(c.productId));
      const lid  = escapeHtml(String(c.lotId));
      const name = c.productName
        ? escapeHtml(c.productName) + ' — Lote #' + lid
        : 'Producto #' + pid + ' — Lote #' + lid;
      const maxQ = escapeHtml(String(Number(c.quantity).toFixed(3)));
      return `
        <div class="wh-cancel-return-row"
             data-product-id="${pid}" data-lot-id="${lid}"
             style="border:1px solid var(--border,#ddd);border-radius:6px;padding:0.75rem;margin-bottom:0.5rem">
          <strong>${name}</strong>
          <p class="wh-caption" style="margin:0.2rem 0 0.5rem">Consumido: ${maxQ}</p>
          <label style="display:block;margin-bottom:0.4rem">
            <span>Cantidad a devolver</span>
            <input type="number" class="wh-cancel-return-qty"
                   min="0" max="${maxQ}" step="0.001" value="${maxQ}"
                   aria-label="Cantidad a devolver de ${name}" />
          </label>
          <fieldset style="border:none;padding:0;margin:0">
            <legend class="wh-caption">Destino</legend>
            <label style="display:block">
              <input type="radio" name="wh-clm-${idx}" class="wh-cancel-lot-mode" value="original" checked />
              Devolver al lote original (Lote #${lid})
            </label>
            <label style="display:block;margin-top:0.25rem">
              <input type="radio" name="wh-clm-${idx}" class="wh-cancel-lot-mode" value="new" />
              Crear lote nuevo
            </label>
          </fieldset>
          <div class="wh-cancel-new-lot-fields" style="display:none;margin-top:0.5rem;padding-left:1rem">
            <p class="wh-caption" style="margin:0 0 0.4rem">
              Producto: <strong>${escapeHtml(c.productName || ('Producto #' + pid))}</strong>
            </p>
            <label style="display:block;margin-bottom:0.3rem">
              <span>Codigo del lote nuevo *</span>
              <input type="text" class="wh-cancel-new-lot-code" maxlength="100"
                     placeholder="Ej: DEVOL-${oid}" />
            </label>
            <label style="display:block">
              <span>Fecha de vencimiento (opcional)</span>
              <input type="date" class="wh-cancel-new-lot-expiry"
                     value="${toDateInputValue(c.expirationDate)}" />
            </label>
          </div>
        </div>`;
    }).join('');

  return `
    <section class="wh-cancel-returns-panel"
             data-order-id="${oid}"
             aria-label="Cancelar orden con devolucion de materiales">
      <h3 class="wh-step-section__title">Cancelar orden de produccion</h3>
      <p class="wh-caption wh-caption--warning" style="margin-bottom:0.75rem">
        ⚠️ Esta accion es definitiva y no puede revertirse.
        Indica cuanto de cada material quieres devolver al inventario.
        Puedes poner 0 para no devolver un item.
      </p>
      <div class="wh-cancel-returns-rows">${rowsHtml}</div>
      <label style="display:block;margin-top:0.75rem">
        <span>Nota (opcional)</span>
        <textarea class="wh-cancel-note" rows="2" maxlength="1000"
                  placeholder="Razon de la cancelacion..."></textarea>
      </label>
      <p id="wh-cancel-error" class="wh-error-msg" hidden role="alert" aria-live="assertive"></p>
      <div class="wh-form-actions" style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
        <button type="button" class="secondary-button wh-cancel-dismiss-btn">← Volver</button>
        <button type="button" class="secondary-button danger wh-cancel-no-returns-btn">
          Cancelar sin devolver
        </button>
        <button type="button" class="primary-button danger wh-cancel-with-returns-btn">
          ✓ Confirmar cancelacion con devoluciones
        </button>
      </div>
    </section>
  `;
}


// ─── TASK-007 (qa-rejection-material-reconciliation-amendment) ────────────────

/**
 * Renders the relevant-input scope section.
 * Groups entries by stageName.
 * @param {{ scopeStrategy:string, failedStageId:string, hasDirectConsumptions:boolean, entries:any[] }|null} relevantInputScope
 */
function renderRelevantInputScope(relevantInputScope) {
  if (!relevantInputScope || !Array.isArray(relevantInputScope.entries)) { return ''; }
  if (relevantInputScope.entries.length === 0) {
    return '<div class="wh-alert wh-alert--info" role="status">No se encontraron insumos relevantes de etapas previas.</div>';
  }
  const grouped = new Map();
  for (const entry of relevantInputScope.entries) {
    const key = entry.stageName || ('Etapa #' + entry.recipeStageId);
    if (!grouped.has(key)) { grouped.set(key, { stageOrder: entry.stageOrder, items: [] }); }
    grouped.get(key).items.push(entry);
  }
  const sections = Array.from(grouped.entries())
    .sort((a, b) => Number(a[1].stageOrder) - Number(b[1].stageOrder))
    .map(function([stageName, group]) {
      const rows = group.items.map(function(it) {
        return '<tr><td>Producto #' + escapeHtml(String(it.productId)) + '</td>'
          + '<td>Lote #' + escapeHtml(String(it.lotId)) + '</td>'
          + '<td>' + escapeHtml(String(Number(it.quantity).toFixed(3))) + '</td>'
          + '<td>' + escapeHtml(it.unit || '—') + '</td></tr>';
      }).join('');
      return '<details open><summary style="cursor:pointer;font-weight:600;margin-bottom:0.5rem">▸ Etapa: '
        + escapeHtml(stageName) + '</summary>'
        + '<table class="wh-table" style="width:100%;border-collapse:collapse;margin-bottom:0.75rem">'
        + '<thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Unidad</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table></details>';
    }).join('');
  const banner = !relevantInputScope.hasDirectConsumptions
    ? '<div class="wh-alert wh-alert--info" role="status" style="margin-bottom:0.75rem">'
      + 'Esta etapa no tiene insumos directos. Se muestran los insumos de etapas previas incluidas en el alcance del rechazo.'
      + '</div>'
    : '';
  return '<div class="wh-relevant-input-scope" aria-label="Insumos relevantes en el alcance del rechazo">'
    + banner
    + '<h5 style="margin:0 0 0.5rem;font-weight:600">Insumos del alcance relevante</h5>'
    + sections + '</div>';
}

/**
 * Renders the reconciliation panel for recolected items.
 * @param {any} orderId
 * @param {any} recolectionId
 * @param {Array<{productId:any, lotId:any, quantity:number, unit?:string}>} recolectionEntries
 * @param {{ complete:boolean, remainingBalances:any[] }|null} currentBalance
 */
function renderReconciliationPanel(orderId, recolectionId, recolectionEntries, currentBalance) {
  const rows = (recolectionEntries || []).map(function(entry) {
    const productId = String(entry.productId || '');
    const lotId = String(entry.lotId || '');
    const recolected = Number(entry.quantity || 0);
    const unit = escapeHtml(entry.unit || '');
    return '<div class="wh-reconciliation-row"'
      + ' data-product-id="' + escapeHtml(productId) + '"'
      + ' data-lot-id="' + escapeHtml(lotId) + '"'
      + ' data-recolected="' + escapeHtml(String(recolected)) + '"'
      + ' style="border:1px solid var(--border,#ddd);border-radius:8px;padding:0.75rem;margin-bottom:0.5rem">'
      + '<p style="margin:0 0 0.25rem"><strong>Producto #' + escapeHtml(productId) + '</strong>'
      + ' &middot; Lote #' + escapeHtml(lotId) + '</p>'
      + '<p class="wh-caption" style="margin:0 0 0.5rem">Recolectado: '
      + escapeHtml(String(recolected.toFixed(3))) + ' ' + unit + '</p>'
      + '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-start">'
      + '<label style="flex:1"><span>Destino *</span>'
      + '<select class="wh-reconciliation-outcome"'
      + ' aria-label="Destino para producto ' + escapeHtml(productId) + ' lote ' + escapeHtml(lotId) + '">'
      + '<option value="">Selecciona destino</option>'
      + '<option value="USED">Usado en re-ejecucion</option>'
      + '<option value="RETURNED">Devuelto a bodega</option>'
      + '<option value="DISCARDED">Descartado</option>'
      + '</select></label>'
      + '<label style="flex:1"><span>Cantidad *</span>'
      + '<input type="number" step="0.001" min="0.001" max="' + escapeHtml(String(recolected)) + '"'
      + ' class="wh-reconciliation-qty" aria-label="Cantidad" placeholder="0.000" /></label>'
      + '<label style="flex:2"><span>Notas (opcional)</span>'
      + '<input type="text" class="wh-reconciliation-notes" maxlength="500" placeholder="Nota..." /></label>'
      + '</div>'
      + '<p class="wh-reconciliation-row-error wh-error-msg" hidden role="alert" aria-live="polite"></p>'
      + '</div>';
  }).join('');

  const balanceHtml = currentBalance && !currentBalance.complete && (currentBalance.remainingBalances || []).length > 0
    ? '<div class="wh-alert wh-alert--warning" role="status" style="margin-top:0.75rem">'
      + '&#9888; Balance incompleto'
      + '<ul style="margin:0.25rem 0 0 1rem;padding:0">'
      + (currentBalance.remainingBalances || []).map(function(b) {
          return '<li>' + escapeHtml(String(b.remaining)) + ' de Producto #'
            + escapeHtml(String(b.productId)) + ' (Lote #' + escapeHtml(String(b.lotId)) + ')</li>';
        }).join('')
      + '</ul></div>'
    : '';

  return '<section class="wh-reconciliation-panel"'
    + ' data-order-id="' + escapeHtml(String(orderId)) + '"'
    + ' data-recolection-id="' + escapeHtml(String(recolectionId)) + '"'
    + ' aria-label="Conciliacion de insumos recolectados">'
    + '<h4 style="margin:0 0 0.75rem;font-weight:600">Conciliacion de insumos recolectados</h4>'
    + '<p class="wh-caption" style="margin-bottom:0.75rem">Registra que ocurrio con cada material recolectado.</p>'
    + (rows || '<p class="wh-caption">No hay insumos recolectados registrados.</p>')
    + balanceHtml
    + '<p class="wh-reconciliation-error wh-error-msg" hidden role="alert" aria-live="assertive"></p>'
    + '<div class="wh-form-actions" style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">'
    + '<button type="button" class="secondary-button wh-reconciliation-dismiss-btn">&larr; Volver</button>'
    + '<button type="button" class="primary-button wh-reconciliation-submit-btn"'
    + ' data-order-id="' + escapeHtml(String(orderId)) + '"'
    + ' data-recolection-id="' + escapeHtml(String(recolectionId)) + '">'
    + '&#10003; Registrar conciliacion</button>'
    + '</div></section>';
}

WarehouseShell.register('views.productionRenderersRejection', {
  renderStageLossForm,
  renderPostLossActions,
  renderStageLossHistory,
  renderRejectedStagePanel,
  renderRejectedStageLossesDonePanel,
  renderCancelWithReturnsPanel,
  renderQaRejectionFlow,
  aggregateOrderConsumptions,
  toDateInputValue,
  renderRelevantInputScope,
  renderReconciliationPanel,
  resolveOptionAConsumptions,
});
})();
