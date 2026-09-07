(function attachRootShellClientsAdminStoreDialog(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const clientsAdminHelpers = rootShell.require('views.clientsAdminHelpers');
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

  function renderZoneOptionsMarkup(zoneOptions) {
    return (Array.isArray(zoneOptions) ? zoneOptions : [])
      .map((opt) => `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.regionName)} / ${escapeHtml(opt.name)}</option>`)
      .join('');
  }

  function renderClientFiscalSummary(clientFiscalProfile) {
    return `
      <div class="inline-card">
        <strong id="store-dialog-billing-inherit-title" tabindex="-1">Facturación heredada del cliente</strong>
        <p class="muted" style="margin:6px 0 10px;">Esta tienda usará los datos fiscales del cliente para la facturación.</p>
        <p class="muted" style="margin:4px 0;"><strong>Razón social:</strong> ${escapeHtml(clientFiscalProfile?.legalName || clientFiscalProfile?.name || 'No registrado')}</p>
        <p class="muted" style="margin:4px 0;"><strong>Nombre comercial:</strong> ${escapeHtml(clientFiscalProfile?.commercialName || 'No registrado')}</p>
        <p class="muted" style="margin:4px 0;"><strong>Identificación:</strong> ${escapeHtml(clientFiscalProfile?.documentType || 'No registrado')} · ${escapeHtml(clientFiscalProfile?.legalId || 'No registrado')}</p>
        <p class="muted" style="margin:4px 0;"><strong>Correo de facturación:</strong> ${escapeHtml(clientFiscalProfile?.emailBilling || 'No registrado')}</p>
        <p class="muted" style="margin:4px 0;"><strong>Actividad económica:</strong> ${escapeHtml(clientFiscalProfile?.economicActivityCode || 'No registrada')}${clientFiscalProfile?.economicActivityName ? ` · ${escapeHtml(clientFiscalProfile.economicActivityName)}` : ''}</p>
        <p class="muted" style="margin:10px 0 0;">Si esta tienda necesita facturar con datos distintos, selecciona “Usar datos fiscales propios de esta tienda”.</p>
      </div>
    `;
  }

  function buildDialogHtml(clientName, zoneOptions, clientFiscalProfile) {
    const hasZoneOptions = Array.isArray(zoneOptions) && zoneOptions.length > 0;
    const zoneOptionMarkup = renderZoneOptionsMarkup(zoneOptions);

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

        <section id="store-dialog-zone-guidance" class="inline-card" ${hasZoneOptions ? 'hidden' : ''}>
          <div tabindex="-1" id="store-dialog-zone-guidance-title" style="font-weight:700;font-size:1rem;margin-bottom:8px;">Necesitas configurar zonas antes de crear una tienda</div>
          <p class="muted" style="margin:0 0 12px;">Cada tienda debe estar asociada a una subzona válida. Si todavía no existen zonas o subzonas, créalas en el módulo de Zonas y luego vuelve aquí para refrescarlas.</p>
          <div class="action-row compact-action-row">
            <button type="button" data-action="open-zones">Ir a Zonas</button>
            <button type="button" data-action="refresh-zones" class="secondary-button">Refrescar zonas</button>
          </div>
          <div id="store-dialog-zone-guidance-status" aria-live="polite" style="margin-top:12px;"></div>
        </section>

        <fieldset id="store-dialog-main-fieldset" class="root-form__section" ${hasZoneOptions ? '' : 'hidden'}>
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
              <div class="action-row compact-action-row" style="margin-top:8px;justify-content:flex-start;">
                <button type="button" data-action="refresh-zones" class="secondary-button">Refrescar zonas</button>
              </div>
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
            <label>
              <span>Moneda de crédito *</span>
              <select name="currency" required aria-describedby="store-dialog-currency-help">
                <option value="">Selecciona moneda</option>
                <option value="CRC">CRC — Colón</option>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
              <small id="store-dialog-currency-help" class="muted">Esta moneda se usará para límite, usado y disponible.</small>
            </label>
            <label>
              <span>Límite de crédito</span>
              <input name="creditLimit" type="number" min="0" step="0.01" inputmode="decimal" aria-describedby="store-dialog-credit-limit-help" />
              <small id="store-dialog-credit-limit-help" class="muted">Déjalo vacío si la tienda no tendrá crédito inicial.</small>
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

        <fieldset id="store-dialog-billing-fieldset" class="root-form__section" ${hasZoneOptions ? '' : 'hidden'}>
          <legend>Datos de facturación</legend>
          <div class="root-form-grid">
            <fieldset class="root-form-grid__full" style="border:0;padding:0;margin:0;">
              <legend style="font-weight:700;font-size:0.9rem;margin-bottom:8px;">Datos de facturación</legend>
              <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
                <input type="radio" name="billingMode" value="inherit" checked />
                <span>Usar datos fiscales del cliente</span>
              </label>
              <label style="display:flex;gap:8px;align-items:flex-start;">
                <input type="radio" name="billingMode" value="override" />
                <span>Usar datos fiscales propios de esta tienda</span>
              </label>
            </fieldset>

            <div id="store-dialog-billing-inherit-summary" class="root-form-grid__full" aria-live="polite">
              ${renderClientFiscalSummary(clientFiscalProfile)}
            </div>

            <div id="store-dialog-billing-override-fields" class="root-form-grid__full" hidden>
              <div class="root-form-grid">
                <label><span>Razón social *</span><input name="legalName" type="text" maxlength="255" /></label>
                <label><span>Nombre comercial</span><input name="commercialName" type="text" maxlength="255" /></label>
                <label><span>Tipo de identificación *</span><input name="documentType" type="text" maxlength="50" /></label>
                <label><span>Número de identificación *</span><input name="legalId" type="text" maxlength="100" /></label>
                <div class="root-form-grid__full" style="display:flex;gap:8px;align-items:flex-end;">
                  <button type="button" id="store-dialog-billing-lookup-btn" class="secondary-button" hidden>Consultar Hacienda</button>
                  <div id="store-dialog-billing-lookup-msg" aria-live="polite" style="flex:1;"></div>
                </div>
                <label class="root-form-grid__full"><span>Correo de facturación</span><input name="emailBilling" type="email" maxlength="255" /></label>
                <label><span>Código de actividad económica</span><input name="economicActivityCode" type="text" maxlength="20" /></label>
                <label><span>Nombre de actividad económica</span><input name="economicActivityName" type="text" maxlength="255" /></label>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset id="store-dialog-map-fieldset" class="root-form__section" ${hasZoneOptions ? '' : 'hidden'}>
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

          <p style="font-size:0.78rem;color:#64748b;margin:4px 0 6px;">💡 Hacé clic en el mapa o arrastrá el punto azul para posicionar la tienda.</p>

          <div id="store-dialog-map" class="store-dialog-map" aria-label="Mapa de ubicacion de la tienda"></div>

          <p id="store-dialog-reverse-status" class="store-dialog-reverse-status" hidden></p>

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

        <div id="store-dialog-action-row" class="action-row" style="margin-top:16px;">
          <button type="submit" id="store-dialog-submit" ${hasZoneOptions ? '' : 'hidden'}>Crear tienda</button>
          <button type="button" id="store-dialog-cancel" class="secondary-button">Cancelar</button>
        </div>
      </form>
    `;
  }

  /**
   * Abre el dialog de creacion de tienda con mapa Leaflet.
   *
   * @param {string|number} clientId
   * @param {string} clientName
   * @param {any} session
   * @param {Array<{id:string|number, name:string, regionName:string}>} zoneOptions - lista plana de subzonas
   * @param {function(any): void} onSuccess - callback con la tienda creada
   * @param {function(): Promise<Array<{id:string|number, name:string, regionName:string}>>} [refreshZones]
   * @param {any} [clientFiscalProfile]
   * @param {Array<{value:string,label:string}>} [documentTypeOptions]
   * @param {boolean} [canLookupTaxpayer]
   */
  function open(clientId, clientName, session, zoneOptions, onSuccess, refreshZones, clientFiscalProfile, documentTypeOptions, canLookupTaxpayer) {
    const clientsApi = rootShell.require('clientsApi');

    // ── Crear el dialog dinámicamente (ADR-004) ──────────────────────────────
    const dialog = /** @type {HTMLDialogElement} */ (globalScope.document.createElement('dialog'));
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.className = 'modal-card store-dialog-modal';
    dialog.innerHTML = buildDialogHtml(clientName, zoneOptions, clientFiscalProfile);
    globalScope.document.body.appendChild(dialog);
    dialog.showModal();

    // ── Refs de UI ────────────────────────────────────────────────────────────
    const form = /** @type {HTMLFormElement} */ (dialog.querySelector('#store-dialog-form'));
    const messageEl = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-message'));
    const guidanceSection = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-zone-guidance'));
    const guidanceTitle = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-zone-guidance-title'));
    const guidanceStatus = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-zone-guidance-status'));
    const mainFieldset = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-main-fieldset'));
    const billingFieldset = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-billing-fieldset'));
    const billingInheritSummary = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-billing-inherit-summary'));
    const billingOverrideFields = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-billing-override-fields'));
    const billingModeInputs = Array.from(dialog.querySelectorAll('input[name="billingMode"]'));
    const mapFieldset = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-map-fieldset'));
    const subregionSelect = /** @type {HTMLSelectElement} */ (dialog.querySelector('select[name="subregionId"]'));
    const geocodingInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-dialog-geocoding-input'));
    const dropdown = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-geocoding-dropdown'));
    const latInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-dialog-lat'));
    const lngInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-dialog-lng'));
    const submitBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-dialog-submit'));
    const closeBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-dialog-close'));
    const cancelBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-dialog-cancel'));
    const refreshZoneButtons = Array.from(dialog.querySelectorAll('[data-action="refresh-zones"]'));
    const openZonesButtons = Array.from(dialog.querySelectorAll('[data-action="open-zones"]'));

    // ── Hacienda lookup en billing override — blur automático + botón (FR-027, AC-019) ──
    const MIN_CEDULA_LENGTH = 9;
    const billingLookupBtn = /** @type {HTMLButtonElement | null} */ (dialog.querySelector('#store-dialog-billing-lookup-btn'));
    const billingLookupMsg = /** @type {HTMLElement | null} */ (dialog.querySelector('#store-dialog-billing-lookup-msg'));
    const billingLegalIdInput = /** @type {HTMLInputElement | null} */ (billingOverrideFields.querySelector('input[name="legalId"]'));
    let billingLookupDone = false;
    let isBillingLookupInProgress = false;

    if (billingLookupBtn && canLookupTaxpayer) {
      billingLookupBtn.hidden = false;
      billingLookupBtn.disabled = true; // se habilita cuando la cédula alcanza la longitud mínima
    }

    async function triggerBillingLookup() {
      if (!billingLookupBtn || !billingLookupMsg || isBillingLookupInProgress) return;
      const legalId = billingLegalIdInput?.value?.trim();
      if (String(legalId || '').length < MIN_CEDULA_LENGTH || billingLookupDone) return;
      isBillingLookupInProgress = true;
      billingLookupBtn.disabled = true;
      billingLookupBtn.textContent = 'Consultando...';
      billingLookupMsg.innerHTML = '';
      try {
        const taxpayer = await clientsApi.lookupTaxpayer(session, legalId);
        const legalNameInput = /** @type {HTMLInputElement | null} */ (billingOverrideFields.querySelector('input[name="legalName"]'));
        if (legalNameInput && taxpayer?.name) legalNameInput.value = taxpayer.name;
        billingLookupDone = true;
        billingLookupMsg.innerHTML = '<div class="inline-message">Datos de Hacienda cargados.</div>';
      } catch (error) {
        const status = error?.statusCode;
        const msg = status === 404
          ? 'No se encontró la identificación en Hacienda.'
          : status === 429
            ? 'Consultas temporalmente limitadas. Intenta de nuevo.'
            : 'Hacienda no disponible.';
        billingLookupMsg.innerHTML = `<div class="inline-message inline-message--warning">${escapeHtml(msg)}</div>`;
      } finally {
        isBillingLookupInProgress = false;
        billingLookupBtn.textContent = 'Consultar Hacienda';
        billingLookupBtn.disabled = billingLookupDone || String(billingLegalIdInput?.value || '').trim().length < MIN_CEDULA_LENGTH;
      }
    }

    if (billingLookupBtn && canLookupTaxpayer && billingLegalIdInput) {
      billingLegalIdInput.addEventListener('input', () => {
        billingLookupDone = false;
        billingLookupBtn.disabled = String(billingLegalIdInput.value || '').trim().length < MIN_CEDULA_LENGTH;
      });
      billingLegalIdInput.addEventListener('change', () => triggerBillingLookup());
      billingLegalIdInput.addEventListener('focusout', () => triggerBillingLookup());
      billingLegalIdInput.addEventListener('blur', () => triggerBillingLookup());
      billingLegalIdInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        triggerBillingLookup();
      });
      billingLookupBtn.addEventListener('click', triggerBillingLookup);
    }

    // ── Estado del mapa y debounce ────────────────────────────────────────────
    let map = null;
    let marker = null;
    let debounceId = null;
    let reverseDebounceId = null;

    // Refs de los campos de dirección para el autorrelleno
    const provinceInput          = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="province"]'));
    const cantonInput            = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="canton"]'));
    const districtInput          = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="district"]'));
    const locationReferenceInput = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="locationReference"]'));
    const reverseStatus          = /** @type {HTMLElement} */ (dialog.querySelector('#store-dialog-reverse-status'));

    // ── Geocodificación inversa: coordenadas → provincia/cantón/distrito ──────
    async function fillAddressFromCoords(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      if (reverseStatus) {
        reverseStatus.textContent = 'Buscando dirección…';
        reverseStatus.hidden = false;
      }
      try {
        const result = await clientsApi.reverseGeocode(session, lat, lng);
        if (result?.province && provinceInput && !provinceInput.value) {
          provinceInput.value = result.province;
        }
        if (result?.canton && cantonInput && !cantonInput.value) {
          cantonInput.value = result.canton;
        }
        if (result?.district && districtInput && !districtInput.value) {
          districtInput.value = result.district;
        }
        if (result?.displayName && locationReferenceInput && !locationReferenceInput.value) {
          locationReferenceInput.value = result.displayName;
        }
        if (reverseStatus) {
          reverseStatus.textContent = result?.displayName ? `📍 ${result.displayName}` : '';
          reverseStatus.hidden = !result?.displayName;
        }
      } catch (_err) {
        if (reverseStatus) {
          reverseStatus.textContent = '';
          reverseStatus.hidden = true;
        }
      }
    }

    // Mueve el marcador a las coordenadas dadas, actualiza inputs y lanza geocodificación inversa
    function placeMarkerAt(lat, lng) {
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);
      if (marker) {
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
      }
      // Debounce para no lanzar una petición por cada pequeño movimiento de drag
      clearTimeout(reverseDebounceId);
      reverseDebounceId = setTimeout(() => fillAddressFromCoords(lat, lng), 600);
    }

    function toggleBillingMode(nextBillingMode) {
      const isOverrideMode = nextBillingMode === 'override';
      billingInheritSummary.hidden = isOverrideMode;
      billingOverrideFields.hidden = !isOverrideMode;
      // Al volver a modo inherit, resetear el flag para que una futura re-apertura de override pueda consultar
      if (!isOverrideMode) {
        billingLookupDone = false;
        if (billingLookupBtn) billingLookupBtn.disabled = true;
        if (billingLookupMsg) billingLookupMsg.innerHTML = '';
      }

      const requiredOverrideFieldNames = ['legalName', 'documentType', 'legalId'];
      for (const fieldName of requiredOverrideFieldNames) {
        const field = /** @type {HTMLInputElement | null} */ (dialog.querySelector(`[name="${fieldName}"]`));
        if (field) {
          field.required = isOverrideMode;
        }
      }

      if (isOverrideMode) {
        const legalNameInput = /** @type {HTMLInputElement | null} */ (dialog.querySelector('input[name="legalName"]'));
        legalNameInput?.focus();
        return;
      }

      const inheritTitle = /** @type {HTMLElement | null} */ (dialog.querySelector('#store-dialog-billing-inherit-title'));
      inheritTitle?.focus?.();
    }

    function ensureMapInitialized() {
      if (map || !L || mainFieldset.hidden) {
        return;
      }

      setTimeout(() => {
        if (map || !L || mainFieldset.hidden) {
          return;
        }

        map = L.map('store-dialog-map').setView(COSTA_RICA_CENTER, DEFAULT_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        map.invalidateSize();

        const storePin = L.divIcon({
          className: 'store-map-pin',
          html: '<div class="store-map-pin__dot"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        marker = L.marker(COSTA_RICA_CENTER, { draggable: true, icon: storePin }).addTo(map);

        map.on('click', (e) => {
          placeMarkerAt(e.latlng.lat, e.latlng.lng);
        });

        marker.on('dragend', () => {
          const latlng = marker.getLatLng();
          placeMarkerAt(latlng.lat, latlng.lng);
        });

        function syncMarkerFromInputs() {
          const lat = parseFloat(latInput.value);
          const lng = parseFloat(lngInput.value);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
          }
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return;
          }
          placeMarkerAt(lat, lng);
        }

        latInput.addEventListener('change', syncMarkerFromInputs);
        lngInput.addEventListener('change', syncMarkerFromInputs);
      }, 50);
    }

    function updateZoneAvailability(nextZoneOptions) {
      const hasZoneOptions = Array.isArray(nextZoneOptions) && nextZoneOptions.length > 0;
      subregionSelect.innerHTML = `<option value="">Selecciona</option>${renderZoneOptionsMarkup(nextZoneOptions)}`;
      guidanceSection.hidden = hasZoneOptions;
      mainFieldset.hidden = !hasZoneOptions;
      billingFieldset.hidden = !hasZoneOptions;
      mapFieldset.hidden = !hasZoneOptions;
      submitBtn.hidden = !hasZoneOptions;

      if (hasZoneOptions) {
        guidanceStatus.innerHTML = '';
        ensureMapInitialized();
        const storeNameInput = /** @type {HTMLInputElement | null} */ (dialog.querySelector('input[name="name"]'));
        storeNameInput?.focus();
        return;
      }

      guidanceTitle.focus();
    }

    ensureMapInitialized();

    // ── Cerrar dialog (FINDING-001 y FINDING-002) ────────────────────────────
    function closeDialog() {
      clearTimeout(debounceId);         // FINDING-002: cancelar debounce de geocoding búsqueda
      clearTimeout(reverseDebounceId);  // cancelar debounce de geocoding inversa
      if (map) {
        map.remove();                // FINDING-001: destruir mapa antes de remove
        map = null;
      }
      dialog.close();
      dialog.remove();
    }

    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);

    if (guidanceSection && !guidanceSection.hidden) {
      guidanceTitle.focus();
    }

    toggleBillingMode('inherit');
    for (const billingModeInput of billingModeInputs) {
      billingModeInput.addEventListener('change', () => {
        if (billingModeInput.checked) {
          toggleBillingMode(billingModeInput.value);
        }
      });
    }

    for (const openZonesButton of openZonesButtons) {
      openZonesButton.addEventListener('click', () => {
        const openedWindow = typeof globalScope.open === 'function'
          ? globalScope.open('#zones', '_blank', 'noopener')
          : null;
        if (!openedWindow && globalScope.location) {
          globalScope.location.hash = '#zones';
        }
      });
    }

    for (const refreshZoneButton of refreshZoneButtons) {
      refreshZoneButton.addEventListener('click', async () => {
        if (typeof refreshZones !== 'function') {
          guidanceStatus.innerHTML = `<div class="inline-message inline-message--warning">Refrescar zonas no está disponible en este momento.</div>`;
          return;
        }

        guidanceStatus.innerHTML = '<div class="inline-message">Refrescando zonas...</div>';
        refreshZoneButton.disabled = true;
        refreshZoneButton.textContent = 'Refrescando...';

        try {
          zoneOptions = await refreshZones();
          updateZoneAvailability(zoneOptions);
          if (!Array.isArray(zoneOptions) || !zoneOptions.length) {
            guidanceStatus.innerHTML = '<div class="inline-message inline-message--warning">Aún no hay zonas configuradas.</div>';
          }
        } catch (error) {
          guidanceStatus.innerHTML = `<div class="inline-message inline-message--error">${escapeHtml(error?.message || 'No se pudieron refrescar las zonas.')}</div>`;
          guidanceTitle.focus();
        } finally {
          refreshZoneButton.disabled = false;
          refreshZoneButton.textContent = 'Refrescar zonas';
        }
      });
    }

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

      const payload = clientsAdminHelpers.buildStorePayload(new globalScope.FormData(form));

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando...';

      try {
        const createdStore = await clientsApi.createStore(session, clientId, payload);

        // Notify the parent view immediately so the new store appears in the list
        if (typeof onSuccess === 'function') {
          onSuccess(createdStore);
        }

        // Phase 2: optional store-document upload within the same dialog
        const phaseDocTypes = Array.isArray(documentTypeOptions) && documentTypeOptions.length
          ? documentTypeOptions
          : [];
        enterPhase2(dialog, clientId, createdStore.id ?? createdStore.id, session, phaseDocTypes, () => {});
      } catch (err) {
        const message = err?.message || 'No se pudo crear la tienda.';
        messageEl.innerHTML = `<div class="inline-message inline-message--error">${escapeHtml(message)}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear tienda';
      }
    });
  }

  // ── Phase 2: store document upload ──────────────────────────────────────

  /**
   * Renders the Phase 2 (optional document upload) markup inside the dialog.
   *
   * @param {Array<{value:string,label:string}>} documentTypeOptions
   * @returns {string}
   */
  function buildPhase2Html(documentTypeOptions) {
    const optionsMarkup = documentTypeOptions
      .map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
      .join('');

    return `
      <div class="page-header" style="margin-bottom:12px;">
        <div>
          <h3 style="margin:0;">Documentos de la tienda</h3>
          <p class="muted" style="margin:4px 0 0;">Adjunta documentos para análisis de crédito (opcional).</p>
        </div>
        <button type="button" id="store-phase2-close" class="secondary-button" aria-label="Cerrar dialog">✕</button>
      </div>

      <div id="store-phase2-message" aria-live="polite" style="margin-bottom:8px;"></div>

      <form id="store-phase2-form" class="root-form" novalidate>
        <div class="root-form-grid">
          <label>
            <span>Tipo de documento *</span>
            <select name="documentType" required>
              <option value="">Selecciona tipo</option>
              ${optionsMarkup}
            </select>
          </label>
          <label class="root-form-grid__full">
            <span>Archivo (PDF, imagen, Word — máx. 5 MB) *</span>
            <input type="file" id="store-phase2-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" required />
            <input type="hidden" name="fileName" />
            <input type="hidden" name="mimeType" />
            <input type="hidden" name="fileContentBase64" />
          </label>
          <label class="root-form-grid__full">
            <span>Notas</span>
            <input type="text" name="notes" maxlength="1000" />
          </label>
        </div>
        <div class="action-row" style="margin-top:12px;">
          <button type="submit" id="store-phase2-upload-btn">Adjuntar documento</button>
        </div>
      </form>

      <div id="store-phase2-doc-list" style="margin-top:12px;"></div>

      <div class="action-row" style="margin-top:16px;">
        <button type="button" id="store-phase2-finish" class="secondary-button">Finalizar</button>
      </div>
    `;
  }

  /**
   * Transitions the dialog content to Phase 2 (document upload).
   *
   * @param {HTMLDialogElement} dialog
   * @param {string|number} clientId
   * @param {string|number} storeId
   * @param {any} session
   * @param {Array<{value:string,label:string}>} documentTypeOptions
   * @param {Function} onClose - called when the dialog is dismissed after Phase 2
   */
  function enterPhase2(dialog, clientId, storeId, session, documentTypeOptions, onClose) {
    const clientsApi = rootShell.require('clientsApi');
    const clientsAdminHelpersRef = rootShell.require('views.clientsAdminHelpers');

    dialog.innerHTML = buildPhase2Html(documentTypeOptions);

    const messageEl = /** @type {HTMLElement} */ (dialog.querySelector('#store-phase2-message'));
    const form = /** @type {HTMLFormElement} */ (dialog.querySelector('#store-phase2-form'));
    const fileInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#store-phase2-file-input'));
    const fileNameInput = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="fileName"]'));
    const mimeTypeInput = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="mimeType"]'));
    const base64Input = /** @type {HTMLInputElement} */ (dialog.querySelector('input[name="fileContentBase64"]'));
    const uploadBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-phase2-upload-btn'));
    const docList = /** @type {HTMLElement} */ (dialog.querySelector('#store-phase2-doc-list'));
    const finishBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-phase2-finish'));
    const closeBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('#store-phase2-close'));

    const uploadedDocs = /** @type {Array<{fileName:string}>} */ ([]);

    function renderDocList() {
      if (!uploadedDocs.length) {
        docList.innerHTML = '';
        return;
      }
      docList.innerHTML = `
        <p class="muted" style="margin:0 0 6px;font-weight:600;">Documentos adjuntados:</p>
        <ul style="margin:0;padding-left:18px;">
          ${uploadedDocs.map((d) => `<li>${escapeHtml(d.fileName)}</li>`).join('')}
        </ul>
      `;
    }

    function closePhaseDone() {
      dialog.close();
      dialog.remove();
      if (typeof onClose === 'function') {
        onClose();
      }
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        messageEl.innerHTML = '<div class="inline-message inline-message--error">El archivo supera el límite de 5 MB.</div>';
        fileInput.value = '';
        fileNameInput.value = '';
        mimeTypeInput.value = '';
        base64Input.value = '';
        return;
      }
      messageEl.innerHTML = '';
      fileNameInput.value = file.name;
      mimeTypeInput.value = file.type || 'application/octet-stream';
      const reader = new globalScope.FileReader();
      reader.onload = (evt) => {
        const dataUrl = /** @type {string} */ (evt.target?.result || '');
        const base64 = dataUrl.split(',')[1] || '';
        base64Input.value = base64;
      };
      reader.onerror = () => {
        messageEl.innerHTML = '<div class="inline-message inline-message--error">No se pudo leer el archivo seleccionado.</div>';
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) {
        return;
      }
      if (!base64Input.value) {
        messageEl.innerHTML = '<div class="inline-message inline-message--error">Selecciona un archivo antes de adjuntar.</div>';
        return;
      }

      const formData = new globalScope.FormData(form);
      const payload = clientsAdminHelpersRef.buildDocumentPayload(formData);

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Subiendo...';
      messageEl.innerHTML = '';

      try {
        const doc = await clientsApi.uploadStoreDocument(session, clientId, storeId, payload);
        uploadedDocs.push({ fileName: doc?.fileName || fileNameInput.value });
        renderDocList();
        form.reset();
        fileNameInput.value = '';
        mimeTypeInput.value = '';
        base64Input.value = '';
        messageEl.innerHTML = '<div class="inline-message inline-message--success">Documento adjuntado correctamente.</div>';
      } catch (err) {
        messageEl.innerHTML = `<div class="inline-message inline-message--error">${escapeHtml(err?.message || 'No se pudo subir el documento.')}</div>`;
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Adjuntar documento';
      }
    });

    finishBtn.addEventListener('click', closePhaseDone);
    closeBtn.addEventListener('click', closePhaseDone);
  }

  rootShell.register('views.clientsAdminStoreDialog', { open });
}(window));
