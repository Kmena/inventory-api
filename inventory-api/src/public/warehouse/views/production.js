/**
 * Warehouse SPA — Production view.
 *
 * Lists active production orders and exposes:
 *   - Start production order (production.execute permission)
 *   - Stage execution with inline form (production.execute permission)
 *   - QA inspection navigation (quality.inspect permission)
 *   - Order completion form (production.complete permission)
 *   - Read-only recipe snapshot navigation
 *
 * Permissions:
 *   production.execute  — canExecuteProduction
 *   production.complete — canCompleteProduction
 *   production.view     — canViewProduction
 *   quality.inspect     — canInspect
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ORDER_STATUS_LABELS = /** @type {Record<string, string>} */ ({
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  WAITING_QA:  'Esperando QA',
  QA_HOLD:     'Retenido QA',
  COMPLETED:   'Completado',
  CANCELLED:   'Cancelado',
});

const ORDER_STATUS_BADGE = /** @type {Record<string, string>} */ ({
  PENDING:     'wh-badge--pending',
  IN_PROGRESS: 'wh-badge--pending',
  WAITING_QA:  'wh-badge--hold',
  QA_HOLD:     'wh-badge--hold',
  COMPLETED:   'wh-badge--confirmed',
  CANCELLED:   'wh-badge--rejected',
});

const STAGE_STATUS_LABELS = /** @type {Record<string, string>} */ ({
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED:   'Completado',
  WAITING_QA:  'Esperando QA',
  QA_HOLD:     'Retenido QA',
  CANCELLED:   'Cancelado',
});

const STAGE_STATUS_BADGE = /** @type {Record<string, string>} */ ({
  PENDING:     'wh-badge--pending',
  IN_PROGRESS: 'wh-badge--pending',
  COMPLETED:   'wh-badge--confirmed',
  WAITING_QA:  'wh-badge--hold',
  QA_HOLD:     'wh-badge--hold',
  CANCELLED:   'wh-badge--rejected',
});

function renderStatusBadge(status) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const cls = ORDER_STATUS_BADGE[status] || 'wh-badge--pending';
  return `<span class="wh-badge ${cls}">${escapeHtml(label)}</span>`;
}

function renderStageBadge(status) {
  const label = STAGE_STATUS_LABELS[status] || status;
  const cls = STAGE_STATUS_BADGE[status] || 'wh-badge--pending';
  return `<span class="wh-badge ${cls}">${escapeHtml(label)}</span>`;
}

// -----------------------------------------------------------------------
// Order list
// -----------------------------------------------------------------------

