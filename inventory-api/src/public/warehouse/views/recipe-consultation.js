/**
 * Warehouse SPA — Frozen recipe consultation view (read-only).
 *
 * Displays the frozen recipe snapshot attached to a production order.
 * No edit, version or approval actions are available from this view (FR-038).
 *
 * Permission: warehouse.access
 * Route: #recipe-consultation?orderId=<id>
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Aggregate stageInputs from all RECOLLECTION stages that precede this one.
 * Used to show processing stages what materials are available from prior collection.
 * @param {any} stage
 * @param {any[]} allStages
 * @returns {{ name: string, quantity: string|number, unit: string }[]}
 */
function computeRecollectedMaterials(stage, allStages) {
  const thisOrder = stage.stageOrder ?? Infinity;
  /** @type {Map<string, { name: string, quantity: number, unit: string }>} */
  const map = new Map();

  for (const s of allStages) {
    if ((s.stageOrder ?? 0) >= thisOrder) { continue; }
    if (s.stageType !== 'RECOLLECTION') { continue; }
    for (const inp of (s.stageInputs || [])) {
      const key = String(inp.productId || inp.name || '');
      const qty = parseFloat(String(inp.quantity || '0')) || 0;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        map.set(key, {
          name: inp.product?.name || inp.name || '—',
          quantity: qty,
          unit: inp.unit || '',
        });
      }
    }
  }
  return [...map.values()];
}

const STAGE_TYPE_LABELS = /** @type {Record<string,string>} */ ({
  RECOLLECTION: 'Recolección',
  PROCESSING:   'Procesamiento',
});

/**
 * @param {any}   stage
 * @param {number} index
 * @param {any[]}  allStages
 */
function renderStageAccordion(stage, index, allStages) {
  const inputs     = stage.stageInputs || [];
  const qaRequired = stage.qaMandatory === true;
  const stageId    = `recipe-stage-${index}`;
  const typeLabel  = STAGE_TYPE_LABELS[stage.stageType] || stage.stageType || '';
  const typeBadge  = typeLabel
    ? `<span class="rc-stage-type-badge rc-stage-type-badge--${escapeHtml(String(stage.stageType || 'default').toLowerCase())}">${escapeHtml(typeLabel)}</span>`
    : '';

  // Instructions block
  const instructionsHtml = stage.instructions
    ? `<div class="rc-stage-section">
         <h4 class="rc-stage-section__title">📋 Instrucciones</h4>
         <p class="recipe-stage__instructions">${escapeHtml(stage.instructions)}</p>
       </div>`
    : '';

  // Own inputs (e.g. RECOLLECTION fetches from warehouse)
  const inputsHtml = inputs.length > 0
    ? `<div class="rc-stage-section">
         <h4 class="rc-stage-section__title">📦 Insumos a recolectar</h4>
         <ul class="recipe-ingredients__list">
           ${inputs.map((/** @type {any} */ inp) => `
             <li class="recipe-ingredients__item">
               <span class="recipe-ingredients__name">${escapeHtml(inp.product?.name || inp.name || '—')}</span>
               <span class="recipe-ingredients__qty">${escapeHtml(String(inp.quantity ?? '—'))} ${escapeHtml(inp.unit || '')}</span>
             </li>
           `).join('')}
         </ul>
       </div>`
    : '';

  // For stages with no own inputs, show what was recollected from prior stages
  const recollected = inputs.length === 0 ? computeRecollectedMaterials(stage, allStages) : [];
  const recollectedHtml = recollected.length > 0
    ? `<div class="rc-stage-section">
         <h4 class="rc-stage-section__title">🧪 Materiales de etapas anteriores</h4>
         <ul class="recipe-ingredients__list">
           ${recollected.map((m) => `
             <li class="recipe-ingredients__item">
               <span class="recipe-ingredients__name">${escapeHtml(m.name)}</span>
               <span class="recipe-ingredients__qty">${escapeHtml(String(m.quantity))} ${escapeHtml(m.unit)}</span>
             </li>
           `).join('')}
         </ul>
       </div>`
    : '';

  // QA parameters
  const qaParams = stage.expectedParameters || [];
  const qaHtml = qaRequired
    ? `<div class="rc-stage-section" role="note" aria-label="Parametros de QA obligatorios">
         <h4 class="rc-stage-section__title">🔍 Control de calidad obligatorio</h4>
         ${qaParams.length > 0 ? `
           <ul class="recipe-ingredients__list">
             ${qaParams.map((/** @type {any} */ p) => `
               <li class="recipe-ingredients__item">
                 <span class="recipe-ingredients__name">${escapeHtml(p.name || '—')}</span>
                 <span class="recipe-ingredients__qty">${escapeHtml(p.expectedValue || '—')} ${escapeHtml(p.unit || '')}</span>
               </li>
             `).join('')}
           </ul>
         ` : '<p style="font-size:0.85rem;color:var(--muted)">Registrar parámetros de calidad antes de continuar.</p>'}
       </div>`
    : '';

  return `
    <li class="recipe-stage">
      <button type="button"
              class="recipe-stage__toggle"
              aria-expanded="false"
              aria-controls="${escapeHtml(stageId)}">
        <span class="rc-toggle-label">
          <span>Etapa ${escapeHtml(String(stage.stageOrder || (index + 1)))} · ${escapeHtml(stage.name || `Etapa ${index + 1}`)}</span>
          ${typeBadge}
        </span>
        <span class="recipe-stage__chevron" aria-hidden="true">▶</span>
      </button>
      <div id="${escapeHtml(stageId)}" class="recipe-stage__content">
        ${instructionsHtml}
        ${inputsHtml}
        ${recollectedHtml}
        ${qaHtml}
      </div>
    </li>
  `;
}

