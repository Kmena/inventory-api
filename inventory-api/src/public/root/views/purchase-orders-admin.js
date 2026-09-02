(function attachRootShellPurchaseOrdersAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const purchaseOrdersApi = rootShell.require('purchaseOrdersApi');
  const rootShellUi = rootShell.require('ui');
  const renderers = rootShell.require('views.purchaseOrdersAdminRenderers');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Órdenes de compra</h2>
        <p class="muted">Consulta las órdenes de compra emitidas y gestiona la recepción de mercancía.</p>
      </section>

      <dialog id="po-cancel-dialog" class="modal-card" aria-labelledby="po-cancel-dialog-title">
        <div class="page-header">
          <div>
            <h3 id="po-cancel-dialog-title">Cancelar orden de compra</h3>
            <p class="muted" id="po-cancel-dialog-subtitle">¿Qué deseas hacer con esta orden?</p>
          </div>
          <button id="po-cancel-dialog-close" class="secondary-button" type="button" aria-label="Cerrar">Cerrar</button>
        </div>
        <div id="po-cancel-dialog-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <div class="detail-grid" id="po-cancel-dialog-info"></div>
          <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1rem;">
            <button id="po-cancel-reopen-button" type="button">
              Cancelar OC y reabrir solicitud para hacer cambios
            </button>
            <button id="po-cancel-only-button" class="secondary-button" type="button" style="color:#b91c1c;">
              Solo cancelar la OC (sin reabrir la solicitud)
            </button>
          </div>
          <p class="muted" style="font-size:0.8rem;margin-top:0.75rem;">
            <strong>Cancelar y reabrir:</strong> te permite volver a Cotizaciones y crear la selección correcta desde cero.<br/>
            <strong>Solo cancelar:</strong> la solicitud queda cerrada; tendrías que crear una nueva solicitud si necesitás pedir ese producto.
          </p>
        </div>
      </dialog>

      <section class="routes-page" id="purchase-orders-page">
        <div id="purchase-orders-page-message"></div>

        <div class="commercial-layout commercial-layout--rfq-tracking" id="purchase-orders-layout">

          <article class="card root-card commercial-list-card" id="purchase-orders-sidebar">
            <div class="page-header">
              <div>
                <h3>Órdenes de compra</h3>
                <p id="purchase-orders-list-summary" class="muted">Cargando órdenes...</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="purchase-orders-refresh-button" class="secondary-button" type="button">Actualizar</button>
              </div>
            </div>
            <div
              id="purchase-orders-list-region"
              class="rfq-tracking-sidebar-list"
              role="list"
              aria-live="polite"
              aria-label="Órdenes de compra"
            ></div>
          </article>

          <article
            class="card root-card commercial-detail-card"
            id="purchase-orders-detail-panel"
            aria-live="polite"
            aria-label="Detalle de la orden de compra seleccionada"
          >
            <div id="purchase-orders-detail-region">
              <p class="empty-state">Selecciona una orden de compra para ver el detalle.</p>
            </div>
          </article>

        </div>
      </section>
    `;
  }

  async function mount(container, session, _helpersBag) {

    const pageMessage = container.querySelector('#purchase-orders-page-message');
    const listSummary = container.querySelector('#purchase-orders-list-summary');
    const listRegion = container.querySelector('#purchase-orders-list-region');
    const detailRegion = container.querySelector('#purchase-orders-detail-region');
    const refreshButton = container.querySelector('#purchase-orders-refresh-button');

    let orders = [];
    let selectedOrderId = null;

    async function loadOrders() {
      listRegion.innerHTML = '<p class="empty-state">Cargando órdenes...</p>';
      detailRegion.innerHTML = '<p class="empty-state">Selecciona una orden de compra para ver el detalle.</p>';
      pageMessage.innerHTML = '';

      try {
        orders = await purchaseOrdersApi.listOrders(session);
        renderList();
        listSummary.textContent = `${orders.length} orden(es) de compra`;
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudieron cargar las órdenes.</p>';
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al cargar órdenes de compra.',
          'error',
        );
        listSummary.textContent = 'Error al cargar órdenes.';
      }
    }

    function renderList() {
      listRegion.innerHTML = renderers.renderOrderList(orders, selectedOrderId);
      bindListItems();
    }

    function bindListItems() {
      listRegion.querySelectorAll('[data-order-id]').forEach((item) => {
        item.addEventListener('click', () => selectOrder(item.getAttribute('data-order-id')));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectOrder(item.getAttribute('data-order-id'));
          }
        });
      });
    }

    function selectOrder(orderId) {
      selectedOrderId = orderId;
      const order = orders.find((o) => String(o.id) === String(orderId));
      renderList();
      renderDetail(order);
    }

    function renderDetail(order) {
      detailRegion.innerHTML = renderers.renderOrderDetail(order);
      bindDetailActions(order);
    }

    function bindDetailActions(order) {
      const issueBtn = detailRegion.querySelector('#po-issue-button');
      if (issueBtn) {
        issueBtn.addEventListener('click', async () => {
          issueBtn.disabled = true;
          issueBtn.textContent = 'Emitiendo...';
          pageMessage.innerHTML = '';
          try {
            await purchaseOrdersApi.issueOrder(session, order.id);
            await loadOrders();
          } catch (error) {
            pageMessage.innerHTML = rootShellUi.renderInlineMessage(
              error.message || 'No se pudo emitir la orden.', 'error',
            );
            issueBtn.disabled = false;
            issueBtn.textContent = 'Emitir orden de compra';
          }
        });
      }

      const cancelBtn = detailRegion.querySelector('#po-cancel-button');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => openCancelDialog(order));
      }
    }

    function openCancelDialog(order) {
      const dialog = container.querySelector('#po-cancel-dialog');
      const infoRegion = container.querySelector('#po-cancel-dialog-info');
      const msgRegion = container.querySelector('#po-cancel-dialog-message');
      const reopenBtn = container.querySelector('#po-cancel-reopen-button');
      const onlyBtn = container.querySelector('#po-cancel-only-button');
      const closeBtn = container.querySelector('#po-cancel-dialog-close');
      if (!dialog) return;

      msgRegion.innerHTML = '';
      infoRegion.innerHTML = `
        <div class="detail-item"><span>OC</span><strong>#${rootShellUi.escapeHtml(String(order.id))}</strong></div>
        <div class="detail-item"><span>Proveedor</span><strong>${rootShellUi.escapeHtml(order.supplier?.name || '—')}</strong></div>
        <div class="detail-item"><span>Estado actual</span><strong>${rootShellUi.escapeHtml(order.status || '—')}</strong></div>
      `;

      async function executeCancelOrder(reopen) {
        reopenBtn.disabled = true;
        onlyBtn.disabled = true;
        msgRegion.innerHTML = '';
        try {
          await purchaseOrdersApi.cancelOrder(session, order.id, { reopen });
          dialog.close();
          const msg = reopen
            ? `OC #${order.id} cancelada y solicitud reabierta — volvé a Cotizaciones para corregir la selección.`
            : `OC #${order.id} cancelada.`;
          pageMessage.innerHTML = rootShellUi.renderInlineMessage(msg, 'success');
          await loadOrders();
        } catch (error) {
          msgRegion.innerHTML = rootShellUi.renderInlineMessage(
            error.message || 'No se pudo cancelar la orden.', 'error',
          );
        } finally {
          reopenBtn.disabled = false;
          onlyBtn.disabled = false;
        }
      }

      // Bind once per dialog open using one-time cloned nodes to avoid listener stacking
      const newReopenBtn = reopenBtn.cloneNode(true);
      const newOnlyBtn = onlyBtn.cloneNode(true);
      reopenBtn.replaceWith(newReopenBtn);
      onlyBtn.replaceWith(newOnlyBtn);
      newReopenBtn.addEventListener('click', () => executeCancelOrder(true));
      newOnlyBtn.addEventListener('click', () => executeCancelOrder(false));
      closeBtn.onclick = () => dialog.close();

      dialog.showModal();
    }

    refreshButton.addEventListener('click', loadOrders);

    await loadOrders();
  }

  rootShell.register('views.purchaseOrdersAdmin', {
    render,
    mount,
  });
}(window));
