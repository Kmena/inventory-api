(function attachRootShellReceiptsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const receiptsApi = rootShell.require('receiptsApi');
  const rootShellUi = rootShell.require('ui');
  const renderers = rootShell.require('views.receiptsAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Recepciones de mercancía</h2>
        <p class="muted">Consulta los documentos de recepción de compra y el estado de cada entrega.</p>
      </section>

      <section class="routes-page" id="receipts-page">
        <div id="receipts-page-message"></div>

        <div class="commercial-layout commercial-layout--rfq-tracking" id="receipts-layout">

          <article class="card root-card commercial-list-card" id="receipts-sidebar">
            <div class="page-header">
              <div>
                <h3>Recepciones</h3>
                <p id="receipts-list-summary" class="muted">Cargando recepciones...</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="receipts-refresh-button" class="secondary-button" type="button">Actualizar</button>
              </div>
            </div>
            <div
              id="receipts-list-region"
              class="rfq-tracking-sidebar-list"
              role="list"
              aria-live="polite"
              aria-label="Recepciones de mercancía"
            ></div>
          </article>

          <article
            class="card root-card commercial-detail-card"
            id="receipts-detail-panel"
            aria-live="polite"
            aria-label="Detalle de la recepción seleccionada"
          >
            <div id="receipts-detail-region">
              <p class="empty-state">Selecciona una recepción para ver el detalle.</p>
            </div>
          </article>

        </div>
      </section>
    `;
  }

  async function mount(container, session) {
    const pageMessage = container.querySelector('#receipts-page-message');
    const listSummary = container.querySelector('#receipts-list-summary');
    const listRegion = container.querySelector('#receipts-list-region');
    const detailRegion = container.querySelector('#receipts-detail-region');
    const refreshButton = container.querySelector('#receipts-refresh-button');

    let receipts = [];
    let selectedReceiptId = null;

    async function loadReceipts() {
      listRegion.innerHTML = '<p class="empty-state">Cargando recepciones...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Selecciona una recepción para ver el detalle.</p>';
      pageMessage.innerHTML = '';

      try {
        receipts = await receiptsApi.listReceipts(session);
        renderList();
        listSummary.textContent = `${receipts.length} recepción(es)`;
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar las recepciones.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al cargar las recepciones.',
          'error',
        );
        listSummary.textContent = 'Error al cargar recepciones.';
      }
    }

    function renderList() {
      listRegion.innerHTML = renderers.renderReceiptList(receipts, selectedReceiptId);
      bindListItems();
    }

    function bindListItems() {
      listRegion.querySelectorAll('[data-receipt-id]').forEach((item) => {
        item.addEventListener('click', () => selectReceipt(item.getAttribute('data-receipt-id')));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectReceipt(item.getAttribute('data-receipt-id'));
          }
        });
      });
    }

    function selectReceipt(receiptId) {
      selectedReceiptId = receiptId;
      const receipt = receipts.find((r) => String(r.id) === String(receiptId));
      renderList();
      renderDetail(receipt);
    }

    function renderDetail(receipt) {
      detailRegion.innerHTML = renderers.renderReceiptDetail(receipt);
    }

    refreshButton.addEventListener('click', loadReceipts);

    await loadReceipts();
  }

  rootShell.register('views.receiptsAdmin', {
    render,
    mount,
  });
}(window));
