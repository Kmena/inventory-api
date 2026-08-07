(function attachRootShellClientsAdminStoreDialog(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const L = /** @type {any} */ (globalScope).L;

  // Centro de Costa Rica — coordenadas de fallback
  const COSTA_RICA_CENTER = [9.7489, -83.7534];
  const DEFAULT_ZOOM = 8;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildDialogHtml(clientName, zoneOptions) {
    const zoneOptionMarkup = zoneOptions
      .map((opt) => `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.regionName)} / ${escapeHtml(opt.name)}</option>`)
      .join('');

    return `
      <form id="store-dialog-form" class="root-form" novalidate>
        <div class="page-header" style="margin-bottom:12px;">
          <div>
            <h3 style="margin:0;">Nueva tienda</h3>
            <p class="muted" style="margin:4px 0 0;">Cliente: ${escapeHtml(clientName)}</p>
          </div>
          <button type="button" id="store-dialog-close" class="secondary-button" aria-label="Cerrar dialog">✕</button>
        </div>

        <div id="store-dialog-message"></div>

        <fieldset class="root-form__section">
          <legend>Datos de la tienda</legend>
          <div class="root-form-grid">
            <label class="root-form-grid__full">
              <span>Nombre de tienda *</span>
              <input name="name" type="text" required minlength="2" maxlength="255" />
            </label>
            <label>
              <span>Subzona *</span>
              <select name="subregionId" required>
                <option value="">Selecciona</option>
                ${zoneOptionMarkup}
              </select>
            </label>
            <label>
              <span>Codigo</span>
              <input name="code" type="text" maxlength="50" />
            </label>
            <label>
              <span>Tipo de tienda</span>
              <input name="storeType" type="text" maxlength="100" />
            </label>
            <label>
              <span>Telefono</span>
              <input name="phone" type="text" maxlength="50" />
            </label>
            <label>
              <span>Horario de atencion</span>
              <input name="attentionSchedule" type="text" maxlength="255" />
            </label>
            <label class="root-form-grid__full">
              <span>Referencia de ubicacion</span>
              <input name="locationReference" type="text" maxlength="500" />
            </label>
            <label class="root-form-grid__full">
              <span>Direccion</span>
              <textarea name="address" rows="2" maxlength="1000"></textarea>
            </label>
          </div>
        </fieldset>

        <fieldset class="root-form__section">
          <legend>Ubicacion geografica (opcional)</legend>

          <div class="store-dialog-geocoding">
            <label class="root-form-grid__full">
              <span>Buscar direccion en el mapa</span>
              <input
                id="store-dialog-geocoding-input"
                type="search"
                placeholder="Ej: Escazu, San Jose, Costa Rica"
                autocomplete="off"
                spellcheck="false"
                maxlength="255"
              />
            </label>
            <div id="store-dialog-geocoding-dropdown" class="store-dialog-geocoding__dropdown" hidden></div>
          </div>

          <div id="store-dialog-map" class="store-dialog-map" aria-label="Mapa de ubicacion de la tienda"></div>

          <div class="root-form-grid" style="margin-top:8px;">
            <label>
              <span>Latitud</span>
              <input id="store-dialog-lat" name="latitude" type="number" step="0.000001" min="-90" max="90" inputmode="decimal" />
            </label>
            <label>
              <span>Longitud</span>
              <input id="store-dialog-lng" name="longitude" type="number" step="0.000001" min="-180" max="180" inputmode="decimal" />
            </label>
            <label>
              <span>Provincia</span>
              <input name="province" type="text" maxlength="100" />
            </label>
            <label>
              <span>Canton</span>
              <input name="canton" type="text" maxlength="100" />
            </label>
            <label>
              <span>Distrito</span>
              <input name="district" type="text" maxlength="100" />
            </label>
          </div>
        </fieldset>

        <div class="action-row" style="margin-top:16px;">
          <button type="submit" id="store-dialog-submit">Crear tienda</button>
          <button type="button" id="store-dialog-cancel" class="secondary-button">Cancelar</button>
        </div>
      </form>
    `;
  }

  function buildStorePayload(form) {
    const data = new FormData(form);
    const payload = {};

    const textFields = ['name', 'code', 'storeType', 'phone', 'address', 'locationReference', 'attentionSchedule', 'province', 'canton', 'district'];
    for (const field of textFields) {
      const value = String(data.get(field) || '').trim();
      if (value) {
        payload[field] = value;
      }
    }

    const subregionId = String(data.get('subregionId') || '').trim();
    if (subregionId) {
      payload.subregionId = Number(subregionId);
    }

    const latRaw = String(data.get('latitude') || '').trim();
    const lngRaw = String(data.get('longitude') || '').trim();
    if (latRaw) {
      payload.latitude = parseFloat(latRaw);
    }
    if (lngRaw) {
      payload.longitude = parseFloat(lngRaw);
    }

    return payload;
  }

  /**
   * Abre el dialog de creacion de tienda con mapa Leaflet.
   *
   * @param {string|number} clientId
   * @param {string} clientName
   * @param {any} session
   * @param {Array<{id:string|number, name:string, regionName:string}>} zoneOptions - lista plana de subzonas
   * @param {function(any): void} onSuccess - callback con la tienda creada
   */
  function open(clientId, clientName, session, zoneOptions, onSuccess) {
    const clientsApi = rootShell.require('clientsApi');

    // ── Crear el dialog dinámicamente (ADR-004) ──────────────────────────────
    const dialog = /** @type {HTMLDialogElement} */ (globalScope.document.createElement('dialog'));
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.className = 'modal-card store-dialog-modal';
    dialog.innerHTML = buildDialogHtml(clientName, zoneOptions);
    globalScope.document.body.appendChild(dialog);
    dialog.showModal();

    // ── Refs de UI ────────────────────────────────────────────────────────────
    const form = /** @type {HTMLFormElement} */ (dialog.querySelector('#store-dialog-form'));
    const messageEl = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-message'));
    const geocodingInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-dialog-geocoding-input'));
    const dropdown = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-geocoding-dropdown'));
    const latInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-dialog-lat'));
    const lngInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-dialog-lng'));
    const submitBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-dialog-submit'));
    const closeBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-dialog-close'));
    const cancelBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-dialog-cancel'));

    // ── Estado del mapa y debounce ────────────────────────────────────────────
    let map = null;
    let marker = null;
    let debounceId = null;

    // ── Inicializar Leaflet DESPUÉS de showModal (ADR-004, RISK-003) ──────────
    setTimeout(() => {
      if (!L) {
        return;
      }

      map = L.map('store-dialog-map').setView(COSTA_RICA_CENTER, DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.invalidateSize();

      // Marcador draggable — usa divIcon CSS para evitar dependencia de PNGs
      // (Leaflet vendoreado no incluye las imágenes marker-icon.png)
      const storePin = L.divIcon({
        className: 'store-map-pin',
        html: '<div class="store-map-pin__dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      marker = L.marker(COSTA_RICA_CENTER, { draggable: true, icon: storePin }).addTo(map);

      // Drag del pin → actualiza solo lat/lng (ADR-005)
      marker.on('dragend', () => {
        const latlng = marker.getLatLng();
        latInput.value = latlng.lat.toFixed(6);
        lngInput.value = latlng.lng.toFixed(6);
      });

      // Edicion manual de lat/lng → reposiciona el pin
      function syncMarkerFromInputs() {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return;
        }
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
      }

      latInput.addEventListener('change', syncMarkerFromInputs);
      lngInput.addEventListener('change', syncMarkerFromInputs);
    }, 50);

    // ── Cerrar dialog (FINDING-001 y FINDING-002) ────────────────────────────
    function closeDialog() {
      clearTimeout(debounceId);      // FINDING-002: cancelar debounce pendiente
      if (map) {
        map.remove();                // FINDING-001: destruir mapa antes de remove
        map = null;
      }
      dialog.close();
      dialog.remove();
    }

    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);

    // Cerrar al hacer click en el backdrop (fuera del contenido del dialog)
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        closeDialog();
      }
    });

    // ── Buscador de geocoding con debounce 400ms (ADR-003) ───────────────────
    function renderDropdown(results) {
      if (!Array.isArray(results) || !results.length) {
        dropdown.innerHTML = '<div class="store-dialog-geocoding__item store-dialog-geocoding__item--empty">Sin resultados para esta busqueda</div>';
        dropdown.hidden = false;
        return;
      }

      dropdown.innerHTML = results
        .slice(0, 6)
        .map((result, idx) => `
          <button
            type="button"
            class="store-dialog-geocoding__item"
            data-lat="${escapeHtml(String(result.latitude ?? ''))}"
            data-lng="${escapeHtml(String(result.longitude ?? ''))}"
            data-idx="${idx}"
          >${escapeHtml(result.name || 'Resultado sin nombre')}</button>
        `)
        .join('');
      dropdown.hidden = false;
    }

    geocodingInput.addEventListener('input', () => {
      clearTimeout(debounceId);
      const query = geocodingInput.value.trim();

      if (query.length < 3) {
        dropdown.innerHTML = '';
        dropdown.hidden = true;
        return;
      }

      debounceId = setTimeout(async () => {
        dropdown.innerHTML = '<div class="store-dialog-geocoding__item store-dialog-geocoding__item--loading">Buscando...</div>';
        dropdown.hidden = false;

        try {
          const results = await clientsApi.searchPlaces(session, query);
          renderDropdown(results);
        } catch (_err) {
          dropdown.innerHTML = '<div class="store-dialog-geocoding__item store-dialog-geocoding__item--empty">No se pudo consultar el buscador de mapas</div>';
          dropdown.hidden = false;
        }
      }, 400);
    });

    // Seleccionar resultado del dropdown → auto-rellenar lat/lng y mover mapa
    dropdown.addEventListener('click', (event) => {
      const item = /** @type {HTMLElement} */ (event.target instanceof globalScope.HTMLElement ? event.target.closest('[data-lat]') : null);
      if (!item) {
        return;
      }

      const lat = parseFloat(item.getAttribute('data-lat') || '');
      const lng = parseFloat(item.getAttribute('data-lng') || '');

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);

      if (map && marker) {
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], 15);
      }

      dropdown.hidden = true;
    });

    // Cerrar dropdown al hacer click fuera
    globalScope.document.addEventListener('click', function onClickOutside(event) {
      if (!dropdown.contains(/** @type {Node} */ (event.target)) && event.target !== geocodingInput) {
        dropdown.hidden = true;
        globalScope.document.removeEventListener('click', onClickOutside);
      }
    });

    // ── Submit del formulario ────────────────────────────────────────────────
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      messageEl.innerHTML = '';

      if (!form.reportValidity()) {
        messageEl.innerHTML = '<div class="inline-message inline-message--error">Revisa los campos obligatorios antes de continuar.</div>';
        return;
      }

      const payload = buildStorePayload(form);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando...';

      try {
        const createdStore = await clientsApi.createStore(session, clientId, payload);
        closeDialog();
        if (typeof onSuccess === 'function') {
          onSuccess(createdStore);
        }
      } catch (err) {
        const message = err?.message || 'No se pudo crear la tienda.';
        messageEl.innerHTML = `<div class="inline-message inline-message--error">${escapeHtml(message)}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear tienda';
      }
    });
  }

  rootShell.register('views.clientsAdminStoreDialog', { open });
}(window));
