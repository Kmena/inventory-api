(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

const MOTIVES  = ['VENTA', 'COBRO', 'SEGUIMIENTO'];
const RESULTS  = ['EXITOSA', 'PENDIENTE', 'SIN_CONTACTO', 'REPROGRAMADA'];

const MOTIVE_LABELS  = { VENTA: 'Venta', COBRO: 'Cobro', SEGUIMIENTO: 'Seguimiento' };
const RESULT_LABELS  = { EXITOSA: 'Exitosa', PENDIENTE: 'Pendiente', SIN_CONTACTO: 'Sin contacto', REPROGRAMADA: 'Reprogramada' };

function renderButtonGroup(groupId, labelText, options, labels) {
  const btns = options.map((opt) => `
    <button type="button" class="agent-button-group__btn" data-group="${groupId}" data-value="${opt}">
      ${labels[opt] || opt}
    </button>`).join('');
  return `
    <div class="field">
      <label id="${groupId}-label" style="font-weight:700;">${labelText}</label>
      <div class="agent-button-group" role="group" aria-labelledby="${groupId}-label">
        ${btns}
      </div>
      <span class="agent-field-error" id="${groupId}-error" hidden></span>
    </div>`;
}

function renderContextStrip(store) {
  if (!store) {
    return `<div class="agent-context-strip"><span class="muted" style="font-size:0.85rem;">Cargando datos de tienda…</span></div>`;
  }
  const h = AgentShell.require('helpers');
  return `
    <div class="agent-context-strip">
      <strong style="font-size:0.9rem;">${h.escapeHtml(store.name || '—')}</strong>
      ${h.buildStatusBadge(store.status)}
      ${store.pendingBalance != null ? `<span style="font-size:0.82rem;">Saldo: ${h.currency(store.pendingBalance)}</span>` : ''}
      ${store.daysSinceReference != null ? `<span style="font-size:0.82rem;color:#64748b;">${store.daysSinceReference}d desde última visita</span>` : ''}
    </div>`;
}

function renderVisitHistory(history) {
  const h = AgentShell.require('helpers');
  if (!history?.length) {
    return '<p class="muted" style="font-size:0.85rem;">Esta es la primera visita a esta tienda.</p>';
  }
  return history.slice(0, 6).map((v) => `
    <div class="detail-item" style="font-size:0.82rem;">
      <div style="display:flex;justify-content:space-between;gap:8px;">
        <strong>${h.escapeHtml(MOTIVE_LABELS[v.motive] || v.motive || '—')}</strong>
        <span>${h.formatDate(v.visitedAt || v.createdAt)}</span>
      </div>
      <div style="color:#64748b;">${h.escapeHtml(RESULT_LABELS[v.result] || v.result || '—')}${v.comment ? ' — ' + h.escapeHtml(v.comment) : ''}</div>
    </div>`).join('');
}

function renderVisitForm(storeId, contextStrip, history) {
  return `
    <div class="agent-page" style="padding-bottom:120px;">
      ${contextStrip}

      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="visit-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">Registrar visita</h1>
        <button type="button" id="visit-create-order-btn" class="secondary-button">Crear pedido</button>
      </header>

      <div id="visit-error-banner" hidden class="agent-error-banner"></div>

      <form id="visit-form" style="display:grid;gap:20px;" novalidate>
        ${renderButtonGroup('visit-motive', 'Motivo de visita', MOTIVES, MOTIVE_LABELS)}
        ${renderButtonGroup('visit-result', 'Resultado', RESULTS, RESULT_LABELS)}

        <div class="field">
          <label for="visit-comment" style="font-weight:700;">Observaciones</label>
          <textarea id="visit-comment" name="comment" rows="3" placeholder="Descripción de la visita…" style="font-size:16px;"></textarea>
        </div>

        <div class="field" id="visit-next-date-field" hidden>
          <label for="visit-next-date" id="visit-next-date-label" style="font-weight:700;">Próxima visita sugerida</label>
          <input type="datetime-local" id="visit-next-date" name="suggestedNextVisitAt" style="font-size:16px;" />
          <span class="agent-field-error" id="visit-next-date-error" hidden></span>
        </div>
      </form>

      <section>
        <h2 style="font-size:1rem;font-weight:700;margin:0 0 12px;">Historial reciente</h2>
        <div id="visit-history-list" style="display:grid;gap:8px;">${renderVisitHistory(history)}</div>
      </section>
    </div>

    <div class="agent-submit-bar">
      <button type="submit" form="visit-form" id="visit-submit-btn" class="btn" style="width:100%;font-size:1rem;">Guardar visita</button>
    </div>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

async function render(containerEl, session, params) {
  const storeId  = params?.storeId;
  const api      = AgentShell.require('api.agentApi');
  const state    = AgentShell.require('state');
  const helpers  = AgentShell.require('helpers');
  const navigate = AgentShell.require('navigate');
  const toastEl  = document.getElementById('agent-toast-container');

  // ContextStrip inmediato desde estado compartido
  const cachedStore = state.getStores().find((s) => String(s.id) === String(storeId));
  containerEl.innerHTML = `
    <div class="agent-page">
      ${renderContextStrip(cachedStore)}
      <div class="agent-goals-skeleton" style="margin-top:20px;">
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card" style="height:80px;"></div>
      </div>
    </div>`;

  // Fetch para historial y datos actualizados
  let storeDetail = null;
  let visitHistory = [];
  try {
    const data = await api.fetchStoreDetail(session, storeId);
    storeDetail  = data?.store || data;
    visitHistory = data?.visitHistory || [];
  } catch (_err) {
    // Si falla el fetch, renderizamos el formulario con los datos del caché
    storeDetail = cachedStore;
  }

  const effectiveStore = storeDetail || cachedStore;
  containerEl.innerHTML = renderVisitForm(storeId, renderContextStrip(effectiveStore), visitHistory);

  // ─── Estado local ─────────────────────────────────────────────────────────
  let selectedMotive = '';
  let selectedResult = '';

  // ─── Binding de botones de navegación ────────────────────────────────────
  const backBtn = containerEl.querySelector('#visit-back-btn');
  const orderBtn = containerEl.querySelector('#visit-create-order-btn');
  if (backBtn) backBtn.addEventListener('click', () => navigate('store-detail', { storeId }));
  if (orderBtn) orderBtn.addEventListener('click', () => navigate('order', { storeId }));

  // ─── ButtonGroups ─────────────────────────────────────────────────────────
  containerEl.querySelectorAll('.agent-button-group__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.getAttribute('data-group');
      const value = btn.getAttribute('data-value');

      // Desactivar hermanos del mismo grupo
      containerEl.querySelectorAll(`.agent-button-group__btn[data-group="${group}"]`).forEach((b) => {
        b.classList.remove('agent-button-group__btn--selected');
      });
      btn.classList.add('agent-button-group__btn--selected');

      if (group === 'visit-motive') selectedMotive = value;
      if (group === 'visit-result') {
        selectedResult = value;
        // Campo de fecha requerido solo cuando result === REPROGRAMADA
        const nextDateField = containerEl.querySelector('#visit-next-date-field');
        const nextDateLabel = containerEl.querySelector('#visit-next-date-label');
        const nextDateInput = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#visit-next-date'));
        if (nextDateField) nextDateField.hidden = (value !== 'REPROGRAMADA');
        if (nextDateLabel) {
          nextDateLabel.textContent = value === 'REPROGRAMADA'
            ? 'Próxima visita sugerida *'
            : 'Próxima visita sugerida';
        }
        if (nextDateInput) nextDateInput.required = (value === 'REPROGRAMADA');
      }

      // Limpiar error del grupo al seleccionar
      const errEl = containerEl.querySelector(`#${group}-error`);
      if (errEl) errEl.hidden = true;
    });
  });

  // ─── Submit ───────────────────────────────────────────────────────────────
  const form       = /** @type {HTMLFormElement|null} */ (containerEl.querySelector('#visit-form'));
  const submitBtn  = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector('#visit-submit-btn'));
  const errorBanner = containerEl.querySelector('#visit-error-banner');
  const historyList = containerEl.querySelector('#visit-history-list');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validación inline sin alert()
      let valid = true;

      if (!selectedMotive) {
        const errEl = containerEl.querySelector('#visit-motive-error');
        if (errEl) { errEl.textContent = 'Selecciona un motivo.'; errEl.hidden = false; }
        valid = false;
      }
      if (!selectedResult) {
        const errEl = containerEl.querySelector('#visit-result-error');
        if (errEl) { errEl.textContent = 'Selecciona un resultado.'; errEl.hidden = false; }
        valid = false;
      }

      const nextDateInput = /** @type {HTMLInputElement|null} */ (form.querySelector('#visit-next-date'));
      if (selectedResult === 'REPROGRAMADA' && !nextDateInput?.value) {
        const errEl = containerEl.querySelector('#visit-next-date-error');
        if (errEl) { errEl.textContent = 'La fecha de reprogramación es requerida.'; errEl.hidden = false; }
        if (nextDateInput) nextDateInput.classList.add('agent-input-error');
        valid = false;
      }

      if (!valid) return;

      // Estado "saving"
      if (form) { form.style.pointerEvents = 'none'; form.style.opacity = '0.7'; }
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando…'; }
      if (errorBanner) errorBanner.hidden = true;

      const comment = /** @type {HTMLTextAreaElement|null} */ (form.querySelector('#visit-comment'));
      const payload = {
        clientStoreId: storeId,
        motive:  selectedMotive,
        result:  selectedResult,
        comment: comment?.value?.trim() || undefined,
        suggestedNextVisitAt: nextDateInput?.value
          ? new Date(nextDateInput.value).toISOString()
          : undefined,
      };

      try {
        const response = await AgentShell.require('api.agentApi').postVisit(session, payload);

        // Anteponer al historial sin re-fetch
        const newVisit = response?.visit;
        if (newVisit && historyList) {
          visitHistory = [newVisit, ...visitHistory];
          historyList.innerHTML = renderVisitHistory(visitHistory);
        }

        // Reset formulario
        form.reset();
        selectedMotive = '';
        selectedResult = '';
        containerEl.querySelectorAll('.agent-button-group__btn--selected').forEach((b) => {
          b.classList.remove('agent-button-group__btn--selected');
        });
        const nextFieldEl = containerEl.querySelector('#visit-next-date-field');
        if (nextFieldEl) nextFieldEl.hidden = true;

        if (toastEl) helpers.showToast('Visita registrada correctamente', toastEl);

        // Volver al detalle de la tienda para que el status se recalcule desde la API
        setTimeout(() => navigate('store-detail', { storeId }), 1500);
      } catch (err) {
        // Preserva datos del formulario; muestra banner
        if (errorBanner) {
          errorBanner.textContent = err.message || 'No se pudo registrar la visita. Intenta de nuevo.';
          errorBanner.hidden = false;
        }
      } finally {
        // Restaurar en éxito y en error
        if (form) { form.style.pointerEvents = ''; form.style.opacity = ''; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar visita'; }
      }
    });
  }
}

AgentShell.register('views.visit', { render });

})();
