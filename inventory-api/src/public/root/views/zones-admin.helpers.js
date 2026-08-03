(function attachRootShellZonesAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function render(session) {
    const companyId = rootShellUi.escapeHtml(session?.user?.companyId || 'sin empresa');

    return `
      <section class="root-hero zones-page" aria-labelledby="root-view-title">
        <div class="zones-page__header">
          <div>
            <p class="eyebrow">Operacion</p>
            <h2 id="root-view-title">Zonas y subzonas</h2>
            <p class="muted">Organiza la cobertura territorial utilizada para asignar rutas, agentes y clientes dentro de la empresa ${companyId}.</p>
          </div>
          <div class="zones-page__actions">
            <button id="zones-refresh-button" class="secondary-button" type="button">Actualizar</button>
            <button id="zones-open-zone-dialog-button" type="button">+ Nueva zona</button>
          </div>
        </div>

        <div id="zones-toast-region" class="zones-toast-region" aria-live="polite" aria-atomic="true"></div>
        <div id="zones-page-message"></div>

        <section class="zones-page__metrics" aria-label="Resumen de zonas">
          <article class="zones-metric">
            <span class="zones-metric__label">Zonas registradas</span>
            <strong id="zones-total-count" class="zones-metric__value">--</strong>
          </article>
          <article class="zones-metric">
            <span class="zones-metric__label">Subzonas registradas</span>
            <strong id="zones-subregion-count" class="zones-metric__value">--</strong>
          </article>
        </section>

        <div id="zones-layout" class="zones-page__layout zones-page--mobile-list">
          <article class="card root-card zones-list" aria-labelledby="zones-list-title">
            <div class="page-header zones-list__header">
              <div>
                <h3 id="zones-list-title">Zonas</h3>
                <p id="zones-list-summary" class="muted">Consulta y filtra las zonas registradas de la empresa.</p>
              </div>
            </div>
            <label class="zones-search-field" for="zones-search-input">
              <span>Buscar zona</span>
              <input id="zones-search-input" type="search" placeholder="Buscar por nombre o código" autocomplete="off" />
            </label>
            <div id="zones-list-region" class="zones-list__items" aria-live="polite"></div>
          </article>

          <article class="card root-card zones-detail" aria-labelledby="zones-detail-title">
            <div class="zones-detail__mobile-back">
              <button id="zones-mobile-back-button" class="secondary-button" type="button">← Volver a zonas</button>
            </div>
            <div id="zones-detail-region" aria-live="polite"></div>
          </article>
        </div>
      </section>

      <div id="zones-zone-dialog" class="modal-backdrop hidden" hidden>
        <section class="modal-card zones-dialog" role="dialog" aria-modal="true" aria-labelledby="zones-zone-dialog-title">
          <div class="page-header zones-dialog__header">
            <div>
              <h3 id="zones-zone-dialog-title">Nueva zona</h3>
              <p class="muted">Registra una zona base para organizar la cobertura territorial.</p>
            </div>
            <button id="zones-close-zone-dialog-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="zones-zone-form-message"></div>
          <form id="zones-zone-form" class="root-form zones-form" novalidate>
            <div class="root-form-grid">
              <label class="root-form-grid__full">
                <span>Nombre de la zona *</span>
                <input id="zones-zone-name" name="name" type="text" maxlength="120" autocomplete="off" />
                <small id="zones-zone-name-error" class="zones-form__error" aria-live="polite"></small>
              </label>
              <label class="root-form-grid__full">
                <span>Codigo de ruta</span>
                <input id="zones-zone-route-code" name="routeCode" type="text" maxlength="50" autocomplete="off" />
                <small id="zones-zone-route-code-error" class="zones-form__error" aria-live="polite"></small>
              </label>
            </div>
            <div class="action-row zones-dialog__footer">
              <button id="zones-zone-submit-button" type="submit">Guardar zona</button>
              <button id="zones-zone-cancel-button" class="secondary-button" type="button">Cancelar</button>
            </div>
          </form>
        </section>
      </div>

      <div id="zones-subzone-dialog" class="modal-backdrop hidden" hidden>
        <section class="modal-card zones-dialog" role="dialog" aria-modal="true" aria-labelledby="zones-subzone-dialog-title">
          <div class="page-header zones-dialog__header">
            <div>
              <h3 id="zones-subzone-dialog-title">Nueva subzona</h3>
              <p class="muted">Agrega una subzona dentro de la zona seleccionada.</p>
            </div>
            <button id="zones-close-subzone-dialog-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div class="zones-form__context">
            <span class="muted">Zona seleccionada</span>
            <strong id="zones-subzone-parent-label">Selecciona una zona para continuar.</strong>
          </div>
          <div id="zones-subzone-form-message"></div>
          <form id="zones-subzone-form" class="root-form zones-form" novalidate>
            <div class="root-form-grid">
              <label class="root-form-grid__full">
                <span>Nombre de la subzona *</span>
                <input id="zones-subzone-name" name="name" type="text" maxlength="120" autocomplete="off" />
                <small id="zones-subzone-name-error" class="zones-form__error" aria-live="polite"></small>
              </label>
              <label class="root-form-grid__full">
                <span>Codigo de ruta</span>
                <input id="zones-subzone-route-code" name="routeCode" type="text" maxlength="50" autocomplete="off" />
                <small id="zones-subzone-route-code-error" class="zones-form__error" aria-live="polite"></small>
              </label>
            </div>
            <div class="action-row zones-dialog__footer">
              <button id="zones-subzone-submit-button" type="submit">Guardar subzona</button>
              <button id="zones-subzone-cancel-button" class="secondary-button" type="button">Cancelar</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeSearchTerm(value) {
    return normalizeText(value).toLowerCase();
  }

  function buildPayload(formData) {
    const name = normalizeText(formData.get('name'));
    const routeCode = normalizeText(formData.get('routeCode'));

    return {
      name,
      routeCode: routeCode || undefined,
    };
  }

  function matchesSearch(searchTerm, ...values) {
    if (!searchTerm) {
      return true;
    }

    return values.some((value) => normalizeSearchTerm(value).includes(searchTerm));
  }

  function getFilteredZones(zones, searchTerm) {
    return zones.filter((zone) => matchesSearch(searchTerm, zone.name, zone.routeCode));
  }

  function getSelectedZone(zones, selectedZoneId, searchTerm) {
    const filteredZones = getFilteredZones(zones, searchTerm);
    return filteredZones.find((zone) => String(zone.id) === String(selectedZoneId)) || filteredZones[0] || null;
  }

  function getFilteredSubregions(selectedZone, searchTerm) {
    const subregions = Array.isArray(selectedZone?.subregions) ? selectedZone.subregions : [];
    return subregions.filter((subregion) => matchesSearch(searchTerm, subregion.name, subregion.routeCode));
  }

  function countSubregions(zones) {
    return zones.reduce((total, zone) => total + (Array.isArray(zone.subregions) ? zone.subregions.length : 0), 0);
  }

  function renderToast(message) {
    if (!message) {
      return '';
    }

    return `<p class="zones-toast" role="status">${rootShellUi.escapeHtml(message)}</p>`;
  }

  function renderLoadErrorState(message) {
    return `
      <div class="zones-state zones-state--error">
        <p>${rootShellUi.escapeHtml(message)}</p>
        <button id="zones-inline-retry-button" class="secondary-button" type="button">Reintentar</button>
      </div>
    `;
  }

  function renderZoneListItem(zone, isSelected) {
    const subregionsCount = Array.isArray(zone.subregions) ? zone.subregions.length : 0;
    const routeCode = zone.routeCode ? rootShellUi.escapeHtml(zone.routeCode) : 'Sin codigo';

    return `
      <button class="zones-list__item ${isSelected ? 'zones-list__item--selected' : ''}" type="button" data-zone-select="${rootShellUi.escapeHtml(String(zone.id))}" ${isSelected ? 'aria-current="true"' : ''}>
        <span class="zones-list__item-title">${rootShellUi.escapeHtml(zone.name)}</span>
        <span class="zones-list__meta">${routeCode} · ${rootShellUi.escapeHtml(String(subregionsCount))} subzonas</span>
      </button>
    `;
  }

  function renderZoneList(filteredZones, selectedZoneId, searchTerm, allZonesCount) {
    if (!allZonesCount) {
      return '<div class="zones-state zones-state--empty"><p>Aún no hay zonas registradas.</p><p class="muted">Crea la primera zona para comenzar a organizar la cobertura territorial.</p><button id="zones-create-first-zone-button" class="secondary-button" type="button">Crear primera zona</button></div>';
    }

    if (!filteredZones.length) {
      return `
        <div class="zones-state zones-state--empty">
          <p>No encontramos zonas con ese criterio.</p>
          <p class="muted">Prueba con otro nombre o código, o limpia la búsqueda actual.</p>
          <p class="muted">Búsqueda actual: ${rootShellUi.escapeHtml(searchTerm)}</p>
          <button id="zones-clear-search-button" class="secondary-button" type="button">Limpiar búsqueda</button>
        </div>
      `;
    }

    return filteredZones
      .map((zone) => renderZoneListItem(zone, String(zone.id) === String(selectedZoneId)))
      .join('');
  }

  function renderEmptyDetail() {
    return `
      <div class="zones-state zones-state--empty">
        <h3 id="zones-detail-title">Selecciona una zona</h3>
        <p class="muted">El detalle aparecera aqui para consultar subzonas y registrar nuevas altas.</p>
      </div>
    `;
  }

  function renderSubregionList(subregions, highlightedSubregionId, searchTerm) {
    if (!subregions.length && searchTerm) {
      return `
        <div class="zones-state zones-state--empty">
          <p>No encontramos subzonas con ese criterio.</p>
          <p class="muted">Prueba con otro nombre o código para la zona seleccionada.</p>
          <button id="zones-clear-subregion-search-button" class="secondary-button" type="button">Limpiar búsqueda</button>
        </div>
      `;
    }

    if (!subregions.length) {
      return `
        <div class="zones-state zones-state--empty">
          <p>Esta zona aún no tiene subzonas registradas.</p>
          <p class="muted">Usa el botón Nueva subzona para completar la cobertura territorial.</p>
          <button id="zones-create-first-subzone-button" class="secondary-button" type="button">Crear subzona</button>
        </div>
      `;
    }

    return `
      <div class="zones-detail__subregions">
        ${subregions.map((subregion) => `
          <article class="zones-detail__subregion ${String(subregion.id) === String(highlightedSubregionId) ? 'zones-detail__subregion--highlighted' : ''}" data-subregion-id="${rootShellUi.escapeHtml(String(subregion.id))}">
            <strong>${rootShellUi.escapeHtml(subregion.name)}</strong>
            <span class="muted">${rootShellUi.escapeHtml(subregion.routeCode || 'Sin codigo')}</span>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderDetail(selectedZone, subregions, searchTerm, highlightedSubregionId) {
    if (!selectedZone) {
      return renderEmptyDetail();
    }

    return `
      <div class="zones-detail__header">
        <div>
          <h3 id="zones-detail-title">${rootShellUi.escapeHtml(selectedZone.name)}</h3>
          <p class="muted">${rootShellUi.escapeHtml(selectedZone.routeCode || 'Sin codigo de ruta')}</p>
        </div>
        <div class="zones-detail__actions">
          <button id="zones-open-subzone-dialog-button" type="button">+ Nueva subzona</button>
        </div>
      </div>
      <div class="zones-detail__summary">
        <span class="zones-detail__summary-label">Subzonas registradas</span>
        <strong>${rootShellUi.escapeHtml(String(Array.isArray(selectedZone.subregions) ? selectedZone.subregions.length : 0))}</strong>
      </div>
      <label class="zones-search-field" for="zones-subregion-search-input">
        <span>Buscar subzona</span>
        <input id="zones-subregion-search-input" type="search" placeholder="Buscar por nombre o código" autocomplete="off" value="${rootShellUi.escapeHtml(searchTerm)}" />
      </label>
      ${renderSubregionList(subregions, highlightedSubregionId, searchTerm)}
    `;
  }

  function applyFieldErrors(fieldErrors, fieldMap) {
    for (const [fieldName, fieldElement] of Object.entries(fieldMap)) {
      const fieldMessages = Array.isArray(fieldErrors?.[fieldName]) ? fieldErrors[fieldName] : [];
      const firstMessage = fieldMessages[0] || '';
      fieldElement.error.textContent = firstMessage;
      if (firstMessage) {
        fieldElement.input.setAttribute('aria-invalid', 'true');
      } else {
        fieldElement.input.removeAttribute('aria-invalid');
      }
    }
  }

  function clearFieldErrors(fieldMap) {
    applyFieldErrors({}, fieldMap);
  }

  function resetFormState(formElement, messageElement, fieldMap) {
    formElement.reset();
    messageElement.innerHTML = '';
    clearFieldErrors(fieldMap);
  }

  function renderFormError(messageElement, fieldMap, error, fallbackMessage) {
    applyFieldErrors(error?.fieldErrors || {}, fieldMap);
    messageElement.innerHTML = rootShellUi.renderInlineMessage(error?.message || fallbackMessage, 'error');
  }

  function setSubmitButtonState(buttonElement, options) {
    buttonElement.disabled = Boolean(options.isSubmitting);
    buttonElement.textContent = options.isSubmitting ? options.submittingText : options.idleText;
  }

  function validateRequiredName(fieldMap, minimumLength) {
    const nameValue = normalizeText(fieldMap.name.input.value);
    if (nameValue.length >= minimumLength) {
      clearFieldErrors(fieldMap);
      return true;
    }

    applyFieldErrors({ name: [`Ingresa un nombre de al menos ${minimumLength} caracteres.`] }, fieldMap);
    fieldMap.name.input.focus();
    return false;
  }

  function openDialog(dialogElement, focusTarget, options = {}) {
    const activeElement = globalScope.document.activeElement;
    dialogElement.hidden = false;
    dialogElement.classList.remove('hidden');
    globalScope.document.body.classList.add('root-page--drawer-open');
    dialogElement.__zonesPreviousActiveElement = activeElement instanceof globalScope.HTMLElement ? activeElement : null;

    const keydownHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (typeof options.onRequestClose === 'function') {
          options.onRequestClose();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(dialogElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentElement = globalScope.document.activeElement;

      if (event.shiftKey && currentElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && currentElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialogElement.__zonesKeydownHandler = keydownHandler;
    dialogElement.addEventListener('keydown', keydownHandler);
    if (focusTarget instanceof globalScope.HTMLElement) {
      focusTarget.focus();
    }
  }

  function closeDialog(dialogElement) {
    const keydownHandler = dialogElement.__zonesKeydownHandler;
    if (typeof keydownHandler === 'function') {
      dialogElement.removeEventListener('keydown', keydownHandler);
    }

    dialogElement.hidden = true;
    dialogElement.classList.add('hidden');
    globalScope.document.body.classList.remove('root-page--drawer-open');

    const previousActiveElement = dialogElement.__zonesPreviousActiveElement;
    if (previousActiveElement instanceof globalScope.HTMLElement) {
      previousActiveElement.focus();
    }
  }

  rootShell.register('views.zonesAdminHelpers', {
    applyFieldErrors,
    buildPayload,
    clearFieldErrors,
    closeDialog,
    countSubregions,
    getFilteredSubregions,
    getFilteredZones,
    getSelectedZone,
    matchesSearch,
    normalizeSearchTerm,
    openDialog,
    render,
    renderDetail,
    renderFormError,
    renderLoadErrorState,
    renderToast,
    renderZoneList,
    resetFormState,
    setSubmitButtonState,
    validateRequiredName,
  });
}(window));
