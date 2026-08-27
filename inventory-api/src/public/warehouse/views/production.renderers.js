/**
 * Warehouse SPA — Production HTML renderers.
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

const ORDER_STATUS_LABELS = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación', APPROVED: 'Aprobada',
  IN_PROGRESS: 'En progreso', WAITING_QA: 'Esperando QA',
  QA_HOLD: 'Retenido QA', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};
const ORDER_STATUS_BADGE = {
  DRAFT: 'wh-badge--pending',
  PENDING_APPROVAL: 'wh-badge--hold', APPROVED: 'wh-badge--pending',
  IN_PROGRESS: 'wh-badge--pending', WAITING_QA: 'wh-badge--hold',
  QA_HOLD: 'wh-badge--hold', COMPLETED: 'wh-badge--confirmed', CANCELLED: 'wh-badge--rejected',
};
const STAGE_STATUS_LABELS = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', COMPLETED: 'Completado',
  BLOCKED: 'Bloqueado ⛔', WAITING_QA: 'Esperando QA', QA_HOLD: 'Retenido QA',
  // TASK-007: QA rejection sub-states
  QA_REJECTED_PENDING_LOSSES: 'Rechazada por QA — registrar pérdidas',
  QA_REJECTED_LOSSES_DONE: 'Rechazada por QA — lista para re-ejecutar',
};
const STAGE_STATUS_BADGE = {
  PENDING: 'wh-badge--pending', IN_PROGRESS: 'wh-badge--pending',
  COMPLETED: 'wh-badge--confirmed', BLOCKED: 'wh-badge--rejected',
  WAITING_QA: 'wh-badge--hold', QA_HOLD: 'wh-badge--hold',
  // TASK-007: QA rejection sub-states
  QA_REJECTED_PENDING_LOSSES: 'wh-badge--rejected',
  QA_REJECTED_LOSSES_DONE: 'wh-badge--warning',
};

function renderStatusBadge(status) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const cls = ORDER_STATUS_BADGE[status] || 'wh-badge--pending';
  return `<span class="wh-badge ${escapeHtml(cls)}">${escapeHtml(label)}</span>`;
}

function renderStageBadge(status) {
  const label = STAGE_STATUS_LABELS[status] || status;
  const cls = STAGE_STATUS_BADGE[status] || 'wh-badge--pending';
  return `<span class="wh-badge ${escapeHtml(cls)}">${escapeHtml(label)}</span>`;
}

function renderOrderList(orders) {
  if (!orders || !orders.length) {
    return '<li class="warehouse-empty">No hay ordenes de produccion activas.</li>';
  }
  return orders.map((order) => `
    <li>
      <article class="wh-receipt-card">
        <div class="wh-receipt-card__header">
          <span class="wh-receipt-card__id">#ORD-${escapeHtml(String(order.id))}</span>
          ${renderStatusBadge(order.status)}
        </div>
        <p class="wh-receipt-card__meta">${escapeHtml(order.product?.name || `Producto #${order.productId}` || '—')}</p>
        <p class="wh-receipt-card__meta">Cantidad: <strong>${escapeHtml(String(order.quantity ?? '—'))}</strong></p>
        <div class="wh-receipt-card__cta">
          <button type="button" class="primary-button wh-order-view-btn"
                  data-order-id="${escapeHtml(String(order.id))}">Ver →</button>
        </div>
      </article>
    </li>
  `).join('');
}

function renderMaterialRequirements(requirements) {
  if (!Array.isArray(requirements) || !requirements.length) { return ''; }
  const rows = requirements.map((r) => {
    const missing = Number(r.missing ?? 0);
    const icon = missing > 0 ? '⚠️' : '✓';
    return `<li>${icon} <strong>${escapeHtml(r.productName || String(r.productId))}</strong>
      ${escapeHtml(String(r.required ?? '?'))} ${escapeHtml(r.unit || '')} requerido ·
      ${escapeHtml(String(r.available ?? '?'))} disponible${missing > 0 ? ` · <span style="color:var(--color-danger,#c00)">Faltante: ${escapeHtml(String(missing))}</span>` : ''}
    </li>`;
  }).join('');
  return `<section class="wh-step-section" aria-label="Requerimientos de material">
    <h3 class="wh-step-section__title">Requerimientos de material</h3>
    <ul class="wh-item-list">${rows}</ul>
  </section>`;
}

/**
 * Builds the <option> list for a lot dropdown.
 * Format: "LOT-001 — Venc: 2027-01-30 — Disp: 50 Kg"
 */
