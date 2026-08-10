(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

// Costa Rica center (fallback cuando no hay tiendas con coords)
const COSTA_RICA_CENTER = [9.7489, -83.7534];
const DEFAULT_ZOOM = 8;

// ─── Helpers de marcador ──────────────────────────────────────────────────────

function statusToMarkerClass(status) {
  const map = {
    VENCIDA:          'agent-map-marker--vencida',
    PROXIMA_A_VENCER: 'agent-map-marker--proxima_a_vencer',
    NUEVA:            'agent-map-marker--nueva',
    AL_DIA:           'agent-map-marker--aldia',
  };
  return map[status] || 'agent-map-marker--aldia';
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function buildPopupHtml(store) {
  const h = AgentShell.require('helpers');
  return `
    <div style="min-width:180px;display:grid;gap:6px;">
      <strong style="font-size:0.9rem;">${h.escapeHtml(store.name || '—')}</strong>
      <div style="font-size:0.8rem;color:#64748b;">${h.escapeHtml(store.clientName || '')}</div>
      ${h.buildStatusBadge(store.status)}
      <button type="button" class="btn" style="margin-top:4px;font-size:0.82rem;padding:6px 12px;" data-map-store-id="${h.escapeHtml(String(store.id))}">Ver ficha →</button>
    </div>`;
}

// ─── Tarjeta de lista lateral ─────────────────────────────────────────────────

function renderStoreMapCard(store, isSelected) {
  const h = AgentShell.require('helpers');
  const noCoords = store.latitude == null || store.longitude == null;
  return `
    <button type="button"
      class="agent-map-client-card${isSelected ? ' active' : ''}"
      data-map-card-id="${h.escapeHtml(String(store.id))}"
      ${noCoords ? 'disabled style="opacity:0.6;cursor:default;"' : ''}
    >
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <strong style="font-size:0.88rem;text-align:left;">${h.escapeHtml(store.name || '—')}</strong>
        ${noCoords
          ? '<span class="badge" style="background:#e2e8f0;color:#64748b;font-size:0.72rem;padding:2px 8px;border-radius:999px;flex-shrink:0;">Sin ubicación</span>'
          : h.buildStatusBadge(store.status)}
      </div>
      <div style="font-size:0.78rem;color:#64748b;text-align:left;">${h.escapeHtml(store.clientName || '')}</div>
    </button>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

async function render(containerEl, session, _params) {
  const api      = AgentShell.require('api.agentApi');
  const state    = AgentShell.require('state');
  const helpers  = AgentShell.require('helpers');
  const navigate = AgentShell.require('navigate');
  const L        = /** @type {any} */ (window).L;

  // Reutiliza state o hace fetch autónomo
  let allStores = state.getStores();
  if (!allStores.length) {
    containerEl.innerHTML = `
      <div class="agent-page">
        <div class="agent-goals-skeleton">
          <div class="agent-skeleton-card" style="height:400px;"></div>
        </div>
      </div>`;
    try {
      const data = await api.fetchStores(session);
      allStores  = helpers.sortStores(data?.stores || data || []);
      state.setStores(allStores);
    } catch (err) {
      containerEl.innerHTML = `
        <div class="agent-page">
          <div class="agent-error-banner">
            <p style="margin:0;font-weight:700;">No se pudo cargar el mapa</p>
            <p style="margin:0;">${helpers.escapeHtml(err.message)}</p>
            <button type="button" id="map-retry-btn" class="btn" style="background:#DC2626;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;width:max-content;">Reintentar</button>
          </div>
        </div>`;
      const retryBtn = containerEl.querySelector('#map-retry-btn');
      if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, _params));
      return;
    }
  }

  const storesWithCoords    = allStores.filter((s) => s.latitude != null && s.longitude != null);
  const storesWithoutCoords = allStores.filter((s) => s.latitude == null || s.longitude == null);

  // ─── Estructura del DOM del mapa ──────────────────────────────────────────

  containerEl.innerHTML = `
    <div class="agent-page" style="padding:0;">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px;margin-bottom:0;">
        <button type="button" id="map-back-btn" class="secondary-button">← Inicio</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">Mapa de ruta</h1>
      </header>

      ${storesWithoutCoords.length > 0
        ? `<div class="agent-coordinates-notice" style="margin:0 16px 12px;">
             ℹ️ ${storesWithoutCoords.length} tienda${storesWithoutCoords.length !== 1 ? 's' : ''} sin coordenadas no aparece${storesWithoutCoords.length !== 1 ? 'n' : ''} en el mapa.
           </div>`
        : ''}

      <div style="display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr);gap:0;height:calc(100vh - 120px);min-height:400px;">
        <div style="display:grid;grid-template-rows:auto 1fr;gap:0;border-right:1px solid var(--border);overflow:hidden;">
          <div style="padding:10px;">
            <input type="search" id="map-search" placeholder="Buscar tienda…" style="font-size:16px;width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;box-sizing:border-box;" />
          </div>
          <div class="agent-map-client-list" id="map-store-list">
            ${allStores.map((s) => renderStoreMapCard(s, false)).join('')}
          </div>
        </div>
        <div id="agent-leaflet-map" style="height:100%;min-height:400px;"></div>
      </div>
    </div>`;

  const backBtn = containerEl.querySelector('#map-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));

  // ─── Inicializar Leaflet ──────────────────────────────────────────────────

  if (!L) {
    containerEl.querySelector('#agent-leaflet-map').innerHTML =
      '<p class="muted" style="padding:24px;text-align:center;">Leaflet no disponible.</p>';
    return;
  }

  const mapEl = document.getElementById('agent-leaflet-map');
  const map   = L.map(mapEl);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Fix de tiles grises (ADR / RISK-004)
  setTimeout(() => map.invalidateSize(), 100);

  // ─── LayerGroup de marcadores ─────────────────────────────────────────────

  const markerLayer = L.layerGroup().addTo(map);
  const markerRefs  = new Map(); // storeId → leaflet marker
  let activeStoreId = null;

  function buildMarker(store) {
    const cls = `agent-map-marker ${statusToMarkerClass(store.status)}`;
    const icon = L.divIcon({ className: cls, iconSize: [24, 24] });
    const marker = L.marker([store.latitude, store.longitude], { icon });

    marker.bindPopup(buildPopupHtml(store), { maxWidth: 240 });

    marker.on('click', () => {
      setActiveStore(String(store.id), marker, false);
    });

    marker.on('popupopen', () => {
      // Bind del CTA del popup
      const popupEl = marker.getPopup().getElement();
      if (!popupEl) return;
      const cta = popupEl.querySelector('[data-map-store-id]');
      if (cta) {
        cta.addEventListener('click', () => navigate('store-detail', { storeId: store.id }));
      }
    });

    return marker;
  }

  function setActiveStore(storeId, marker, scrollToCard) {
    // Quitar selección anterior
    if (activeStoreId) {
      const prev = containerEl.querySelector(`[data-map-card-id="${activeStoreId}"]`);
      if (prev) prev.classList.remove('active');
      const prevMarker = markerRefs.get(activeStoreId);
      if (prevMarker) {
        const store = allStores.find((s) => String(s.id) === activeStoreId);
        if (store) {
          const cls = `agent-map-marker ${statusToMarkerClass(store.status)}`;
          prevMarker.setIcon(L.divIcon({ className: cls, iconSize: [24, 24] }));
        }
      }
    }

    activeStoreId = storeId;
    const card = containerEl.querySelector(`[data-map-card-id="${storeId}"]`);
    if (card) {
      card.classList.add('active');
      if (scrollToCard) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (marker) {
      marker.setIcon(L.divIcon({ className: 'agent-map-marker agent-map-marker--selected', iconSize: [30, 30] }));
      marker.openPopup();
    }
  }

  // ─── Renderizar marcadores iniciales ─────────────────────────────────────

  function renderMarkers(stores) {
    markerLayer.clearLayers();
    markerRefs.clear();

    stores.filter((s) => s.latitude != null && s.longitude != null).forEach((s) => {
      const m = buildMarker(s);
      markerLayer.addLayer(m);
      markerRefs.set(String(s.id), m);
    });
  }

  renderMarkers(allStores);

  // Fit bounds o fallback
  if (storesWithCoords.length > 1) {
    const bounds = L.latLngBounds(storesWithCoords.map((s) => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [24, 24] });
  } else if (storesWithCoords.length === 1) {
    map.setView([storesWithCoords[0].latitude, storesWithCoords[0].longitude], 14);
  } else {
    map.setView(COSTA_RICA_CENTER, DEFAULT_ZOOM);
  }

  // ─── Tap en card de lista ─────────────────────────────────────────────────

  const storeListEl = containerEl.querySelector('#map-store-list');
  if (storeListEl) {
    storeListEl.addEventListener('click', (e) => {
      const card = e.target.closest('[data-map-card-id]');
      if (!card || card.disabled) return;
      const sid = card.getAttribute('data-map-card-id');
      const store = allStores.find((s) => String(s.id) === sid);
      if (!store || store.latitude == null) return;
      const marker = markerRefs.get(sid);
      map.setView([store.latitude, store.longitude], 14);
      setActiveStore(sid, marker, false);
    });
  }

  // ─── Geolocalización opcional silenciosa ──────────────────────────────────
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const userIcon = L.divIcon({ className: 'agent-map-user-location', iconSize: [16, 16] });
      L.marker([latitude, longitude], { icon: userIcon }).addTo(map).bindTooltip('Tu ubicación');
    }, () => { /* error silencioso */ });
  }

  // ─── Filtro local de búsqueda ─────────────────────────────────────────────

  const searchInput = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#map-search'));
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      const filtered = q
        ? allStores.filter((s) => (s.name || '').toLowerCase().includes(q) || (s.clientName || '').toLowerCase().includes(q))
        : allStores;

      // Actualizar lista
      if (storeListEl) {
        storeListEl.innerHTML = filtered.length
          ? filtered.map((s) => renderStoreMapCard(s, String(s.id) === activeStoreId)).join('')
          : '<p class="muted" style="padding:16px;text-align:center;">Sin resultados.</p>';
      }

      // Actualizar layerGroup sin reinicializar el mapa
      renderMarkers(filtered);
    });
  }
}

AgentShell.register('views.map', { render });

})();
