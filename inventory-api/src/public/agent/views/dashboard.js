(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

// ─── Helpers de renderizado ───────────────────────────────────────────────────

function renderSkeleton() {
  return `
    <div class="agent-page">
      <header class="agent-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:0;">
        <h1 style="margin:0;font-size:1.3rem;color:#0f172a;">Mi ruta</h1>
      </header>
      <div class="agent-goals-skeleton">
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card"></div>
        <div class="agent-skeleton-card"></div>
      </div>
    </div>`;
}

function renderErrorState(message) {
  return `
    <div class="agent-page">
      <h1 style="margin:0 0 8px;font-size:1.3rem;">Mi ruta</h1>
      <div class="agent-error-banner">
        <p style="margin:0;font-weight:700;">No se pudo cargar la ruta</p>
        <p style="margin:0;">${message}</p>
        <button type="button" id="dashboard-retry-btn" class="btn" style="background:#DC2626;color:#fff;padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-weight:700;width:max-content;">Reintentar</button>
      </div>
    </div>`;
}

function renderKpiTile(value, label, linkHash) {
  const helpers = AgentShell.require('helpers');
  const tag = linkHash ? 'button' : 'div';
  const btnAttrs = linkHash ? `type="button" data-nav="${linkHash}"` : '';
  return `
    <${tag} class="agent-kpi-tile${linkHash ? ' agent-kpi-tile--link' : ''}" ${btnAttrs}>
      <span class="agent-kpi-tile__value">${helpers.escapeHtml(String(value ?? '—'))}</span>
      <span class="agent-kpi-tile__label">${helpers.escapeHtml(label)}</span>
    </${tag}>`;
}

function renderStoreCard(store) {
  const helpers = AgentShell.require('helpers');
  const statusClass = {
    VENCIDA:          'agent-store-card--vencida',
    PROXIMA_A_VENCER: 'agent-store-card--proxima',
    NUEVA:            'agent-store-card--nueva',
  }[store.status] || '';

  const saldo = typeof store.pendingBalance === 'number' ? helpers.currency(store.pendingBalance) : '—';
  const badge = helpers.buildStatusBadge(store.status);
  const diasLabel = store.daysSinceReference != null ? `${store.daysSinceReference}d` : '';

  return `
    <button type="button" class="agent-store-card commercial-list-item ${statusClass}" data-store-id="${helpers.escapeHtml(String(store.id))}">
      <div class="commercial-list-item__title" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <span>${helpers.escapeHtml(store.name || '—')}</span>
        ${badge}
      </div>
      <div class="muted" style="font-size:0.82rem;">${helpers.escapeHtml(store.clientName || '')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;">
        <span style="font-size:0.82rem;color:#64748b;">${helpers.escapeHtml(store.regionName || '')}${store.subregionName ? ' · ' + helpers.escapeHtml(store.subregionName) : ''}</span>
        <span style="font-size:0.82rem;font-weight:700;color:${(store.pendingBalance || 0) > 0 ? '#DC2626' : '#374151'};">${helpers.escapeHtml(saldo)}${diasLabel ? ' · ' + helpers.escapeHtml(diasLabel) : ''}</span>
      </div>
    </button>`;
}

function renderDashboard(dashboardData, stores, goalsData, goalsError) {
  const helpers = AgentShell.require('helpers');
  const summary = dashboardData?.summary || {};
  const goalsValue = goalsError ? '—' : (Array.isArray(goalsData?.goals) ? goalsData.goals.length : '—');
  const goalsNote = goalsError ? '<span style="font-size:0.75rem;color:#ef4444;">No disponible</span>' : '';

  const vencidas = stores.filter((s) => s.status === 'VENCIDA').length;

  return `
    <div class="agent-page">
      <header class="agent-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <div>
          <h1 style="margin:0;font-size:1.3rem;color:#0f172a;">Mi ruta</h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="dashboard-map-btn" class="secondary-button" style="display:flex;gap:6px;align-items:center;">
            🗺️ Ver mapa
          </button>
          <button type="button" id="dashboard-refresh-btn" class="secondary-button">Actualizar</button>
          <button type="button" id="dashboard-logout-btn" class="secondary-button" style="color:#dc2626;">Cerrar sesión</button>
        </div>
      </header>

      <div class="agent-kpi-grid">
        ${renderKpiTile(summary.storesToVisitCount ?? stores.length, 'Tiendas en ruta', null)}
        ${renderKpiTile(vencidas, 'Vencidas', null)}
        ${renderKpiTile(summary.nearLimitCount ?? '—', 'Por vencer', null)}
        <div class="agent-kpi-tile agent-kpi-tile--link" data-nav="goals" role="button" tabindex="0" style="cursor:pointer;">
          <span class="agent-kpi-tile__value">${helpers.escapeHtml(String(goalsValue))}</span>
          <span class="agent-kpi-tile__label">Metas activas ${goalsNote}</span>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div class="field" style="flex:1;min-width:180px;margin:0;">
          <input type="search" id="dashboard-filter-name" placeholder="Buscar tienda o cliente…" style="font-size:16px;" />
        </div>
        <div class="field" style="flex:1;min-width:160px;margin:0;">
          <input type="search" id="dashboard-filter-zone" placeholder="Filtrar por zona…" style="font-size:16px;" />
        </div>
        <button type="button" id="dashboard-clear-btn" class="secondary-button" style="white-space:nowrap;">Limpiar</button>
      </div>

      <p id="dashboard-caption" class="agent-map-caption" style="margin:0;"></p>

      <div id="dashboard-store-list" class="commercial-list" style="display:grid;gap:10px;">
        ${stores.map(renderStoreCard).join('')}
      </div>
    </div>`;
}

// ─── Lógica de filtrado ───────────────────────────────────────────────────────

function applyFilter(allStores, nameVal, zoneVal) {
  const name = nameVal.trim().toLowerCase();
  const zone = zoneVal.trim().toLowerCase();
  return allStores.filter((s) => {
    const nameMatch = !name || `${(s.name || '')} ${(s.clientName || '')}`.toLowerCase().includes(name);
    const zoneMatch = !zone || `${(s.regionName || '')} ${(s.subregionName || '')}`.toLowerCase().includes(zone);
    return nameMatch && zoneMatch;
  });
}

function updateCaption(captionEl, filtered) {
  const vencidas = filtered.filter((s) => s.status === 'VENCIDA').length;
  captionEl.textContent = `${filtered.length} tienda${filtered.length !== 1 ? 's' : ''} · ${vencidas} vencida${vencidas !== 1 ? 's' : ''}`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

async function render(containerEl, session, _params) {
  const api     = AgentShell.require('api.agentApi');
  const state   = AgentShell.require('state');
  const helpers = AgentShell.require('helpers');
  const navigate = AgentShell.require('navigate');
  const toastEl = document.getElementById('agent-toast-container');

  containerEl.innerHTML = renderSkeleton();

  // Carga paralela con degradación parcial (ADR-007)
  const [dashResult, storesResult, goalsResult] = await Promise.allSettled([
    api.fetchDashboard(session),
    api.fetchStores(session),
    api.fetchGoals(session),
  ]);

  // Fallo bloqueante si dashboard o stores fallan
  if (dashResult.status === 'rejected' || storesResult.status === 'rejected') {
    const msg = dashResult.status === 'rejected'
      ? dashResult.reason?.message
      : storesResult.reason?.message;
    containerEl.innerHTML = renderErrorState(msg || 'Error de red o servidor.');
    const retryBtn = containerEl.querySelector('#dashboard-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, _params));
    return;
  }

  const dashboardData = dashResult.value;
  const rawStores     = storesResult.value?.stores || storesResult.value || [];
  const goalsData     = goalsResult.value;
  const goalsError    = goalsResult.status === 'rejected';

  // Ordenar y persistir en estado (ADR-004, REQ-009)
  const sortedStores = helpers.sortStores(rawStores);
  state.setStores(sortedStores);
  if (!goalsError && goalsData) state.setGoals(goalsData.goals || []);

  containerEl.innerHTML = renderDashboard(dashboardData, sortedStores, goalsData, goalsError);

  // ─── Event listeners ───────────────────────────────────────────────────────

  const nameInput    = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#dashboard-filter-name'));
  const zoneInput    = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#dashboard-filter-zone'));
  const clearBtn     = containerEl.querySelector('#dashboard-clear-btn');
  const listEl       = containerEl.querySelector('#dashboard-store-list');
  const captionEl    = containerEl.querySelector('#dashboard-caption');
  const refreshBtn   = containerEl.querySelector('#dashboard-refresh-btn');
  const logoutBtn    = containerEl.querySelector('#dashboard-logout-btn');
  const mapBtn       = containerEl.querySelector('#dashboard-map-btn');
  const goalsTile    = containerEl.querySelector('[data-nav="goals"]');

  // Caption inicial
  if (captionEl) updateCaption(captionEl, sortedStores);

  // Filtrado local sin re-fetch (ADR-004)
  function refilter() {
    if (!listEl || !captionEl) return;
    const filtered = applyFilter(sortedStores, nameInput?.value || '', zoneInput?.value || '');
    listEl.innerHTML = filtered.length
      ? filtered.map(renderStoreCard).join('')
      : '<p class="muted" style="padding:24px;text-align:center;">No se encontraron tiendas con ese filtro.</p>';
    updateCaption(captionEl, filtered);
    bindStoreCards(listEl);
  }

  if (nameInput) nameInput.addEventListener('input', refilter);
  if (zoneInput) zoneInput.addEventListener('input', refilter);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (nameInput) nameInput.value = '';
      if (zoneInput) zoneInput.value = '';
      refilter();
    });
  }

  // Tap en StoreCard → navega y persiste storeId
  function bindStoreCards(root) {
    root.querySelectorAll('[data-store-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const storeId = card.getAttribute('data-store-id');
        state.setSelectedStoreId(storeId);
        navigate('store-detail', { storeId });
      });
    });
  }
  if (listEl) bindStoreCards(listEl);

  // Tile Metas
  if (goalsTile) {
    goalsTile.addEventListener('click', () => navigate('goals'));
    goalsTile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') navigate('goals'); });
  }

  // Botón Mapa
  if (mapBtn) mapBtn.addEventListener('click', () => navigate('map'));

  // Botón Actualizar
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Actualizando…';
      await render(containerEl, session, _params);
      if (toastEl) helpers.showToast('Ruta actualizada', toastEl);
    });
  }

  // Cerrar sesión
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const inventoryAuth = /** @type {any} */ (window).InventoryAuth;
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Cerrando sesión…';
      await inventoryAuth.logout(session);
    });
  }
}

AgentShell.register('views.dashboard', { render });

})();