function buildLotOptions(lots, unit, selectedLotId) {
  const placeholder = `<option value="">Selecciona un lote...</option>`;
  const options = lots.map((lot) => {
    const expLabel = lot.expirationDate ? String(lot.expirationDate).slice(0, 10) : 'Sin venc.';
    const label = `${lot.lotNumber || `Lote #${lot.lotId}`} — Venc: ${expLabel} — Disp: ${lot.availableQuantity ?? '?'} ${unit}`;
    const selected = String(lot.lotId) === String(selectedLotId) ? 'selected' : '';
    return `<option value="${escapeHtml(String(lot.lotId))}" ${selected}>${escapeHtml(label)}</option>`;
  }).join('');
  return placeholder + options;
}

/**
 * Renders one lot consumption row: [dropdown lote] [cantidad] [quitar].
 * @param {object} lots - full lots array for the dropdown
 * @param {string|number} selectedLotId - pre-selected lot
 * @param {number} qty - pre-filled quantity
 * @param {string} unit
 * @param {boolean} removable - show remove button
 */
function renderLotRow(lots, unit, selectedLotId, qty, removable) {
  return `
    <div class="lot-row" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.4rem">
      <label style="flex:1;min-width:200px"><span>Lote *</span>
        <select class="lot-select" required aria-label="Seleccionar lote">
          ${buildLotOptions(lots, unit, selectedLotId)}
        </select>
      </label>
      <label style="width:110px"><span>Cantidad *</span>
        <input type="number" class="lot-qty" min="0.001" step="any"
               value="${escapeHtml(qty > 0 ? String(qty) : '')}"
               required aria-label="Cantidad a consumir" />
      </label>
      ${removable
        ? `<button type="button" class="secondary-button remove-lot-row-btn"
                 title="Quitar fila" style="align-self:flex-end">✕</button>`
        : '<span style="width:2rem"></span>'}
    </div>`;
}

function renderLotPicker(productModel) {
  const lots = productModel.lots || [];
  const unit = escapeHtml(productModel.unit || '');
  const productId = escapeHtml(String(productModel.productId ?? ''));
  const productName = escapeHtml(productModel.productName || '');
  const required = escapeHtml(String(productModel.requiredQuantity ?? '?'));

  // Encode lots catalogue as JSON for dynamic row addition by the controller
  const lotsJson = escapeHtml(JSON.stringify(lots.map((l) => ({
    lotId: l.lotId,
    lotNumber: l.lotNumber,
    expirationDate: l.expirationDate ? String(l.expirationDate).slice(0, 10) : null,
    availableQuantity: l.availableQuantity,
  }))));

  if (!lots.length) {
    return `
      <div class="lot-picker-block" data-product-id="${productId}">
        <p class="muted"><strong>${productName}</strong> — requerido: ${required} ${unit}</p>
        <p class="wh-caption" style="color:var(--color-warning,#b86000)">
          ⚠ Sin lotes disponibles en bodega origen para este insumo.
        </p>
      </div>`;
  }

  // Build initial rows from FEFO/FIFO suggestions; fall back to first lot with empty qty
  const suggested = Array.isArray(productModel.suggested) && productModel.suggested.length
    ? productModel.suggested
    : [{ lotId: lots[0].lotId, quantity: 0 }];

  const initialRows = suggested.map((s, idx) =>
    renderLotRow(lots, productModel.unit || '', s.lotId, Number(s.quantity), idx > 0),
  ).join('');

  return `
    <div class="lot-picker-block"
         data-product-id="${productId}"
         data-lots="${lotsJson}"
         data-unit="${unit}">
      <p class="muted" style="margin-bottom:0.5rem">
        <strong>${productName}</strong>
        — requerido: ${required} ${unit}
        <span class="lot-total-display" style="margin-left:0.5rem;font-weight:600"></span>
      </p>
      <div class="lot-rows-container">
        ${initialRows}
      </div>
      <button type="button" class="secondary-button add-lot-row-btn"
              style="margin-top:0.25rem;font-size:0.85rem">+ Agregar otro lote</button>
      <p class="lot-excess-msg" style="color:var(--color-danger,#c00);display:none;margin-top:0.25rem">
        ⚠ Consumo excede tolerancia. Se requerira justificacion.
      </p>
    </div>`;
}