function renderOrderList(container, session) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');
  const state = WarehouseShell.require('state');
  const permissions = state.derivePermissions(session);

  container.innerHTML = `
    <div class="warehouse-section">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 class="warehouse-section__title" style="margin:0">Ordenes de produccion activas</h2>
        ${permissions.canCreateProduction
          ? '<button type="button" class="primary-button" id="prod-new-cta">➕ Nueva orden</button>'
          : ''}
      </div>
      <p id="production-status" role="status" aria-live="polite">Cargando ordenes...</p>
      <ul id="production-list" class="warehouse-card-list" aria-label="Ordenes de produccion activas"></ul>
    </div>
  `;

  container.querySelector('#prod-new-cta')?.addEventListener('click', () => {
    app.navigate('production', { action: 'new' });
  });

  const statusEl = container.querySelector('#production-status');
  const listEl = container.querySelector('#production-list');

  api.listActiveProductionOrders(session)
    .then((/** @type {any[]} */ orders) => {
      if (statusEl) { statusEl.hidden = true; }
      if (!orders || orders.length === 0) {
        if (listEl) { listEl.innerHTML = '<li class="warehouse-empty">No hay ordenes de produccion activas.</li>'; }
        return;
      }

      if (listEl) { listEl.innerHTML = ''; }
      for (const order of orders) {
        const li = document.createElement('li');
        li.innerHTML = `
          <article class="wh-receipt-card">
            <div class="wh-receipt-card__header">
              <span class="wh-receipt-card__id">#ORD-${escapeHtml(String(order.id))}</span>
              ${renderStatusBadge(order.status)}
            </div>
            <p class="wh-receipt-card__meta">${escapeHtml(order.product?.name || `Producto #${order.productId}` || '—')}</p>
            <p class="wh-receipt-card__meta">Cantidad planificada: <strong>${escapeHtml(String(order.quantity ?? order.plannedQuantity ?? '—'))}</strong></p>
            <div class="wh-receipt-card__cta">
              <button type="button" class="primary-button wh-order-view-btn"
                      data-order-id="${escapeHtml(String(order.id))}">Ver →</button>
            </div>
          </article>
        `;
        if (listEl) { listEl.append(li); }
      }

      if (listEl) {
        listEl.addEventListener('click', (evt) => {
          const btn = /** @type {HTMLElement} */ (evt.target);
          if (btn.classList.contains('wh-order-view-btn')) {
            const oid = btn.dataset.orderId;
            if (oid) { app.navigate('production', { id: oid }); }
          }
        });
      }
    })
    .catch((/** @type {any} */ err) => {
      if (statusEl) { statusEl.textContent = err?.message || 'Error al cargar ordenes.'; }
    });
}

// -----------------------------------------------------------------------
// Order detail
// -----------------------------------------------------------------------

function renderOrderDetail(container, session, params) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');
  const state = WarehouseShell.require('state');

  const permissions = state.derivePermissions(session);
  const orderId = params.id;

  container.innerHTML = `
    <div class="warehouse-section">
      <button type="button" class="wh-back-btn" id="back-to-orders">← Produccion</button>
      <p id="order-detail-status" role="status" aria-live="polite">Cargando orden...</p>
      <div id="order-detail-content"></div>
    </div>
  `;

  container.querySelector('#back-to-orders')?.addEventListener('click', () => app.navigate('production'));
  const statusEl = container.querySelector('#order-detail-status');
  const contentEl = container.querySelector('#order-detail-content');

  api.getProductionOrder(session, orderId)
    .then((/** @type {any} */ order) => {
      if (statusEl) { statusEl.hidden = true; }
      renderOrderContent(contentEl, session, order, permissions, params);
    })
    .catch((/** @type {any} */ err) => {
      if (statusEl) { statusEl.textContent = err?.message || 'Error al cargar la orden.'; }
    });
}

function renderOrderContent(container, session, order, permissions, params = {}) {
  const api = WarehouseShell.require('warehouseApi');
  const app = WarehouseShell.require('app');
  const stages = order.stages || [];

  const allStagesCompleted = stages.length > 0 && stages.every(
    (/** @type {any} */ s) => s.status === 'COMPLETED',
  );
  const showCompleteSection = permissions.canCompleteProduction && allStagesCompleted;

  let stagesHtml = '';
  for (const stage of stages) {
    const qaRequired    = stage.requiresQualityCheck === true;
    const isExecutable  = (stage.status === 'PENDING' || stage.status === 'IN_PROGRESS')
                          && permissions.canExecuteProduction;
    const isInspectable = stage.status === 'WAITING_QA'
                          && permissions.canInspect
                          && qaRequired;
    const formId = `exec-form-${escapeHtml(String(stage.id))}`;
    const qtyId  = `exec-qty-${escapeHtml(String(stage.id))}`;
    const obsId  = `exec-obs-${escapeHtml(String(stage.id))}`;
    const errId  = `exec-err-${escapeHtml(String(stage.id))}`;

    stagesHtml += `
      <li class="wh-item-card">
        <h3 class="wh-item-card__name">
          ${escapeHtml(stage.name || `Etapa ${stage.sequence || stage.id}`)}
        </h3>
        ${qaRequired ? '<p class="wh-qa-required-badge">🔍 QA Obligatorio</p>' : ''}
        <p class="wh-item-card__meta">Estado: ${renderStageBadge(stage.status || 'PENDING')}</p>

        <div class="wh-stage-actions">
          ${isExecutable
            ? `<button type="button"
                       class="secondary-button wh-execute-stage-btn"
                       data-stage-id="${escapeHtml(String(stage.id))}"
                       data-order-id="${escapeHtml(String(order.id))}"
                       data-form-id="${formId}"
                       aria-expanded="false"
                       aria-controls="${formId}">
                 Ejecutar etapa
               </button>`
            : ''}
          ${isInspectable
            ? `<button type="button"
                       class="secondary-button wh-inspect-stage-btn"
                       data-stage-id="${escapeHtml(String(stage.id))}"
                       data-order-id="${escapeHtml(String(order.id))}">
                 Inspeccionar
               </button>`
            : ''}
        </div>

        ${isExecutable
          ? `<section class="wh-step-section" id="${formId}" hidden
                       aria-label="Formulario de ejecucion de etapa">
               <h4 class="wh-step-section__title">
                 Ejecutar: ${escapeHtml(stage.name || 'Etapa')}
               </h4>
               <div class="field">
                 <label for="${qtyId}">Cantidad procesada *</label>
                 <input type="number"
                        id="${qtyId}"
                        min="1"
                        required
                        aria-required="true"
                        placeholder="Ej. 100" />
               </div>
               <div class="field">
                 <label for="${obsId}">Observaciones (opcional)</label>
                 <textarea id="${obsId}" rows="3"
                           placeholder="Notas de la ejecucion..."></textarea>
               </div>
               <div class="wh-step-nav">
                 <button type="button"
                         class="secondary-button"
                         data-cancel-form="${formId}"
                         data-execute-btn-form="${formId}">
                   Cancelar
                 </button>
                 <button type="button"
                         class="primary-button wh-submit-stage-btn"
                         data-stage-id="${escapeHtml(String(stage.id))}"
                         data-order-id="${escapeHtml(String(order.id))}"
                         data-form-id="${formId}"
                         data-qty-id="${qtyId}"
                         data-obs-id="${obsId}"
                         data-err-id="${errId}">
                   Completar etapa ✓
                 </button>
               </div>
               <p id="${errId}" class="wh-error-msg" hidden
                  role="alert" aria-live="assertive"></p>
             </section>`
          : ''}
      </li>
    `;
  }

  if (!container) { return; }

  container.innerHTML = `
    <header class="wh-order-detail__header">
      <span class="wh-receipt-card__id">#ORD-${escapeHtml(String(order.id))}</span>
      ${renderStatusBadge(order.status)}
    </header>
    <p class="wh-receipt-card__meta">Producto: <strong>${escapeHtml(order.product?.name || `Producto #${order.productId}` || '—')}</strong></p>

    <div class="wh-order-detail__actions">
      <button type="button" class="secondary-button" id="view-recipe-btn"
              data-order-id="${escapeHtml(String(order.id))}">
        📋 Ver receta congelada
      </button>
      ${order.status === 'PENDING' && permissions.canExecuteProduction
        ? `<button type="button"
                   class="primary-button"
                   id="start-production-btn"
                   data-order-id="${escapeHtml(String(order.id))}">
             ▶ Iniciar produccion
           </button>
           <p id="start-production-error" class="wh-error-msg" hidden
              role="alert" aria-live="assertive"></p>`
        : ''}
    </div>

    <h2 class="warehouse-section__title">Etapas</h2>
    <ul class="wh-item-list" id="stages-list">${stagesHtml}</ul>

    ${showCompleteSection
      ? `<section class="wh-step-section" id="complete-order-section"
                   aria-labelledby="complete-order-title">
           <h3 class="wh-step-section__title" id="complete-order-title">
             Completar orden de produccion
           </h3>
           <div class="wh-alert wh-alert--warning" role="note">
             ⚠️ Esta accion cierra la orden definitivamente y no puede revertirse.
             Verifique que todas las etapas esten correctamente registradas.
           </div>
           <div class="field">
             <label for="prod-output-qty">Cantidad producida (salida) *</label>
             <input type="number"
                    id="prod-output-qty"
                    min="1"
                    value="${escapeHtml(String(order.plannedQuantity || ''))}"
                    required
                    aria-required="true" />
           </div>
           <div class="field">
             <label for="prod-complete-obs">Observaciones (opcional)</label>
             <textarea id="prod-complete-obs" rows="3"
                       placeholder="Observaciones finales de la orden..."></textarea>
           </div>
           <div class="wh-step-nav">
             <button type="button"
                     class="primary-button"
                     id="complete-order-btn"
                     data-order-id="${escapeHtml(String(order.id))}">
               Completar orden ✓
             </button>
           </div>
           <p id="complete-order-error" class="wh-error-msg" hidden
              role="alert" aria-live="assertive"></p>
         </section>`
      : ''}
  `;

  // View recipe
  container.querySelector('#view-recipe-btn')?.addEventListener('click', () => {
    app.navigate('recipe-consultation', { orderId: String(order.id) });
  });

  // Start production order
  const startBtn = /** @type {HTMLButtonElement | null} */ (container.querySelector('#start-production-btn'));
  const startErr = /** @type {HTMLElement | null} */ (container.querySelector('#start-production-error'));

  startBtn?.addEventListener('click', () => {
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = 'Iniciando...';
    }
    if (startErr) { startErr.hidden = true; }

    api.startProductionOrder(session, order.id)
      .then(() => {
        app.showToast('Orden iniciada ✓');
        renderOrderDetail(
          container.closest('.warehouse-section')?.parentElement || container,
          session,
          params,
        );
      })
      .catch((/** @type {any} */ err) => {
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.textContent = '▶ Iniciar produccion';
        }
        if (startErr) {
          startErr.textContent = err?.message || 'No se pudo iniciar la orden.';
          startErr.hidden = false;
        }
      });
  });

  // Expand inline stage execution form
  container.querySelectorAll('.wh-execute-stage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const formId = /** @type {HTMLElement} */ (btn).dataset.formId;
      const formEl = formId ? container.querySelector(`#${formId}`) : null;
      if (formEl) {
        /** @type {HTMLElement} */ (formEl).hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        /** @type {HTMLButtonElement} */ (btn).disabled = true;
        /** @type {HTMLElement | null} */ (formEl.querySelector('input[type="number"]'))?.focus();
      }
    });
  });

  // Cancel inline stage form
  container.querySelectorAll('[data-cancel-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const formId = /** @type {HTMLElement} */ (btn).dataset.cancelForm;
      const formEl = formId ? container.querySelector(`#${formId}`) : null;
      if (formEl) {
        /** @type {HTMLElement} */ (formEl).hidden = true;
        const execBtn = container.querySelector(`.wh-execute-stage-btn[data-form-id="${formId}"]`);
        if (execBtn) {
          /** @type {HTMLButtonElement} */ (execBtn).disabled = false;
          execBtn.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });

  // Submit stage execution
  container.querySelectorAll('.wh-submit-stage-btn').forEach((submitBtn) => {
    submitBtn.addEventListener('click', () => {
      const el    = /** @type {HTMLElement} */ (submitBtn);
      const qtyEl = /** @type {HTMLInputElement | null} */ (
        container.querySelector(`#${el.dataset.qtyId}`)
      );
      const obsEl = /** @type {HTMLTextAreaElement | null} */ (
        container.querySelector(`#${el.dataset.obsId}`)
      );
      const errEl = el.dataset.errId
        ? /** @type {HTMLElement | null} */ (container.querySelector(`#${el.dataset.errId}`))
        : null;

      const qty = Number(qtyEl?.value || 0);
      if (!qty || qty < 1) {
        if (errEl) {
          errEl.textContent = 'La cantidad procesada debe ser mayor a 0.';
          errEl.hidden = false;
        }
        qtyEl?.focus();
        return;
      }

      /** @type {HTMLButtonElement} */ (submitBtn).disabled = true;
      submitBtn.textContent = 'Completando...';
      if (errEl) { errEl.hidden = true; }

      const payload = {
        quantityProcessed: qty,
        observations: obsEl?.value?.trim() || null,
      };

      api.executeProductionStage(session, el.dataset.orderId, el.dataset.stageId, payload)
        .then(() => {
          app.showToast('Etapa completada ✓');
          renderOrderDetail(
            container.closest('.warehouse-section')?.parentElement || container,
            session,
            params,
          );
        })
        .catch((/** @type {any} */ err) => {
          /** @type {HTMLButtonElement} */ (submitBtn).disabled = false;
          submitBtn.textContent = 'Completar etapa ✓';
          if (errEl) {
            errEl.textContent = err?.message || 'No se pudo completar la etapa.';
            errEl.hidden = false;
          }
        });
    });
  });

  // Inspect stage buttons (QA navigation)
  container.querySelectorAll('.wh-inspect-stage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stageId = /** @type {HTMLElement} */ (btn).dataset.stageId;
      app.navigate('production', { id: String(order.id), action: 'inspect', stageId });
    });
  });

  // Complete order
  const completeBtn = /** @type {HTMLButtonElement | null} */ (container.querySelector('#complete-order-btn'));
  const completeErr = /** @type {HTMLElement | null} */ (container.querySelector('#complete-order-error'));

  completeBtn?.addEventListener('click', () => {
    const qtyEl = /** @type {HTMLInputElement | null} */ (container.querySelector('#prod-output-qty'));
    const obsEl = /** @type {HTMLTextAreaElement | null} */ (container.querySelector('#prod-complete-obs'));

    const qty = Number(qtyEl?.value || 0);
    if (!qty || qty < 1) {
      if (completeErr) {
        completeErr.textContent = 'La cantidad producida debe ser mayor a 0.';
        completeErr.hidden = false;
      }
      qtyEl?.focus();
      return;
    }

    if (completeBtn) {
      completeBtn.disabled = true;
      completeBtn.textContent = 'Completando...';
    }
    if (completeErr) { completeErr.hidden = true; }

    const payload = {
      outputQuantity: qty,
      observations: obsEl?.value?.trim() || null,
    };

    api.completeProductionOrder(session, order.id, payload)
      .then(() => {
        app.showToast('Orden de produccion completada ✓');
        app.navigate('production');
      })
      .catch((/** @type {any} */ err) => {
        if (completeBtn) {
          completeBtn.disabled = false;
          completeBtn.textContent = 'Completar orden ✓';
        }
        if (completeErr) {
          completeErr.textContent = err?.message || 'No se pudo completar la orden.';
          completeErr.hidden = false;
        }
      });
  });
}

// -----------------------------------------------------------------------
// Main render
// -----------------------------------------------------------------------

function render(container, session, params) {
  if (params.action === 'new') {
    // Delegate to the dedicated creation view (SRP — keeps this file focused on list/detail).
    const productionNew = WarehouseShell.require('views.productionNew');
    productionNew.render(container, session, params);
    return;
  }
  if (params.id) {
    renderOrderDetail(container, session, params);
  } else {
    renderOrderList(container, session);
  }
}

WarehouseShell.register('views.production', { render });
})();