function attachAccordionBehavior(container) {
  container.querySelectorAll('.recipe-stage__toggle').forEach((btn) => {
    // Start collapsed: hide content via display so CSS display:grid doesn't override `hidden`
    const initialContent = btn.closest('.recipe-stage')?.querySelector('.recipe-stage__content');
    if (initialContent) { /** @type {HTMLElement} */ (initialContent).style.display = 'none'; }

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const content = /** @type {HTMLElement|null} */ (btn.closest('.recipe-stage')?.querySelector('.recipe-stage__content'));
      const chevron = btn.querySelector('.recipe-stage__chevron');

      btn.setAttribute('aria-expanded', String(!isExpanded));
      if (content) { content.style.display = isExpanded ? 'none' : ''; }
      if (chevron) { chevron.textContent = isExpanded ? '▶' : '▼'; }
    });
  });
}

function render(container, session, params) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');

  const orderId = params.orderId;

  if (!orderId) {
    container.innerHTML = `
      <div class="warehouse-section">
        <p style="margin-bottom:0.75rem;">
          Esta vista se abre desde el detalle de una orden de producción.<br/>
          Andá a <strong>Producción</strong>, abrí una orden y tocá <em>📋 Ver receta</em>.
        </p>
        <button type="button" class="primary-button" id="go-back">← Ir a Producción</button>
      </div>
    `;
    container.querySelector('#go-back')?.addEventListener('click', () => app.navigate('production'));
    return;
  }

  container.innerHTML = `
    <div class="warehouse-section">
      <button type="button" class="wh-back-btn" id="back-to-order">← Volver a la orden</button>

      <!-- Banner de solo lectura (FR-038, §8 ui-guidelines) -->
      <div class="wh-alert wh-alert--info recipe-readonly-banner"
           role="note"
           aria-label="Aviso de vista de solo lectura">
        🔒 Vista de solo lectura — Receta congelada al momento de crear la orden.
        No es posible editar, versionar ni aprobar recetas desde esta vista.
      </div>

      <p id="recipe-status" role="status" aria-live="polite">Cargando receta...</p>
      <div id="recipe-content"></div>

      <button type="button" class="secondary-button" id="back-to-order-bottom">← Volver a la orden</button>
    </div>
  `;

  container.querySelector('#back-to-order')?.addEventListener('click', () => app.navigate('production', { id: orderId }));
  container.querySelector('#back-to-order-bottom')?.addEventListener('click', () => app.navigate('production', { id: orderId }));

  const statusEl = container.querySelector('#recipe-status');
  const contentEl = container.querySelector('#recipe-content');

  api.getProductionOrder(session, orderId)
    .then((/** @type {any} */ order) => {
      if (statusEl) { statusEl.hidden = true; }

      // recipeVersionSnapshot shape: { recipe, recipeVersion: { versionNumber, stages, ... } }
      const snapshot    = order.recipeVersionSnapshot || null;
      const rv          = snapshot?.recipeVersion || null;
      const stages      = rv?.stages || [];
      const recipeName  = snapshot?.recipe?.name || order.recipe?.name || order.product?.name || '—';
      const recipeVersion = rv?.versionNumber != null ? `v${rv.versionNumber}` : '—';
      const frozenAt    = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es') : '—';

      if (!contentEl) { return; }
      contentEl.innerHTML = `
        <header class="recipe-header">
          <h2 class="recipe-header__title">${escapeHtml(recipeName)}</h2>
          <p class="recipe-header__meta">Version: <strong>${escapeHtml(String(recipeVersion))}</strong></p>
          <p class="recipe-header__meta">Congelada: <strong>${escapeHtml(frozenAt)}</strong></p>
          <p class="recipe-header__meta">Orden: <strong>#ORD-${escapeHtml(String(order.id))}</strong></p>
        </header>
      `;

      if (stages.length > 0) {
        const stagesList = document.createElement('ul');
        stagesList.className = 'recipe-stages-list';
        stagesList.innerHTML = stages.map((/** @type {any} */ stage, idx) => renderStageAccordion(stage, idx, stages)).join('');
        contentEl.append(stagesList);
        attachAccordionBehavior(contentEl);
      } else {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'warehouse-empty';
        emptyMsg.textContent = 'Esta receta no tiene etapas registradas.';
        contentEl.append(emptyMsg);
      }
    })
    .catch((/** @type {any} */ err) => {
      if (statusEl) { statusEl.textContent = err?.message || 'Error al cargar la receta.'; }
    });
}

WarehouseShell.register('views.recipeConsultation', { render });
})();