/**
 * Formulario de analisis QA para el inspector de calidad.
 * Se muestra DESPUES de que el operador completa la etapa.
 * @param {any} snapshotStage  - etapa del snapshot con expectedParameters
 * @param {string|number} stageId
 */
function renderQaAnalysisForm(snapshotStage, stageId) {
  const expected = Array.isArray(snapshotStage?.expectedParameters)
    ? snapshotStage.expectedParameters
    : [];

  const paramRows = expected.map((param) => `
    <div class="qa-param-row" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:0.4rem"
         data-param-name="${escapeHtml(param.name)}">
      <label style="flex:1;min-width:160px"><span>${escapeHtml(param.name)}
        <small class="wh-caption">(esperado: ${escapeHtml(String(param.expectedValue ?? '?'))} ${escapeHtml(param.unit || '')} · rango: ${escapeHtml(String(Number(param.expectedValue ?? 0) - Number(param.minTolerance ?? 0)))}–${escapeHtml(String(Number(param.expectedValue ?? 0) + Number(param.maxTolerance ?? 0)))} ${escapeHtml(param.unit || '')})</small>
      </span>
        <input type="number" step="any" class="qa-result-value" required
               aria-label="Valor medido de ${escapeHtml(param.name)}" />
      </label>
      <label style="width:80px"><span>Unidad</span>
        <input type="text" class="qa-result-unit" value="${escapeHtml(param.unit || '')}"
               aria-label="Unidad de ${escapeHtml(param.name)}" />
      </label>
      <span class="qa-result-badge" aria-live="polite" style="align-self:flex-end;padding-bottom:0.3rem"></span>
    </div>`).join('');

  return `
    <section class="wh-step-section wh-qa-analysis-form" id="qa-form-${escapeHtml(String(stageId))}"
             aria-label="Formulario de analisis QA">
      <h4 class="wh-step-section__title">🔬 Analisis QA</h4>
      <p class="wh-caption" style="margin-bottom:0.75rem">
        Registra los valores medidos. Puedes agregar parametros adicionales.
      </p>

      <div class="qa-params-container">
        ${paramRows}
      </div>
      <button type="button" class="secondary-button add-qa-param-btn"
              style="font-size:0.85rem;margin-bottom:0.75rem">+ Agregar parametro</button>

      <div class="field">
        <label><span>Resultado *</span>
          <select class="qa-result-select" required aria-label="Resultado del analisis">
            <option value="">Selecciona resultado...</option>
            <option value="APPROVED">✓ Aprobado</option>
            <option value="CONDITIONALLY_ACCEPTED">⚠ Aceptado condicionalmente</option>
            <option value="REJECTED">✗ Rechazado</option>
          </select>
        </label>
      </div>
      <div class="field">
        <label><span>Observaciones</span>
          <textarea class="qa-observations" rows="2"
                    placeholder="Observaciones del analisis..."></textarea>
        </label>
      </div>
      <div class="qa-corrective-block" style="display:none">
        <label class="products-field-full"><span>Accion correctiva (requerida para rechazo/condicional) *</span>
          <textarea class="qa-corrective-action" rows="2" minlength="10"
                    placeholder="Describe la accion correctiva tomada..."></textarea>
        </label>
      </div>

      <div class="wh-step-nav">
        <button type="button" class="primary-button qa-submit-btn"
                data-stage-id="${escapeHtml(String(stageId))}">
          Enviar analisis QA
        </button>
      </div>
      <p class="qa-error wh-error-msg" hidden role="alert" aria-live="assertive"></p>
    </section>`;
}

