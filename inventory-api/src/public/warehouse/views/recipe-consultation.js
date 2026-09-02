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

function renderStageAccordion(stage, index) {
  const ingredients = stage.ingredients || stage.items || [];
  const qaRequired = stage.requiresQualityCheck === true;
  const stageId = `recipe-stage-${index}`;

  let ingredientsHtml = '';
  if (ingredients.length > 0) {
    ingredientsHtml = `
      <div class="recipe-ingredients">
        <h4 class="recipe-ingredients__title">Ingredientes</h4>
        <ul class="recipe-ingredients__list">
          ${ingredients.map((/** @type {any} */ ing) => `
            <li class="recipe-ingredients__item">
              <span class="recipe-ingredients__name">${escapeHtml(ing.product?.name || (ing.productId ? `Producto #${ing.productId}` : '—'))}</span>
              <span class="recipe-ingredients__qty">
                ${escapeHtml(String(ing.quantity || '—'))} ${escapeHtml(ing.unit || '')}
                ${ing.tolerance ? ` <em>(±${escapeHtml(String(ing.tolerance))}%)</em>` : ''}
              </span>
            </li>
          `).join('')}
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

      const snapshot = order.frozenRecipeSnapshot || order.recipe || null;
      const stages = order.stages || snapshot?.stages || [];
      const recipeName = snapshot?.name || order.recipe?.name || order.product?.name || '—';
      const recipeVersion = snapshot?.versionLabel || snapshot?.version || '—';
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
        stagesList.innerHTML = stages.map((/** @type {any} */ stage, idx) => renderStageAccordion(stage, idx)).join('');
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
