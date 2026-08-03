(function attachRootShellZonesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const zonesApi = rootShell.require('zonesApi');
  const rootShellUi = rootShell.require('ui');
  const zonesAdminHelpers = rootShell.require('views.zonesAdminHelpers');

  const TOAST_VISIBILITY_MS = 3200;
  const SUBZONE_HIGHLIGHT_MS = 3000;

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const layoutElement = /** @type {HTMLElement | null} */ (container.querySelector('#zones-layout'));
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#zones-list-region'));
    const detailRegion = /** @type {HTMLElement | null} */ (container.querySelector('#zones-detail-region'));
    const pageMessage = /** @type {HTMLElement | null} */ (container.querySelector('#zones-page-message'));
    const toastRegion = /** @type {HTMLElement | null} */ (container.querySelector('#zones-toast-region'));
    const totalCountElement = /** @type {HTMLElement | null} */ (container.querySelector('#zones-total-count'));
    const subregionCountElement = /** @type {HTMLElement | null} */ (container.querySelector('#zones-subregion-count'));
    const listSummaryElement = /** @type {HTMLElement | null} */ (container.querySelector('#zones-list-summary'));
    const zoneSearchInput = /** @type {HTMLInputElement | null} */ (container.querySelector('#zones-search-input'));
    const refreshButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#zones-refresh-button'));
    const openZoneDialogButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#zones-open-zone-dialog-button'));
    const mobileBackButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#zones-mobile-back-button'));
    const zoneDialog = /** @type {HTMLElement | null} */ (container.querySelector('#zones-zone-dialog'));
    const zoneForm = /** @type {HTMLFormElement | null} */ (container.querySelector('#zones-zone-form'));
    const zoneFormMessage = /** @type {HTMLElement | null} */ (container.querySelector('#zones-zone-form-message'));
    const zoneSubmitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#zones-zone-submit-button'));
    const zoneCancelButtons = Array.from(container.querySelectorAll('#zones-zone-cancel-button, #zones-close-zone-dialog-button'));
    const subzoneDialog = /** @type {HTMLElement | null} */ (container.querySelector('#zones-subzone-dialog'));
    const subzoneForm = /** @type {HTMLFormElement | null} */ (container.querySelector('#zones-subzone-form'));
    const subzoneFormMessage = /** @type {HTMLElement | null} */ (container.querySelector('#zones-subzone-form-message'));
    const subzoneSubmitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#zones-subzone-submit-button'));
    const subzoneCancelButtons = Array.from(container.querySelectorAll('#zones-subzone-cancel-button, #zones-close-subzone-dialog-button'));
    const subzoneParentLabel = /** @type {HTMLElement | null} */ (container.querySelector('#zones-subzone-parent-label'));

    if (!layoutElement || !listRegion || !detailRegion || !pageMessage || !toastRegion || !totalCountElement || !subregionCountElement || !listSummaryElement || !zoneSearchInput || !refreshButton || !openZoneDialogButton || !mobileBackButton || !zoneDialog || !zoneForm || !zoneFormMessage || !zoneSubmitButton || !subzoneDialog || !subzoneForm || !subzoneFormMessage || !subzoneSubmitButton || !subzoneParentLabel) {
      return;
    }

    const zoneFieldMap = {
      name: {
        input: /** @type {HTMLInputElement} */ (container.querySelector('#zones-zone-name')),
        error: /** @type {HTMLElement} */ (container.querySelector('#zones-zone-name-error')),
      },
      routeCode: {
        input: /** @type {HTMLInputElement} */ (container.querySelector('#zones-zone-route-code')),
        error: /** @type {HTMLElement} */ (container.querySelector('#zones-zone-route-code-error')),
      },
    };
    const subzoneFieldMap = {
      name: {
        input: /** @type {HTMLInputElement} */ (container.querySelector('#zones-subzone-name')),
        error: /** @type {HTMLElement} */ (container.querySelector('#zones-subzone-name-error')),
      },
      routeCode: {
        input: /** @type {HTMLInputElement} */ (container.querySelector('#zones-subzone-route-code')),
        error: /** @type {HTMLElement} */ (container.querySelector('#zones-subzone-route-code-error')),
      },
    };

    let zones = [];
    let selectedZoneId = null;
    let zoneSearchTerm = '';
    let subregionSearchTerm = '';
    let loading = true;
    let loadingMessage = 'Cargando zonas...';
    let pageErrorMessage = '';
    let highlightedSubregionId = null;
    let toastMessage = '';
    let toastTimerId = null;
    let highlightTimerId = null;

    function getFilteredZones() {
      return zonesAdminHelpers.getFilteredZones(zones, zoneSearchTerm);
    }

    function getSelectedZone() {
      return zonesAdminHelpers.getSelectedZone(zones, selectedZoneId, zoneSearchTerm);
    }

    function getFilteredSubregions(selectedZone) {
      return zonesAdminHelpers.getFilteredSubregions(selectedZone, subregionSearchTerm);
    }

    function setMobileView(nextView) {
      layoutElement.classList.toggle('zones-page--mobile-list', nextView === 'list');
      layoutElement.classList.toggle('zones-page--mobile-detail', nextView === 'detail');
    }

    function setPageMessage(message, tone) {
      pageMessage.innerHTML = message ? rootShellUi.renderInlineMessage(message, tone) : '';
    }

    function refreshSummary(filteredZones) {
      totalCountElement.textContent = String(zones.length);
      subregionCountElement.textContent = String(zonesAdminHelpers.countSubregions(zones));
      listSummaryElement.textContent = filteredZones.length === zones.length
        ? `Consulta y filtra las ${zones.length} zonas registradas de la empresa.`
        : `${filteredZones.length} de ${zones.length} zonas visibles con el filtro actual.`;
    }

    function focusDetailHeading() {
      const detailHeading = detailRegion.querySelector('#zones-detail-title');
      if (detailHeading instanceof globalScope.HTMLElement) {
        detailHeading.setAttribute('tabindex', '-1');
        detailHeading.focus();
      }
    }

    function renderLoadingState() {
      listRegion.innerHTML = `
        <div class="zones-state zones-state--loading" aria-hidden="true">
          <div class="zones-skeleton zones-skeleton--title"></div>
          <div class="zones-skeleton zones-skeleton--line"></div>
          <div class="zones-skeleton zones-skeleton--card"></div>
          <div class="zones-skeleton zones-skeleton--card"></div>
        </div>
      `;
      detailRegion.innerHTML = `
        <div class="zones-state zones-state--loading" aria-hidden="true">
          <div class="zones-skeleton zones-skeleton--title"></div>
          <div class="zones-skeleton zones-skeleton--line"></div>
          <div class="zones-skeleton zones-skeleton--line"></div>
          <div class="zones-skeleton zones-skeleton--card"></div>
        </div>
      `;
      totalCountElement.innerHTML = '<span class="zones-skeleton zones-skeleton--metric"></span>';
      subregionCountElement.innerHTML = '<span class="zones-skeleton zones-skeleton--metric"></span>';
      listSummaryElement.textContent = loadingMessage;
    }

    function renderCurrentState() {
      if (loading) {
        renderLoadingState();
        return;
      }

      if (pageErrorMessage && !zones.length) {
        refreshSummary([]);
        listRegion.innerHTML = zonesAdminHelpers.renderLoadErrorState(pageErrorMessage);
        detailRegion.innerHTML = zonesAdminHelpers.renderLoadErrorState(pageErrorMessage);
        setPageMessage(pageErrorMessage, 'error');
        return;
      }

      const filteredZones = getFilteredZones();
      const selectedZone = getSelectedZone();
      const filteredSubregions = getFilteredSubregions(selectedZone);
      if (selectedZone && String(selectedZone.id) !== String(selectedZoneId)) {
        selectedZoneId = selectedZone.id;
      }

      refreshSummary(filteredZones);
      listRegion.innerHTML = zonesAdminHelpers.renderZoneList(filteredZones, selectedZoneId, zoneSearchTerm, zones.length);
      detailRegion.innerHTML = zonesAdminHelpers.renderDetail(
        selectedZone,
        filteredSubregions,
        subregionSearchTerm,
        highlightedSubregionId,
      );
      setPageMessage(pageErrorMessage, 'error');
      toastRegion.innerHTML = toastMessage ? zonesAdminHelpers.renderToast(toastMessage) : '';
      subzoneParentLabel.textContent = selectedZone?.name || 'Selecciona una zona para continuar.';
    }

    async function loadZones(options = {}) {
      const preferredZoneId = options.preferredZoneId ?? selectedZoneId;
      loading = true;
      loadingMessage = options.loadingMessage || 'Cargando zonas...';
      pageErrorMessage = '';
      renderCurrentState();
      setShellStatus(loadingMessage);

      try {
        const loadedZones = await zonesApi.listZones(session);
        zones = Array.isArray(loadedZones) ? loadedZones : [];
        selectedZoneId = zones.find((zone) => String(zone.id) === String(preferredZoneId))?.id || zones[0]?.id || null;
        setShellStatus('Sesion lista.');
      } catch (error) {
        zones = [];
        selectedZoneId = null;
        pageErrorMessage = error.message || 'No se pudieron cargar las zonas.';
        setShellStatus('No se pudo cargar la vista de zonas.', 'error');
      } finally {
        loading = false;
        renderCurrentState();
      }
    }

    function showToast(message) {
      toastMessage = message;
      toastRegion.innerHTML = zonesAdminHelpers.renderToast(message);
      if (toastTimerId) {
        globalScope.clearTimeout(toastTimerId);
      }

      toastTimerId = globalScope.setTimeout(() => {
        toastMessage = '';
        toastRegion.innerHTML = '';
      }, TOAST_VISIBILITY_MS);
    }

    function resetZoneForm() {
      zonesAdminHelpers.resetFormState(zoneForm, zoneFormMessage, zoneFieldMap);
    }

    function resetSubzoneForm() {
      zonesAdminHelpers.resetFormState(subzoneForm, subzoneFormMessage, subzoneFieldMap);
    }

    function scheduleSubzoneHighlight(subregionId) {
      highlightedSubregionId = subregionId;
      if (highlightTimerId) {
        globalScope.clearTimeout(highlightTimerId);
      }

      highlightTimerId = globalScope.setTimeout(() => {
        highlightedSubregionId = null;
        renderCurrentState();
      }, SUBZONE_HIGHLIGHT_MS);
    }

    function selectZone(zoneId, options = {}) {
      selectedZoneId = zoneId;
      subregionSearchTerm = '';
      if (options.mobileDetail) {
        setMobileView('detail');
      }
      renderCurrentState();
      if (options.mobileDetail) {
        focusDetailHeading();
      }
    }

    openZoneDialogButton.addEventListener('click', () => {
      resetZoneForm();
      zonesAdminHelpers.openDialog(zoneDialog, zoneFieldMap.name.input, {
        onRequestClose: () => {
          zonesAdminHelpers.closeDialog(zoneDialog);
          resetZoneForm();
        },
      });
    });

    for (const button of zoneCancelButtons) {
      button.addEventListener('click', () => {
        zonesAdminHelpers.closeDialog(zoneDialog);
        resetZoneForm();
      });
    }

    for (const button of subzoneCancelButtons) {
      button.addEventListener('click', () => {
        zonesAdminHelpers.closeDialog(subzoneDialog);
        resetSubzoneForm();
      });
    }

    refreshButton.addEventListener('click', async () => {
      await loadZones({ preferredZoneId: selectedZoneId, loadingMessage: 'Actualizando zonas...' });
    });

    zoneSearchInput.addEventListener('input', () => {
      zoneSearchTerm = zonesAdminHelpers.normalizeSearchTerm(zoneSearchInput.value);
      renderCurrentState();
    });

    mobileBackButton.addEventListener('click', () => {
      setMobileView('list');
      const selectedButton = listRegion.querySelector(`[data-zone-select="${selectedZoneId}"]`);
      if (selectedButton instanceof globalScope.HTMLElement) {
        selectedButton.focus();
      }
    });

    container.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLElement)) {
        return;
      }

      const selectedRouteZoneId = target.closest('[data-zone-select]')?.getAttribute('data-zone-select');
      if (selectedRouteZoneId) {
        selectZone(selectedRouteZoneId, { mobileDetail: true });
        return;
      }

      if (target.closest('#zones-inline-retry-button')) {
        loadZones({ preferredZoneId: selectedZoneId, loadingMessage: 'Cargando zonas...' });
        return;
      }

      if (target.closest('#zones-clear-search-button')) {
        zoneSearchTerm = '';
        zoneSearchInput.value = '';
        renderCurrentState();
        zoneSearchInput.focus();
        return;
      }

      if (target.closest('#zones-create-first-zone-button')) {
        resetZoneForm();
        zonesAdminHelpers.openDialog(zoneDialog, zoneFieldMap.name.input, {
          onRequestClose: () => {
            zonesAdminHelpers.closeDialog(zoneDialog);
            resetZoneForm();
          },
        });
        return;
      }

      if (target.closest('#zones-clear-subregion-search-button')) {
        subregionSearchTerm = '';
        renderCurrentState();
        const subregionInput = detailRegion.querySelector('#zones-subregion-search-input');
        if (subregionInput instanceof globalScope.HTMLInputElement) {
          subregionInput.focus();
        }
        return;
      }

      if (target.closest('#zones-create-first-subzone-button')) {
        resetSubzoneForm();
        zonesAdminHelpers.openDialog(subzoneDialog, subzoneFieldMap.name.input, {
          onRequestClose: () => {
            zonesAdminHelpers.closeDialog(subzoneDialog);
            resetSubzoneForm();
          },
        });
        return;
      }

      if (target.closest('#zones-open-subzone-dialog-button')) {
        if (!getSelectedZone()) {
          setPageMessage('Selecciona una zona antes de registrar una subzona.', 'error');
          return;
        }

        resetSubzoneForm();
        zonesAdminHelpers.openDialog(subzoneDialog, subzoneFieldMap.name.input, {
          onRequestClose: () => {
            zonesAdminHelpers.closeDialog(subzoneDialog);
            resetSubzoneForm();
          },
        });
      }
    });

    detailRegion.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof globalScope.HTMLInputElement && target.id === 'zones-subregion-search-input') {
        subregionSearchTerm = zonesAdminHelpers.normalizeSearchTerm(target.value);
        renderCurrentState();
      }
    });

    zoneForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      zoneFormMessage.innerHTML = '';
      zonesAdminHelpers.clearFieldErrors(zoneFieldMap);
      if (!zonesAdminHelpers.validateRequiredName(zoneFieldMap, 2)) {
        return;
      }

      zonesAdminHelpers.setSubmitButtonState(zoneSubmitButton, {
        isSubmitting: true,
        idleText: 'Guardar zona',
        submittingText: 'Guardando zona...',
      });
      setShellStatus('Guardando zona...');

      try {
        const createdZone = await zonesApi.createZone(session, zonesAdminHelpers.buildPayload(new FormData(zoneForm)));
        zoneSearchTerm = '';
        zoneSearchInput.value = '';
        await loadZones({ preferredZoneId: createdZone?.id || null, loadingMessage: 'Actualizando zonas...' });
        zonesAdminHelpers.closeDialog(zoneDialog);
        resetZoneForm();
        setMobileView('detail');
        showToast('Zona creada correctamente.');
        setShellStatus('Zona creada correctamente.');
        focusDetailHeading();
      } catch (error) {
        zonesAdminHelpers.renderFormError(zoneFormMessage, zoneFieldMap, error, 'No se pudo crear la zona.');
        setShellStatus('No se pudo crear la zona.', 'error');
      } finally {
        zonesAdminHelpers.setSubmitButtonState(zoneSubmitButton, {
          isSubmitting: false,
          idleText: 'Guardar zona',
          submittingText: 'Guardando zona...',
        });
      }
    });

    subzoneForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      subzoneFormMessage.innerHTML = '';
      zonesAdminHelpers.clearFieldErrors(subzoneFieldMap);
      if (!zonesAdminHelpers.validateRequiredName(subzoneFieldMap, 2)) {
        return;
      }

      const selectedZone = getSelectedZone();
      if (!selectedZone) {
        subzoneFormMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona una zona valida antes de continuar.', 'error');
        return;
      }

      zonesAdminHelpers.setSubmitButtonState(subzoneSubmitButton, {
        isSubmitting: true,
        idleText: 'Guardar subzona',
        submittingText: 'Guardando subzona...',
      });
      setShellStatus('Guardando subzona...');

      try {
        const createdSubzone = await zonesApi.createSubzone(session, selectedZone.id, zonesAdminHelpers.buildPayload(new FormData(subzoneForm)));
        subregionSearchTerm = '';
        await loadZones({ preferredZoneId: selectedZone.id, loadingMessage: 'Actualizando zonas...' });
        zonesAdminHelpers.closeDialog(subzoneDialog);
        resetSubzoneForm();
        setMobileView('detail');
        scheduleSubzoneHighlight(createdSubzone?.id || null);
        renderCurrentState();
        showToast('Subzona creada correctamente.');
        setShellStatus('Subzona creada correctamente.');
        focusDetailHeading();
      } catch (error) {
        zonesAdminHelpers.renderFormError(subzoneFormMessage, subzoneFieldMap, error, 'No se pudo crear la subzona.');
        setShellStatus('No se pudo crear la subzona.', 'error');
      } finally {
        zonesAdminHelpers.setSubmitButtonState(subzoneSubmitButton, {
          isSubmitting: false,
          idleText: 'Guardar subzona',
          submittingText: 'Guardando subzona...',
        });
      }
    });

    renderCurrentState();
    await loadZones({ loadingMessage: 'Cargando zonas...' });
  }

  rootShell.register('views.zonesAdmin', {
    mount,
    render: zonesAdminHelpers.render,
  });
}(window));
