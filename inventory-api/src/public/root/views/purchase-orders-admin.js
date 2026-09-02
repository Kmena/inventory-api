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
            <p class="muted">Revisá el impacto antes de confirmar.</p>
          </div>
          <button id="po-cancel-dialog-close" class="secondary-button" type="button" aria-label="Cerrar">Cerrar</button>
        </div>
        <div id="po-cancel-dialog-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <div class="detail-grid" id="po-cancel-dialog-info"></div>
          <div id="po-cancel-dialog-siblings"></div>
          <div id="po-cancel-dialog-actions" style="display:flex;flex-direction:column;gap:0.75rem;margin-top:1rem;"></div>
          <p id="po-cancel-dialog-hint" class="muted" style="font-size:0.8rem;margin-top:0.75rem;"></p>
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
      const siblingsRegion = container.querySelector('#po-cancel-dialog-siblings');
      const actionsRegion = container.querySelector('#po-cancel-dialog-actions');
      const hintRegion = container.querySelector('#po-cancel-dialog-hint');
      const msgRegion = container.querySelector('#po-cancel-dialog-message');
      const closeBtn = container.querySelector('#po-cancel-dialog-close');
      if (!dialog) return;

      // Siblings: other active (non-cancelled) OCs for the same purchase request
      const siblings = orders.filter((o) =>
        String(o.purchaseRequestId) === String(order.purchaseRequestId) &&
        String(o.id) !== String(order.id) &&
        o.status !== 'CANCELLED',
      );
      const hasSiblings = siblings.length > 0;

      msgRegion.innerHTML = '';

      infoRegion.innerHTML = `
        <div class="detail-item"><span>OC a cancelar</span>
          <strong>OC #${rootShellUi.escapeHtml(String(order.id))} · ${rootShellUi.escapeHtml(order.supplier?.name || '—')}</strong>
        </div>
        <div class="detail-item"><span>Estado</span><strong>${rootShellUi.escapeHtml(order.status || '—')}</strong></div>
      `;

      siblingsRegion.innerHTML = hasSiblings ? `
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:0.75rem;margin-top:0.75rem;">
          <p style="margin:0 0 0.4rem;font-weight:600;font-size:0.85rem;">⚠️ Esta solicitud tiene ${siblings.length} OC(s) relacionada(s):</p>
          ${siblings.map((s) => `<p style="margin:0.2rem 0;font-size:0.82rem;">OC #${rootShellUi.escapeHtml(String(s.id))} · ${rootShellUi.escapeHtml(s.supplier?.name || '—')} · ${rootShellUi.escapeHtml(s.status)}</p>`).join('')}
        </div>
      ` : '';

      // Build actions dynamically based on context
      const actions = [];

      if (hasSiblings) {
        actions.push({ id: 'btn-cancel-all', label: `Cancelar TODAS las OCs de esta solicitud y reabrir para hacer cambios`, primary: true, handler: 'cancelAll' });
        actions.push({ id: 'btn-cancel-one-reopen', label: `Cancelar solo OC #${order.id} y reabrir solicitud`, primary: false, danger: false, handler: 'cancelOneReopen' });
        actions.push({ id: 'btn-cancel-one', label: `Cancelar solo OC #${order.id} (OC #${siblings.map((s) => s.id).join(', #')} sigue activa)`, primary: false, danger: true, handler: 'cancelOne' });

        const siblingNames = siblings.map((s) => `OC #${s.id} (${s.supplier?.name || '—'})`).join(', ');
        hintRegion.innerHTML =
          '<strong>Cancelar todas:</strong> limpia la selección mixta completa. Podés rehacer la selección desde cero sin riesgo de duplicados.<br/>' +
          `<strong>Cancelar solo esta y reabrir:</strong> ${siblingNames} sigue activa en DRAFT. ` +
          'Al volver a Cotizaciones <u>seleccioná únicamente los productos del proveedor que cancelaste</u> — si confirmás ' +
          'toda la matriz crearás una OC duplicada para el proveedor que ya tiene OC activa.<br/>' +
          '<strong>Cancelar sin reabrir:</strong> la solicitud queda cerrada.';
      } else {
        actions.push({ id: 'btn-cancel-reopen', label: 'Cancelar OC y reabrir solicitud para hacer cambios', primary: true, handler: 'cancelOneReopen' });
        actions.push({ id: 'btn-cancel-only', label: 'Solo cancelar la OC (la solicitud queda cerrada)', primary: false, danger: true, handler: 'cancelOne' });

        hintRegion.innerHTML =
          '<strong>Cancelar y reabrir:</strong> podés volver a Cotizaciones y rehacer la selección.<br/>' +
          '<strong>Solo cancelar:</strong> la solicitud queda cerrada; necesitarías crear una nueva si querés pedir ese producto.';
      }

      actionsRegion.innerHTML = actions.map((a) => `
        <button
          id="${rootShellUi.escapeHtml(a.id)}"
          type="button"
          class="${a.primary ? '' : 'secondary-button'}"
          style="${a.danger ? 'color:#b91c1c;' : ''}"
        >${rootShellUi.escapeHtml(a.label)}</button>
      `).join('');

      async function runAction(handler) {
        actionsRegion.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        msgRegion.innerHTML = '';
        try {
          if (handler === 'cancelAll') {
            await purchaseOrdersApi.cancelAllOrdersForRequest(session, order.purchaseRequestId);
            dialog.close();
            pageMessage.innerHTML = rootShellUi.renderInlineMessage(
              `Todas las OCs de la solicitud canceladas. La solicitud fue reabierta — volvé a Cotizaciones para rehacer la selección.`,
              'success',
            );
          } else if (handler === 'cancelOneReopen') {
            await purchaseOrdersApi.cancelOrder(session, order.id, { reopen: true });
            dialog.close();
            pageMessage.innerHTML = rootShellUi.renderInlineMessage(
              `OC #${order.id} cancelada y solicitud reabierta.`,
              'success',
            );
          } else {
            await purchaseOrdersApi.cancelOrder(session, order.id, { reopen: false });
            dialog.close();
            pageMessage.innerHTML = rootShellUi.renderInlineMessage(`OC #${order.id} cancelada.`, 'success');
          }
          await loadOrders();
        } catch (error) {
          msgRegion.innerHTML = rootShellUi.renderInlineMessage(
            error.message || 'No se pudo cancelar.', 'error',
          );
          actionsRegion.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        }
      }

      actions.forEach((a) => {
        actionsRegion.querySelector(`#${a.id}`)?.addEventListener('click', () => runAction(a.handler));
      });

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
