(function attachRootShellRfqTrackingAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rfqTrackingApi = rootShell.require('rfqTrackingApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Seguimiento de cotizaciones</h2>
        <p class="muted">Consulta todas las cotizaciones abiertas y registra respuestas manuales cuando corresponda.</p>
      </section>

      <section class="routes-page quotations-page" id="rfq-tracking-page">
        <div id="rfq-tracking-page-message"></div>

        <div class="commercial-layout commercial-layout--rfq-tracking" id="rfq-tracking-layout">

          <article class="card root-card commercial-list-card" id="rfq-tracking-sidebar">
            <div class="page-header">
              <div>
                <h3>Solicitudes abiertas</h3>
                <p id="rfq-tracking-list-summary" class="muted">Cargando cotizaciones abiertas...</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="rfq-tracking-refresh-button" class="secondary-button" type="button">Actualizar</button>
              </div>
            </div>
            <div
              id="rfq-tracking-list-region"
              class="rfq-tracking-sidebar-list"
              role="list"
              aria-live="polite"
              aria-label="Solicitudes de cotización abiertas"
            ></div>
          </article>

          <article class="card root-card commercial-detail-card" id="rfq-tracking-detail-panel" aria-live="polite" aria-label="Detalle de la solicitud seleccionada">
            <div id="rfq-tracking-detail-region"></div>
          </article>

        </div>
      </section>

      <dialog id="rfq-tracking-manual-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="rfq-tracking-manual-title">Registrar respuesta manual</h3>
            <p id="rfq-tracking-manual-subtitle" class="muted">Captura una respuesta recibida por correo de oficina.</p>
          </div>
          <button id="rfq-tracking-manual-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="rfq-tracking-manual-message"></div>
        <div id="rfq-tracking-manual-content"></div>
        <div class="action-row">
          <button id="rfq-tracking-manual-submit-button" type="button">Registrar respuesta</button>
          <button id="rfq-tracking-manual-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>

      <dialog id="rfq-tracking-cancel-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3>Cancelar solicitud de cotización</h3>
            <p class="muted">Esta acción no se puede deshacer.</p>
          </div>
          <button id="rfq-tracking-cancel-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="rfq-tracking-cancel-message"></div>
        <div class="stack-section">
          <p>¿Confirmas que deseas cancelar la solicitud <strong id="rfq-tracking-cancel-name"></strong>?</p>
          <p class="muted">No se generará ninguna orden de compra. La solicitud se marcará como cancelada y dejará de aparecer en el seguimiento.</p>
        </div>
        <div class="action-row">
          <button id="rfq-tracking-cancel-confirm-button" class="rfq-danger-confirm" type="button">Sí, cancelar solicitud</button>
          <button id="rfq-tracking-cancel-abort-button" class="secondary-button" type="button">Mantener abierta</button>
        </div>
      </dialog>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const canManage = sessionAdapter.hasPermission(session, 'procurement.manage');

    const pageMessage = container.querySelector('#rfq-tracking-page-message');
    const listSummary = container.querySelector('#rfq-tracking-list-summary');
    const listRegion = container.querySelector('#rfq-tracking-list-region');
    const detailRegion = container.querySelector('#rfq-tracking-detail-region');
    const refreshButton = container.querySelector('#rfq-tracking-refresh-button');
    const manualDialog = container.querySelector('#rfq-tracking-manual-dialog');
    const manualTitle = container.querySelector('#rfq-tracking-manual-title');
    const manualSubtitle = container.querySelector('#rfq-tracking-manual-subtitle');
    const manualMessage = container.querySelector('#rfq-tracking-manual-message');
    const manualContent = container.querySelector('#rfq-tracking-manual-content');
    const manualCloseButton = container.querySelector('#rfq-tracking-manual-close-button');
    const manualCancelButton = container.querySelector('#rfq-tracking-manual-cancel-button');
    const manualSubmitButton = container.querySelector('#rfq-tracking-manual-submit-button');

    const cancelDialog = container.querySelector('#rfq-tracking-cancel-dialog');
    const cancelName = container.querySelector('#rfq-tracking-cancel-name');
    const cancelMessage = container.querySelector('#rfq-tracking-cancel-message');
    const cancelCloseButton = container.querySelector('#rfq-tracking-cancel-close-button');
    const cancelAbortButton = container.querySelector('#rfq-tracking-cancel-abort-button');
    const cancelConfirmButton = container.querySelector('#rfq-tracking-cancel-confirm-button');

    if (!pageMessage || !listSummary || !listRegion || !detailRegion || !refreshButton
      || !manualDialog || !manualTitle || !manualSubtitle || !manualMessage
      || !manualContent || !manualCloseButton || !manualCancelButton || !manualSubmitButton
      || !cancelDialog || !cancelName || !cancelMessage
      || !cancelCloseButton || !cancelAbortButton || !cancelConfirmButton) {
      return;
    }

    let requests = [];
    let selectedRequestId = null;
    let currentManualContext = null;

    function findRequestById(requestId) {
      return requests.find((entry) => String(entry.purchaseRequestId) === String(requestId)) || null;
    }

    function clearSelection() {
      selectedRequestId = null;
      listRegion.querySelectorAll('.commercial-list-item').forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      detailRegion.innerHTML = renderers.renderDetailPlaceholder();
    }

    function selectRequest(requestId) {
      selectedRequestId = requestId;
      const request = findRequestById(requestId);

      listRegion.querySelectorAll('.commercial-list-item').forEach((btn) => {
        const isActive = btn.dataset.requestId === String(requestId);
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      if (!request) {
        detailRegion.innerHTML = renderers.renderDetailPlaceholder();
        return;
      }

      detailRegion.innerHTML = renderers.renderRequestDetail(request, canManage);
      bindManualButtons();
      bindCloseButtons();
    }

    function bindManualButtons() {
      detailRegion.querySelectorAll('.rfq-tracking-manual-response-button').forEach((button) => {
        button.addEventListener('click', () => {
          const purchaseRequestId = button.getAttribute('data-purchase-request-id');
          const invitationId = button.getAttribute('data-invitation-id');
          const supplierName = button.getAttribute('data-supplier-name') || 'Proveedor';
          const request = findRequestById(purchaseRequestId);
          if (!request) {
            return;
          }
          currentManualContext = { invitationId, purchaseRequestId, supplierName, request };
          manualTitle.textContent = `Registrar respuesta — ${supplierName}`;
          manualSubtitle.textContent = `Solicitud: ${request.title || `#${request.purchaseRequestId}`}`;
          manualMessage.innerHTML = '';
          manualContent.innerHTML = renderers.renderManualResponseDialog(currentManualContext, request);
          manualDialog.showModal();
        });
      });
    }

    function bindCloseButtons() {
      const goBtn = detailRegion.querySelector('#rfq-tracking-go-to-quotations-button');
      if (goBtn) {
        goBtn.addEventListener('click', () => {
          window.location.hash = '#cotizaciones';
        });
      }

      const cancelBtn = detailRegion.querySelector('#rfq-tracking-cancel-request-button');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          const purchaseRequestId = cancelBtn.dataset.purchaseRequestId;
          const requestTitle = cancelBtn.dataset.requestTitle || `#${purchaseRequestId}`;
          cancelName.textContent = requestTitle;
          cancelMessage.innerHTML = '';
          cancelConfirmButton.disabled = false;
          cancelConfirmButton.textContent = 'Sí, cancelar solicitud';
          cancelDialog.dataset.pendingRequestId = purchaseRequestId;
          cancelDialog.showModal();
        });
      }
    }

    function bindSidebarItems() {
      listRegion.querySelectorAll('.commercial-list-item').forEach((btn) => {
        btn.addEventListener('click', () => selectRequest(btn.dataset.requestId));
      });
    }

    async function loadTracking() {
      pageMessage.innerHTML = '';
      listRegion.innerHTML = '<p class="empty-state">Cargando cotizaciones abiertas...</p>';
      setShellStatus('Cargando seguimiento de cotizaciones...');

      try {
        const trackingResponse = await rfqTrackingApi.listTracking(session);
        requests = Array.isArray(trackingResponse) ? trackingResponse : [];

        const withInvitations = requests.filter((r) => Number(r.invitations?.length || 0) > 0).length;
        const withResponses = requests.filter((r) => Number(r.respondedInvitationCount || 0) > 0).length;
        const pendingInvitation = requests.filter((r) => !r.hasInvitations).length;
        listSummary.textContent = requests.length
          ? `${requests.length} solicitud(es) abiertas · ${withInvitations} con invitaciones · ${withResponses} con respuestas · ${pendingInvitation} pendientes de invitar.`
          : 'No hay cotizaciones abiertas para seguimiento en este momento.';

        listRegion.innerHTML = requests.length
          ? requests.map((r) => renderers.renderRequestListItem(r)).join('')
          : '<p class="empty-state muted">Sin cotizaciones abiertas.</p>';

        bindSidebarItems();

        const prevRequest = selectedRequestId ? findRequestById(selectedRequestId) : null;
        if (prevRequest) {
          selectRequest(selectedRequestId);
        } else if (requests.length > 0) {
          selectRequest(requests[0].purchaseRequestId);
        } else {
          clearSelection();
        }

        setShellStatus('Seguimiento de cotizaciones cargado.');
      } catch (error) {
        requests = [];
        listSummary.textContent = 'No se pudieron cargar las cotizaciones abiertas.';
        listRegion.innerHTML = '<p class="empty-state muted">Error al cargar. Usa "Actualizar" para reintentar.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el seguimiento de cotizaciones.', 'error');
        clearSelection();
        setShellStatus('Error al cargar seguimiento de cotizaciones.', 'error');
      }
    }

    async function submitManualResponse() {
      if (!currentManualContext) {
        return;
      }

      const currency = manualContent.querySelector('#rfq-tracking-manual-currency')?.value || 'CRC';
      const notes = manualContent.querySelector('#rfq-tracking-manual-notes')?.value || null;
      const rows = manualContent.querySelectorAll('#rfq-tracking-manual-items-body tr');
      const items = Array.from(rows).map((row) => ({
        productId: row.getAttribute('data-product-id'),
        quantity: Number(row.querySelector('[name="quantity"]')?.value || 0),
        unitPrice: Number(row.querySelector('[name="unitPrice"]')?.value || 0),
        leadTimeDays: row.querySelector('[name="leadTimeDays"]')?.value ? Number(row.querySelector('[name="leadTimeDays"]')?.value) : null,
      })).filter((item) => item.quantity > 0 && item.unitPrice > 0);

      if (!items.length) {
        manualMessage.innerHTML = rootShellUi.renderInlineMessage('Debes ingresar al menos un producto con cantidad y precio válidos.', 'warning');
        return;
      }

      manualSubmitButton.disabled = true;
      manualSubmitButton.textContent = 'Registrando...';
      manualMessage.innerHTML = '';

      try {
        await rfqTrackingApi.submitManualResponse(session, currentManualContext.invitationId, { currency, notes, items });
        manualDialog.close();
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Respuesta manual registrada exitosamente.', 'success');
        currentManualContext = null;
        await loadTracking();
      } catch (error) {
        manualMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo registrar la respuesta manual.', 'error');
      } finally {
        manualSubmitButton.disabled = false;
        manualSubmitButton.textContent = 'Registrar respuesta';
      }
    }

    async function confirmCancelRequest() {
      const purchaseRequestId = cancelDialog.dataset.pendingRequestId;
      if (!purchaseRequestId) {
        return;
      }

      cancelConfirmButton.disabled = true;
      cancelConfirmButton.textContent = 'Cancelando...';
      cancelMessage.innerHTML = '';

      try {
        await rfqTrackingApi.cancelRequest(session, purchaseRequestId);
        cancelDialog.close();
        pageMessage.innerHTML = rootShellUi.renderInlineMessage('Solicitud cancelada correctamente.', 'success');
        await loadTracking();
      } catch (error) {
        cancelMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cancelar la solicitud.', 'error');
      } finally {
        cancelConfirmButton.disabled = false;
        cancelConfirmButton.textContent = 'Sí, cancelar solicitud';
      }
    }

    refreshButton.addEventListener('click', loadTracking);
    manualCloseButton.addEventListener('click', () => manualDialog.close());
    manualCancelButton.addEventListener('click', () => manualDialog.close());
    manualSubmitButton.addEventListener('click', submitManualResponse);
    cancelCloseButton.addEventListener('click', () => cancelDialog.close());
    cancelAbortButton.addEventListener('click', () => cancelDialog.close());
    cancelConfirmButton.addEventListener('click', confirmCancelRequest);

    detailRegion.innerHTML = renderers.renderDetailPlaceholder();
    await loadTracking();
  }

  rootShell.register('views.rfqTrackingAdmin', {
    render,
    mount,
  });
}(window));
