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

function isCountOrUnitIngredient(ingredient) {
  return String(ingredient?.product?.presentationType || '').toUpperCase() === 'COUNT'
    || String(ingredient?.unit || '').toUpperCase() === 'UN'
    || String(ingredient?.product?.unit || '').toUpperCase() === 'UN';
}

function buildStageBadges(stage) {
  // AUD-005: frozen snapshot stores inputs under stageInputs (not ingredients/items)
  const ingredients = stage.stageInputs || stage.ingredients || stage.items || [];
  const badges = [];
  if (ingredients.some((ingredient) => isCountOrUnitIngredient(ingredient))) {
    badges.push('COUNT/UN');
  }
  if (stage.stageType === 'RECOLLECTION') {
    badges.push('RECOLLECTION');
  }
  if (stage.stageType === 'PROCESSING' && ['CAPPING', 'PACKING_PREP', 'LABELING_PREP'].includes(String(stage.processCode || ''))) {
    badges.push('Depende de recoleccion');
  }
  return badges;
}

function renderStageAccordion(stage, index, versionQuantityBasis) {
  // AUD-005: frozen snapshot stores inputs under stageInputs (not ingredients/items)
  const ingredients = stage.stageInputs || stage.ingredients || stage.items || [];
  const qaRequired = stage.requiresQualityCheck === true;
  const stageId = `recipe-stage-${index}`;

  let ingredientsHtml = '';
  if (ingredients.length > 0) {
    ingredientsHtml = `
      <div class="recipe-ingredients">
        <h4 class="recipe-ingredients__title">Ingredientes</h4>
        <ul class="recipe-ingredients__list">
          ${ingredients.map((/** @type {any} */ ing) => {
            // FR-007: show effective basis tag when stageInput overrides the version basis
            const ingBasis = ing.inputQuantityBasis ?? null;
            const perUnitTag = (ingBasis === 'PER_FINISHED_UNIT' && versionQuantityBasis !== 'PER_FINISHED_UNIT')
              ? ' <span style="font-size:.78em;color:#0a6c3b;font-weight:600">(por unidad)</span>'
              : '';
            return `
            <li class="recipe-ingredients__item">
              <span class="recipe-ingredients__name">${escapeHtml(ing.product?.name || (ing.productId ? `Producto #${ing.productId}` : '—'))}</span>
              <span class="recipe-ingredients__qty">
                ${escapeHtml(String(ing.quantity || '—'))} ${escapeHtml(ing.unit || '')}${perUnitTag}
                ${ing.tolerance ? ` <em>(±${escapeHtml(String(ing.tolerance))}%)</em>` : ''}
              </span>
            </li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }

  let qaHtml = '';
  if (qaRequired) {
    const qaParams = stage.qualityParameters || [];
    qaHtml = `
      <div class="recipe-qa-params" role="note" aria-label="Parametros de QA obligatorios">
        <p class="wh-qa-required-badge">🔍 QA Obligatorio</p>
        ${qaParams.length > 0 ? `
          <ul class="recipe-ingredients__list">
            ${qaParams.map((/** @type {any} */ p) => `
              <li class="recipe-ingredients__item">
                <span class="recipe-ingredients__name">${escapeHtml(p.name || '—')}</span>
                <span class="recipe-ingredients__qty">${escapeHtml(p.expectedValue || '—')}</span>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  const badges = buildStageBadges(stage);
  const quantityBasisLabel = versionQuantityBasis === 'PER_FINISHED_UNIT' ? 'Por unidad terminada' : 'Por kg de producto terminado';

  return `
    <li class="recipe-stage">
      <button type="button"
              class="recipe-stage__toggle"
              aria-expanded="false"
              aria-controls="${escapeHtml(stageId)}">
        <span>Etapa ${escapeHtml(String(stage.sequence || (index + 1)))} · ${escapeHtml(stage.name || `Etapa ${index + 1}`)}</span>
        <span class="recipe-stage__chevron" aria-hidden="true">▶</span>
      </button>
      <div id="${escapeHtml(stageId)}" class="recipe-stage__content" hidden>
        ${badges.length ? `<p class="recipe-stage__instructions">${badges.map((badge) => `• ${escapeHtml(badge)}`).join(' ')}</p>` : ''}
        <p class="recipe-stage__instructions">Base visible: ${escapeHtml(quantityBasisLabel)}</p>
        ${stage.instructions ? `<p class="recipe-stage__instructions">${escapeHtml(stage.instructions)}</p>` : ''}
        ${ingredientsHtml}
        ${qaHtml}
      </div>
    </li>
  `;
}

function attachAccordionBehavior(container) {
  container.querySelectorAll('.recipe-stage__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const contentId = btn.getAttribute('aria-controls');
      const content = contentId ? document.getElementById(contentId) : null;
      const chevron = btn.querySelector('.recipe-stage__chevron');

      btn.setAttribute('aria-expanded', String(!isExpanded));
      if (content) { content.hidden = isExpanded; }
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
        <p class="wh-alert wh-alert--warning">No se especifico ninguna orden de produccion.</p>
        <button type="button" class="secondary-button" id="go-back">← Volver a produccion</button>
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

      const frozenRecipeSnapshot = order.recipeVersionSnapshot || null;
      const snapshotRecipeVersion = frozenRecipeSnapshot?.recipeVersion || null;
      const snapshotRecipe = frozenRecipeSnapshot?.recipe || null;
      const stages = order.stages || snapshotRecipeVersion?.stages || [];
      const recipeName = snapshotRecipe?.name || order.recipe?.name || order.product?.name || '—';
      const recipeVersion = snapshotRecipeVersion?.versionNumber || snapshotRecipeVersion?.versionLabel || '—';
      const versionQuantityBasis = snapshotRecipeVersion?.quantityBasis || 'PER_OUTPUT_KG';
      const frozenAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es') : '—';

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
        stagesList.innerHTML = stages.map((/** @type {any} */ stage, idx) => renderStageAccordion(stage, idx, versionQuantityBasis)).join('');
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
