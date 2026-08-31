(function attachRootShellPurchaseRequestsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const quotationsApi = rootShell.require('quotationsApi');
  const rootShellUi = rootShell.require('ui');
  const renderers = rootShell.require('views.purchaseRequestsAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Solicitudes de compra</h2>
        <p class="muted">Consulta el historial de solicitudes de compra y sigue el avance de cada una hacia su orden de compra.</p>
      </section>

      <section class="routes-page" id="purchase-requests-page">
        <div id="purchase-requests-page-message"></div>

        <div class="commercial-layout commercial-layout--rfq-tracking" id="purchase-requests-layout">

          <article class="card root-card commercial-list-card" id="purchase-requests-sidebar">
            <div class="page-header">
              <div>
                <h3>Solicitudes de compra</h3>
                <p id="purchase-requests-list-summary" class="muted">Cargando solicitudes...</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="purchase-requests-refresh-button" class="secondary-button" type="button">Actualizar</button>
              </div>
            </div>
            <div
              id="purchase-requests-list-region"
              class="rfq-tracking-sidebar-list"
              role="list"
              aria-live="polite"
              aria-label="Solicitudes de compra"
            ></div>
          </article>

          <article
            class="card root-card commercial-detail-card"
            id="purchase-requests-detail-panel"
            aria-live="polite"
            aria-label="Detalle de la solicitud seleccionada"
          >
            <div id="purchase-requests-detail-region">
              <p class="empty-state">Selecciona una solicitud para ver el detalle.</p>
            </div>
          </article>

        </div>
      </section>
    `;
  }

  async function mount(container, session, _helpersBag) {

    const pageMessage = container.querySelector('#purchase-requests-page-message');
    const listSummary = container.querySelector('#purchase-requests-list-summary');
    const listRegion = container.querySelector('#purchase-requests-list-region');
    const detailRegion = container.querySelector('#purchase-requests-detail-region');
    const refreshButton = container.querySelector('#purchase-requests-refresh-button');

    let requests = [];
    let selectedRequestId = null;

    async function loadRequests() {
      listRegion.innerHTML = '<p class="empty-state">Cargando solicitudes...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Selecciona una solicitud para ver el detalle.</p>';
      pageMessage.innerHTML = '';

      try {
        requests = await quotationsApi.listPurchaseRequests(session);
        renderList();

        const openCount = requests.filter((r) => r.status === 'OPEN').length;
        listSummary.textContent = `${requests.length} solicitud(es) · ${openCount} abierta(s)`;
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar las solicitudes.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al cargar solicitudes de compra.',
          'error',
        );
        listSummary.textContent = 'Error al cargar solicitudes.';
      }
    }

    function renderList() {
      listRegion.innerHTML = renderers.renderRequestList(requests, selectedRequestId);
      bindListItems();
    }

    function bindListItems() {
      listRegion.querySelectorAll('[data-request-id]').forEach((item) => {
        item.addEventListener('click', () => selectRequest(item.getAttribute('data-request-id')));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectRequest(item.getAttribute('data-request-id'));
          }
        });
      });
    }

    function selectRequest(requestId) {
      selectedRequestId = requestId;
      const request = requests.find((r) => String(r.id) === String(requestId));
      renderList();
      renderDetail(request);
    }

    function renderDetail(request) {
      detailRegion.innerHTML = renderers.renderRequestDetail(request);
      bindDetailActions(request);
    }

    function bindDetailActions(request) {
      // Navegar al workspace de cotizaciones.
      const goToQuotationsBtn = detailRegion.querySelector('.purchase-requests-go-to-quotations-button');
      if (goToQuotationsBtn) {
        goToQuotationsBtn.addEventListener('click', () => {
          window.location.hash = '#cotizaciones';
        });
      }

      // Machotes de correo: toggle + carga lazy de invitaciones RFQ.
      const emailDraftsBtn = detailRegion.querySelector('.purchase-requests-show-email-drafts-button');
      const emailDraftsSection = detailRegion.querySelector('#purchase-requests-email-drafts-section');
      const emailDraftsContent = detailRegion.querySelector('#purchase-requests-email-drafts-content');

      if (!emailDraftsBtn || !emailDraftsSection || !emailDraftsContent) return;

      let draftsLoaded = false;

      emailDraftsBtn.addEventListener('click', async () => {
        const isExpanded = emailDraftsBtn.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
          // Contraer.
          emailDraftsSection.hidden = true;
          emailDraftsBtn.setAttribute('aria-expanded', 'false');
          emailDraftsBtn.textContent = '✉ Machotes de correo';
          return;
        }

        // Expandir.
        emailDraftsSection.hidden = false;
        emailDraftsBtn.setAttribute('aria-expanded', 'true');
        emailDraftsBtn.textContent = '✉ Ocultar machotes';

        // Solo cargar invitaciones la primera vez.
        if (draftsLoaded) return;
        draftsLoaded = true;

        emailDraftsContent.innerHTML = renderers.renderEmailDrafts([], request, 'loading');

        try {
          const invitations = await quotationsApi.listRfqInvitations(session, request.id);
          emailDraftsContent.innerHTML = renderers.renderEmailDrafts(
            Array.isArray(invitations) ? invitations : [],
            request,
            'ready',
          );
          bindCopyButtons(emailDraftsContent);
        } catch (_err) {
          // Si falla la carga de invitaciones, derivamos machotes desde request.quotations.
          emailDraftsContent.innerHTML = renderers.renderEmailDrafts([], request, 'ready');
          bindCopyButtons(emailDraftsContent);
        }
      });
    }

    /**
     * Wires "Copiar texto" buttons inside a container.
     * Uses navigator.clipboard when available; falls back to execCommand.
     *
     * @param {HTMLElement} container
     */
    function bindCopyButtons(container) {
      container.querySelectorAll('.purchase-request-copy-email-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const targetId = btn.getAttribute('data-target');
          const textarea = targetId ? container.querySelector(`#${CSS.escape(targetId)}`) : null;
          if (!textarea) return;

          const text = textarea.value;
          try {
            await navigator.clipboard.writeText(text);
            const original = btn.textContent;
            btn.textContent = '✓ Copiado';
            btn.disabled = true;
            setTimeout(() => {
              btn.textContent = original;
              btn.disabled = false;
            }, 2000);
          } catch (_err) {
            // Fallback para navegadores sin permiso clipboard.
            textarea.select();
            document.execCommand('copy');
          }
        });
      });
    }

    refreshButton.addEventListener('click', loadRequests);

    await loadRequests();
  }

  rootShell.register('views.purchaseRequestsAdmin', {
    render,
    mount,
  });
}(window));