function renderInlineQaCapture(snapshotStage) {
  if (!snapshotStage?.qaMandatory) {
    return '';
  }

  const expectedParameters = Array.isArray(snapshotStage.expectedParameters)
    ? snapshotStage.expectedParameters
    : [];

  if (!expectedParameters.length) {
    return `<section class="wh-step-section" aria-label="QA de etapa">
      <h4 class="wh-step-section__title">🔬 QA de etapa</h4>
      <p class="wh-caption">Esta etapa requiere QA, pero no hay parámetros congelados en el snapshot.</p>
    </section>`;
  }

  const rows = expectedParameters.map((param) => `
    <div class="exec-qa-row"
         data-param-name="${escapeHtml(param.name)}"
         data-expected-value="${escapeHtml(String(param.expectedValue ?? ''))}"
         data-min-tolerance="${escapeHtml(String(param.minTolerance ?? 0))}"
         data-max-tolerance="${escapeHtml(String(param.maxTolerance ?? 0))}"
         data-param-unit="${escapeHtml(param.unit || '')}"
         style="display:grid;grid-template-columns:minmax(180px,1.5fr) minmax(140px,1fr) minmax(140px,1fr) auto;gap:0.5rem;align-items:end;margin-bottom:0.5rem">
      <div>
        <strong>${escapeHtml(param.name)}</strong>
        <p class="wh-caption" style="margin:0.15rem 0 0 0">
          Esperado: ${escapeHtml(String(param.expectedValue ?? '?'))} ${escapeHtml(param.unit || '')}
          · Rango valido: ${escapeHtml(String(Number(param.expectedValue ?? 0) - Number(param.minTolerance ?? 0)))}
          – ${escapeHtml(String(Number(param.expectedValue ?? 0) + Number(param.maxTolerance ?? 0)))} ${escapeHtml(param.unit || '')}
        </p>
      </div>
      <label>
        <span>Valor real *</span>
        <input type="number" step="any" class="exec-qa-actual" aria-label="Valor real de ${escapeHtml(param.name)}" />
      </label>
      <label>
        <span>Unidad</span>
        <input type="text" class="exec-qa-unit" value="${escapeHtml(param.unit || '')}" aria-label="Unidad de ${escapeHtml(param.name)}" />
      </label>
      <span class="exec-qa-badge wh-caption" aria-live="polite"></span>
    </div>
  `).join('');

  return `<section class="wh-step-section" aria-label="QA de etapa">
    <h4 class="wh-step-section__title">🔬 QA de etapa</h4>
    <p class="wh-caption" style="margin-bottom:0.75rem">Registra los parámetros numéricos esperados antes de completar la etapa.</p>
    <div class="exec-qa-rows">${rows}</div>
  </section>`;
}

function renderExecuteStageForm(order, snapshotStage, stageId, lotPickerHtml) {
  const formId = `exec-form-${escapeHtml(String(stageId))}`;
  const qaHtml = renderInlineQaCapture(snapshotStage);
  return `<section class="wh-step-section" id="${formId}"
                   aria-label="Formulario de ejecucion de etapa">
    <h4 class="wh-step-section__title">Ejecutar: ${escapeHtml(snapshotStage?.name || 'Etapa')}</h4>
    <input type="hidden" class="exec-started-at" />
    <input type="hidden" class="exec-ended-at" />
    ${lotPickerHtml}
    ${qaHtml}
    <div class="exec-override-block" hidden>
      <label class="products-field-full" for="exec-override-${escapeHtml(String(stageId))}">
        <span>Justificación del desvío *</span>
        <textarea id="exec-override-${escapeHtml(String(stageId))}" class="exec-override-justification" rows="3" minlength="10"
                  placeholder="Explica la causa del desvío y por qué la etapa puede continuar..."></textarea>
      </label>
      <p class="exec-override-help wh-caption" style="color:var(--color-warning,#b86000)"></p>
    </div>
    <div class="field">
      <label for="exec-notes-${escapeHtml(String(stageId))}">Notas (opcional)</label>
      <textarea id="exec-notes-${escapeHtml(String(stageId))}" class="exec-notes" rows="2"
                placeholder="Observaciones de la ejecucion..."></textarea>
    </div>
    <div class="wh-step-nav">
      <button type="button" class="secondary-button exec-cancel-btn"
              data-stage-id="${escapeHtml(String(stageId))}">Cancelar</button>
      <button type="button" class="primary-button exec-submit-btn"
              data-order-id="${escapeHtml(String(order.id))}"
              data-stage-id="${escapeHtml(String(stageId))}">Completar etapa ✓</button>
    </div>
    <p class="exec-warning wh-caption" hidden aria-live="polite"></p>
    <p class="exec-error wh-error-msg" hidden role="alert" aria-live="assertive"></p>
  </section>`;
}

