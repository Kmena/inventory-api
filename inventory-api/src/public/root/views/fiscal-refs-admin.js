(function attachRootShellFiscalRefsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const receiptsApi = rootShell.require('receiptsApi');
  const rootShellUi = rootShell.require('ui');
  const renderers = rootShell.require('views.fiscalRefsAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Referencias fiscales</h2>
        <p class="muted">Consulta los comprobantes fiscales registrados en recepciones confirmadas.</p>
      </section>

      <section class="routes-page" id="fiscal-refs-page">
        <div id="fiscal-refs-page-message"></div>

        <div class="commercial-layout commercial-layout--rfq-tracking" id="fiscal-refs-layout">

          <article class="card root-card commercial-list-card" id="fiscal-refs-sidebar">
            <div class="page-header">
              <div>
                <h3>Referencias fiscales</h3>
                <p id="fiscal-refs-list-summary" class="muted">Cargando referencias...</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="fiscal-refs-refresh-button" class="secondary-button" type="button">Actualizar</button>
              </div>
            </div>
            <div
              id="fiscal-refs-list-region"
              class="rfq-tracking-sidebar-list"
              role="list"
              aria-live="polite"
              aria-label="Referencias fiscales"
            ></div>
          </article>

          <article
            class="card root-card commercial-detail-card"
            id="fiscal-refs-detail-panel"
            aria-live="polite"
            aria-label="Detalle de la referencia fiscal seleccionada"
          >
            <div id="fiscal-refs-detail-region">
              <p class="empty-state">Selecciona una referencia fiscal para ver el detalle.</p>
            </div>
          </article>

        </div>
      </section>
    `;
  }

  async function mount(container, session) {
    const pageMessage = container.querySelector('#fiscal-refs-page-message');
    const listSummary = container.querySelector('#fiscal-refs-list-summary');
    const listRegion = container.querySelector('#fiscal-refs-list-region');
    const detailRegion = container.querySelector('#fiscal-refs-detail-region');
    const refreshButton = container.querySelector('#fiscal-refs-refresh-button');

    let fiscalRefs = [];
    let selectedRefId = null;

    async function loadFiscalRefs() {
      listRegion.innerHTML = '<p class="empty-state">Cargando referencias...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Selecciona una referencia fiscal para ver el detalle.</p>';
      pageMessage.innerHTML = '';

      try {
        fiscalRefs = await receiptsApi.listFiscalReferences(session);
        renderList();
        listSummary.textContent = `${fiscalRefs.length} referencia(s) fiscal(es)`;
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar las referencias fiscales.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al cargar las referencias fiscales.',
          'error',
        );
        listSummary.textContent = 'Error al cargar referencias.';
      }
    }

    function renderList() {
      listRegion.innerHTML = renderers.renderFiscalRefList(fiscalRefs, selectedRefId);
      bindListItems();
    }

    function bindListItems() {
      listRegion.querySelectorAll('[data-fiscal-ref-id]').forEach((item) => {
        item.addEventListener('click', () => selectFiscalRef(item.getAttribute('data-fiscal-ref-id')));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectFiscalRef(item.getAttribute('data-fiscal-ref-id'));
          }
        });
      });
    }

    function selectFiscalRef(refId) {
      selectedRefId = refId;
      const ref = fiscalRefs.find((r) => String(r.id) === String(refId));
      renderList();
      renderDetail(ref);
    }

    function renderDetail(ref) {
      detailRegion.innerHTML = renderers.renderFiscalRefDetail(ref);
    }

    refreshButton.addEventListener('click', loadFiscalRefs);

    await loadFiscalRefs();
  }

  rootShell.register('views.fiscalRefsAdmin', {
    render,
    mount,
  });
}(window));