function renderCompleteForm(order, warehouses) {
  // Sugerir codigo de lote: PROD-{orderId}
  const suggestedLotCode = `PROD-${order.id}`;

  // Sugerir fecha de produccion: hoy en formato YYYY-MM-DD
  const todayStr = new Date().toISOString().slice(0, 10);

  // Fecha de vencimiento: obligatoria solo si el producto lo requiere
  const requiresExpiration = Boolean(order.product?.requiresExpiration);

  // Bodega destino: pre-seleccionar la definida en la orden
  const defaultDestId = String(order.destinationWarehouseId ?? order.destinationWarehouse?.id ?? '');
  const warehouseList = Array.isArray(warehouses) ? warehouses : [];
  const warehouseOptions = warehouseList
    .filter((w) => w.isActive !== false)
    .map((w) => {
      const selected = String(w.id) === defaultDestId ? 'selected' : '';
      const label = `${escapeHtml(w.name)}${w.code ? ` (${escapeHtml(w.code)})` : ''}`;
      return `<option value="${escapeHtml(String(w.id))}" ${selected}>${label}</option>`;
    }).join('');

  // Fallback si aun no cargaron las bodegas: mostrar el id/nombre conocido
  const knownDestName = order.destinationWarehouse?.name
    ? `${escapeHtml(order.destinationWarehouse.name)} — cargando opciones...`
    : 'Cargando bodegas...';
  const warehouseSelectContent = warehouseOptions
    || `<option value="${escapeHtml(defaultDestId)}">${knownDestName}</option>`;

  return `<section class="wh-step-section" id="complete-order-section"
                   aria-labelledby="complete-order-title">
    <h3 class="wh-step-section__title" id="complete-order-title">
      Completar orden de produccion
    </h3>
    <div class="wh-alert wh-alert--warning" role="note">
      ⚠️ Esta accion cierra la orden definitivamente y no puede revertirse.
      Se creara un lote de producto terminado en la bodega seleccionada.
    </div>

    <div class="field">
      <label for="prod-produced-qty">Cantidad producida (salida) *</label>
      <input type="number" id="prod-produced-qty" min="0.001" step="any"
             value="${escapeHtml(String(order.quantity ?? ''))}"
             required aria-required="true" />
    </div>

    <div class="field">
      <label for="prod-dest-warehouse">Bodega destino (producto terminado) *
        <small class="wh-caption">(pre-seleccionada de la orden)</small>
      </label>
      <select id="prod-dest-warehouse" required aria-required="true">
        ${warehouseSelectContent}
      </select>
    </div>

    <div class="field">
      <label for="prod-lot-code">Codigo de lote del producto terminado *
        <small class="wh-caption">(sugerido)</small>
      </label>
      <input type="text" id="prod-lot-code"
             value="${escapeHtml(suggestedLotCode)}"
             required aria-required="true"
             placeholder="Ej: PROD-${escapeHtml(String(order.id))}" />
    </div>

    <div class="field">
      <label for="prod-production-date">Fecha de produccion *
        <small class="wh-caption">(sugerida: hoy)</small>
      </label>
      <input type="date" id="prod-production-date"
             value="${escapeHtml(todayStr)}"
             required aria-required="true" />
    </div>

    <div class="field">
      <label for="prod-expiration-date">Fecha de vencimiento
        ${requiresExpiration ? '<span aria-label="obligatorio">*</span>' : '<small class="wh-caption">(opcional)</small>'}
      </label>
      <input type="date" id="prod-expiration-date"
             ${requiresExpiration ? 'required aria-required="true"' : ''} />
      ${requiresExpiration
        ? '<p class="wh-caption wh-caption--warning">Este producto requiere fecha de vencimiento.</p>'
        : ''}
    </div>

    <div class="field">
      <label for="prod-complete-obs">Observaciones (opcional)</label>
      <textarea id="prod-complete-obs" rows="2"
                placeholder="Observaciones finales de la orden..."></textarea>
    </div>

    <div class="wh-step-nav">
      <button type="button" class="primary-button" id="complete-order-btn"
              data-order-id="${escapeHtml(String(order.id))}">
        Completar orden ✓
      </button>
    </div>
    <p id="complete-order-error" class="wh-error-msg" hidden
       role="alert" aria-live="assertive"></p>
  </section>`;
}

function renderStageItem(order, vm, permissions) {
  const { stage, status, execution } = vm;
  const stageId = stage?.id ?? '';

  const formId = `exec-form-${escapeHtml(String(stageId))}`;
  const qaFormId = `qa-form-${escapeHtml(String(stageId))}`;

  let executionSummary = '';
  if (execution) {
    executionSummary = `
      <p class="wh-caption">
        Ejecutada ${escapeHtml(String(execution.startedAt || '').slice(0, 16).replace('T', ' '))} —
        ${escapeHtml(String(execution.endedAt || '').slice(0, 16).replace('T', ' '))}
      </p>`;
  }

  // Las acciones de etapa solo aplican cuando la orden esta activa (IN_PROGRESS).
  // Una orden CANCELLED, COMPLETED, etc. no debe mostrar ningun boton de accion.
  const orderIsActive = order.status === 'IN_PROGRESS';
  const isWaitingQa = status === 'WAITING_QA';
  // TASK-007: re-executable after QA_REJECTED + lossesAcknowledged
  const isExecutable = orderIsActive && (status === 'PENDING' || status === 'QA_REJECTED_LOSSES_DONE') && permissions.canExecuteProduction;
  const canDoQa = orderIsActive && permissions.canInspectQa && isWaitingQa;
  // TASK-007: manager must declare losses when QA_REJECTED + no losses yet
  const isRejectedPendingLosses = orderIsActive && status === 'QA_REJECTED_PENDING_LOSSES' && permissions.canManageProduction;
  const isRejectedLossesDone    = orderIsActive && status === 'QA_REJECTED_LOSSES_DONE'    && permissions.canManageProduction;

  let blockedMsg = '';
  if (status === 'BLOCKED') {
    blockedMsg = '<p class="wh-caption" style="color:var(--color-danger,#c00)">⛔ Complete la etapa anterior primero.</p>';
  }
  if (isWaitingQa) {
    blockedMsg = `<p class="wh-caption" style="color:var(--color-warning,#b86000)">
      🔬 Inspección QA pendiente. El inspector debe registrar su análisis antes de continuar.
    </p>`;
  }

  let qaInspectionSummary = '';
  if (execution && Array.isArray(execution.qualityInspections) && execution.qualityInspections.length) {
    const last = execution.qualityInspections[0];
    const resultLabel = { APPROVED: '✓ Aprobado', CONDITIONALLY_ACCEPTED: '⚠ Aceptado condicionalmente', REJECTED: '✗ Rechazado' }[last.result] || last.result;
    qaInspectionSummary = `<p class="wh-caption">QA: ${escapeHtml(resultLabel)}</p>`;
  }

  return `<li class="wh-item-card">
    <h3 class="wh-item-card__name">
      ${escapeHtml(stage?.name || `Etapa ${stage?.stageOrder ?? ''}`)}
    </h3>
    ${stage?.qaMandatory ? '<p class="wh-qa-required-badge">🔬 QA requerido</p>' : ''}
    <p class="wh-item-card__meta">Estado: ${renderStageBadge(status)}</p>
    ${executionSummary}
    ${qaInspectionSummary}
    ${blockedMsg}
    <div class="wh-stage-actions">
      ${isExecutable
        ? `<button type="button" class="secondary-button wh-execute-stage-btn"
                   data-stage-id="${escapeHtml(String(stageId))}"
                   data-order-id="${escapeHtml(String(order.id))}"
                   data-form-id="${formId}"
                   aria-expanded="false" aria-controls="${formId}">
             ${status === 'QA_REJECTED_LOSSES_DONE' ? '🔄 Re-ejecutar etapa' : 'Ejecutar etapa'}
           </button>`
        : ''}
      ${canDoQa
        ? `<button type="button" class="secondary-button wh-qa-stage-btn"
                   data-stage-id="${escapeHtml(String(stageId))}"
                   data-order-id="${escapeHtml(String(order.id))}"
                   aria-expanded="false" aria-controls="${qaFormId}">
             🔬 Registrar analisis QA
           </button>`
        : ''}
      ${isRejectedPendingLosses
        ? `<button type="button" class="secondary-button wh-declare-losses-btn"
                   data-stage-id="${escapeHtml(String(stageId))}"
                   data-order-id="${escapeHtml(String(order.id))}">
             📋 Declarar pérdidas
           </button>`
        : ''}
    </div>
    <div id="${formId}-slot"></div>
    <div id="${qaFormId}-slot"></div>
    <div id="loss-form-${escapeHtml(String(stageId))}-slot"></div>
  </li>`;
}

function renderOrderDetail(order, permissions, stagesVm, requirements, warehouses) {
  const productionState = WarehouseShell.require('views.productionState');
  const showCompleteSection = permissions.canCompleteProduction
    && productionState.allSnapshotStagesCompleted(order);

  const stagesHtml = stagesVm.map((vm) => renderStageItem(order, vm, permissions)).join('');
  const requirementsHtml = renderMaterialRequirements(requirements);

  return `
    <header class="wh-order-detail__header">
      <span class="wh-receipt-card__id">#ORD-${escapeHtml(String(order.id))}</span>
      ${renderStatusBadge(order.status)}
    </header>
    <p class="wh-receipt-card__meta">Producto:
      <strong>${escapeHtml(order.product?.name || `Producto #${order.productId}` || '—')}</strong>
    </p>
    <div class="wh-order-detail__actions">
      <button type="button" class="secondary-button" id="view-recipe-btn"
              data-order-id="${escapeHtml(String(order.id))}">📋 Ver receta</button>
      ${order.status === 'DRAFT' && permissions.canCreateProduction
        ? `<button type="button" class="primary-button" id="submit-production-btn"
                   data-order-id="${escapeHtml(String(order.id))}">📤 Enviar a aprobacion</button>
           <p id="submit-production-error" class="wh-error-msg" hidden
              role="alert" aria-live="assertive"></p>`
        : ''}
      ${order.status === 'PENDING_APPROVAL' && permissions.canApproveProduction
        ? `<button type="button" class="primary-button" id="approve-production-btn"
                   data-order-id="${escapeHtml(String(order.id))}">✓ Aprobar orden</button>
           <p id="approve-production-error" class="wh-error-msg" hidden
              role="alert" aria-live="assertive"></p>`
        : ''}
      ${order.status === 'APPROVED' && permissions.canExecuteProduction
        ? `<button type="button" class="primary-button" id="start-production-btn"
                   data-order-id="${escapeHtml(String(order.id))}">▶ Iniciar produccion</button>
           <p id="start-production-error" class="wh-error-msg" hidden
              role="alert" aria-live="assertive"></p>`
        : ''}
      ${['DRAFT','PENDING_APPROVAL','APPROVED','IN_PROGRESS','QA_HOLD'].includes(order.status) && permissions.canCancelProduction
        ? `<button type="button" class="secondary-button danger wh-terminate-production-btn"
                   data-order-id="${escapeHtml(String(order.id))}"
                   style="margin-left:0.5rem">🛑 Cancelar orden</button>`
        : ''}
    </div>
    ${requirementsHtml}
    <h2 class="warehouse-section__title">Etapas</h2>
    <ul class="wh-item-list" id="stages-list">${stagesHtml}</ul>
    ${showCompleteSection ? renderCompleteForm(order, warehouses) : ''}
  `;
}

WarehouseShell.register('views.productionRenderers', {
  renderCompleteForm,
  renderExecuteStageForm,
  renderLotPicker,
  renderMaterialRequirements,
  renderOrderDetail,
  renderOrderList,
  renderQaAnalysisForm,
  renderStageBadge,
  renderStatusBadge,
  renderStageItem,
});
})();
