(function attachRootShellQuotationsComparisonView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const quotationsApi = rootShell.require('quotationsApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const renderers = rootShell.require('views.quotationsComparisonRenderers');

  function buildSectionHtml() {
    return `
      <article class="card root-card" id="quotations-comparison-section" hidden>
        <div class="page-header">
          <div>
            <h3>Comparación de cotizaciones</h3>
            <p id="quotations-comparison-summary" class="muted">Proveedores con respuesta · ordenados por precio total ascendente</p>
          </div>
        </div>
        <div id="quotations-comparison-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <div id="quotations-comparison-table-region" aria-live="polite"></div>
        </div>
      </article>

      <dialog id="quotations-select-confirm-dialog" class="modal-card" aria-labelledby="quotations-select-confirm-title">
        <div class="page-header">
          <div>
            <h3 id="quotations-select-confirm-title">Confirmar selección de proveedor</h3>
            <p class="muted">Revisa los datos antes de confirmar.</p>
          </div>
          <button id="quotations-select-confirm-close-button" class="secondary-button" type="button" aria-label="Cerrar">Cerrar</button>
        </div>
        <div id="quotations-select-confirm-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <div class="detail-grid">
            <div class="detail-item">
              <span>Proveedor</span>
              <strong id="quotations-select-confirm-supplier">—</strong>
            </div>
            <div class="detail-item">
              <span>Monto total</span>
              <strong id="quotations-select-confirm-amount">—</strong>
            </div>
          </div>
          <fieldset class="root-form__section">
            <legend>Justificación</legend>
            <div class="root-form-grid">
              <label>
                <span>Justificación (opcional)</span>
                <textarea id="quotations-select-justification" name="justification" maxlength="2000" rows="4" placeholder="Describe el criterio de selección si aplica (máx. 2000 caracteres)"></textarea>
              </label>
            </div>
          </fieldset>
        </div>
        <div class="action-row">
          <button id="quotations-select-confirm-submit-button" type="button">Confirmar selección</button>
          <button id="quotations-select-confirm-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>

      <dialog id="quotations-create-po-dialog" class="modal-card" aria-labelledby="quotations-create-po-title">
        <div class="page-header">
          <div>
            <h3 id="quotations-create-po-title">Crear orden de compra</h3>
            <p class="muted">Revisa el resumen antes de generar la orden.</p>
          </div>
          <button id="quotations-create-po-close-button" class="secondary-button" type="button" aria-label="Cerrar">Cerrar</button>
        </div>
        <div id="quotations-create-po-message" role="status" aria-live="polite"></div>
        <div class="stack-section">
          <h4>Resumen de la orden</h4>
          <div id="quotations-create-po-summary-region"></div>
          <fieldset class="root-form__section">
            <legend>Notas</legend>
            <div class="root-form-grid">
              <label>
                <span>Notas (opcional)</span>
                <textarea id="quotations-create-po-notes" name="notes" maxlength="2000" rows="3" placeholder="Instrucciones adicionales para el proveedor o el almacén (máx. 2000 caracteres)"></textarea>
              </label>
            </div>
          </fieldset>
        </div>
        <div class="action-row">
          <button id="quotations-create-po-submit-button" type="button">Crear orden de compra</button>
          <button id="quotations-create-po-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>
    `;
  }

  // Referencia al loader interno; se asigna una vez montado el modulo
  let _refreshRef = null;

  /**
   * Recarga la seccion de comparacion para el purchaseRequestId dado.
   * Sirve para actualizarla despues de registrar una cotizacion directa.
   */
  async function refreshForRequest(requestId) {
    if (typeof _refreshRef === 'function') {
      await _refreshRef(requestId);
    }
  }

  async function mountComparisonSection(container, session, purchaseRequestId, helpersBag) {
    const setShellStatus = typeof helpersBag?.setShellStatus === 'function' ? helpersBag.setShellStatus : () => {};
    const canManage = sessionAdapter.hasPermission(session, 'procurement.manage');
    const canApprove = sessionAdapter.hasPermission(session, 'procurement.approve');

    // Inject the comparison section HTML into the container
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildSectionHtml();
    while (wrapper.firstChild) {
      container.appendChild(wrapper.firstChild);
    }

    // DOM references
    const section = container.querySelector('#quotations-comparison-section');
    const summaryEl = container.querySelector('#quotations-comparison-summary');
    const messageEl = container.querySelector('#quotations-comparison-message');
    const tableRegion = container.querySelector('#quotations-comparison-table-region');

    const selectConfirmDialog = container.querySelector('#quotations-select-confirm-dialog');
    const selectConfirmMessage = container.querySelector('#quotations-select-confirm-message');
    const selectConfirmSupplier = container.querySelector('#quotations-select-confirm-supplier');
    const selectConfirmAmount = container.querySelector('#quotations-select-confirm-amount');
    const selectJustification = container.querySelector('#quotations-select-justification');
    const selectConfirmSubmit = container.querySelector('#quotations-select-confirm-submit-button');
    const selectConfirmClose = container.querySelector('#quotations-select-confirm-close-button');
    const selectConfirmCancel = container.querySelector('#quotations-select-confirm-cancel-button');

    const createPoDialog = container.querySelector('#quotations-create-po-dialog');
    const createPoMessage = container.querySelector('#quotations-create-po-message');
    const createPoSummaryRegion = container.querySelector('#quotations-create-po-summary-region');
    const createPoNotes = container.querySelector('#quotations-create-po-notes');
    const createPoSubmit = container.querySelector('#quotations-create-po-submit-button');
    const createPoClose = container.querySelector('#quotations-create-po-close-button');
    const createPoCancel = container.querySelector('#quotations-create-po-cancel-button');

    // Module state
    let currentPurchaseRequestId = purchaseRequestId || null;
    let currentSelectionContext = null;
    let currentSelectionResult = null;
    let lastSelectButton = null;

    // Dialog close handlers
    selectConfirmClose.addEventListener('click', () => selectConfirmDialog.close());
    selectConfirmCancel.addEventListener('click', () => selectConfirmDialog.close());
    selectConfirmDialog.addEventListener('close', () => {
      if (lastSelectButton) lastSelectButton.focus();
      lastSelectButton = null;
    });

    createPoClose.addEventListener('click', () => createPoDialog.close());
    createPoCancel.addEventListener('click', () => createPoDialog.close());

    // Confirm submit — implemented in TASK-003; placeholder prevents accidental submission
    selectConfirmSubmit.addEventListener('click', submitSelectionConfirmation);

    // Create PO submit — implemented in TASK-003
    createPoSubmit.addEventListener('click', submitCreatePurchaseOrder);

    // Load comparison data if a purchase request is known
    if (currentPurchaseRequestId) {
      await loadComparisonData(currentPurchaseRequestId);
    }

    async function loadComparisonData(requestId) {
      currentPurchaseRequestId = requestId;
      tableRegion.innerHTML = '<p class="empty-state">Cargando cotizaciones...</p>';
      messageEl.innerHTML = '';

      try {
        const data = await quotationsApi.getComparisonData(session, requestId);
        const quotations = Array.isArray(data.quotations) ? data.quotations : [];

        if (!quotations.length) {
          section.hidden = true;
          return;
        }

        section.removeAttribute('hidden');
        summaryEl.textContent = `${quotations.length} proveedor(es) con respuesta · ordenados por precio total ascendente`;
        tableRegion.innerHTML = renderers.renderComparisonTable(quotations);
        bindSelectButtons();
      } catch (_error) {
        section.hidden = true;
      }
    }

    // Exponer el loader para que modulos externos puedan refrescar
    _refreshRef = loadComparisonData;

    function bindSelectButtons() {
      tableRegion.querySelectorAll('.quotations-select-supplier-button').forEach((btn) => {
        btn.addEventListener('click', () => openSelectConfirmDialog(btn));
      });
    }

    function openSelectConfirmDialog(btn) {
      if (!canManage) return;
      lastSelectButton = btn;
      currentSelectionContext = {
        quotationId: btn.getAttribute('data-quotation-id'),
        supplierName: btn.getAttribute('data-supplier-name') || '—',
        totalAmount: btn.getAttribute('data-total-amount') || '0',
        currency: btn.getAttribute('data-currency') || 'CRC',
      };

      selectConfirmSupplier.textContent = currentSelectionContext.supplierName;
      selectConfirmAmount.textContent = renderers.formatCurrency(
        currentSelectionContext.totalAmount,
        currentSelectionContext.currency,
      );
      selectJustification.value = '';
      selectConfirmMessage.innerHTML = '';
      selectConfirmSubmit.disabled = false;
      selectConfirmSubmit.textContent = 'Confirmar selección';
      selectConfirmDialog.showModal();
    }

    async function submitSelectionConfirmation() {
      if (!currentSelectionContext || !currentPurchaseRequestId) return;

      const justification = selectJustification.value.trim() || null;
      selectConfirmSubmit.disabled = true;
      selectConfirmSubmit.textContent = 'Confirmando...';
      selectConfirmMessage.innerHTML = '';

      try {
        const result = await quotationsApi.selectQuotation(session, currentPurchaseRequestId, {
          quotationId: currentSelectionContext.quotationId,
          justification,
        });

        currentSelectionResult = result;
        selectConfirmDialog.close();

        if (result.approvalRequired) {
          renderApprovalBanner(canApprove, result.id);
        } else {
          openCreatePoDialog(result);
        }
      } catch (error) {
        selectConfirmMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al confirmar la selección.',
          'error',
        );
      } finally {
        selectConfirmSubmit.disabled = false;
        selectConfirmSubmit.textContent = 'Confirmar selección';
      }
    }

    function renderApprovalBanner(canApproveFlag, selectionId) {
      const safeSelectionId = rootShellUi.escapeHtml(String(selectionId || ''));
      const approveButton = canApproveFlag
        ? `<button
             type="button"
             id="quotations-approve-selection-button"
             class="secondary-button"
             data-selection-id="${safeSelectionId}"
             aria-label="Aprobar selección de proveedor y liberar creación de orden de compra"
           >Aprobar selección</button>`
        : '';

      messageEl.innerHTML = `
        <div
          class="message warning approval-banner"
          role="status"
          aria-live="polite"
        >
          <span>Esta selección requiere aprobación gerencial antes de generar la orden de compra.</span>
          ${approveButton}
        </div>
      `;

      if (canApproveFlag) {
        const approveBtn = messageEl.querySelector('#quotations-approve-selection-button');
        if (approveBtn) {
          approveBtn.addEventListener('click', () => submitApproveSelection(selectionId));
        }
      }
    }

    async function submitApproveSelection(selectionId) {
      const approveBtn = messageEl.querySelector('#quotations-approve-selection-button');
      if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.textContent = 'Aprobando...';
      }
      messageEl.innerHTML = '';

      try {
        await quotationsApi.approveSelection(session, selectionId, {});
        if (currentSelectionResult) {
          openCreatePoDialog(currentSelectionResult);
        }
      } catch (error) {
        messageEl.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al aprobar la selección.',
          'error',
        );
      }
    }

    function openCreatePoDialog(selection) {
      const items = selection?.quotation?.items || [];
      createPoSummaryRegion.innerHTML = renderers.renderCreatePoSummary(selection, items);
      createPoNotes.value = '';
      createPoMessage.innerHTML = '';
      createPoSubmit.disabled = false;
      createPoSubmit.textContent = 'Crear orden de compra';
      currentSelectionResult = selection;
      createPoDialog.showModal();
    }

    async function submitCreatePurchaseOrder() {
      if (!currentSelectionResult || !currentPurchaseRequestId) return;

      const notes = createPoNotes.value.trim() || null;
      createPoSubmit.disabled = true;
      createPoSubmit.textContent = 'Creando orden...';
      createPoMessage.innerHTML = '';

      try {
        await quotationsApi.createPurchaseOrder(session, currentPurchaseRequestId, {
          selectionId: currentSelectionResult.id,
          notes,
        });

        createPoDialog.close();
        messageEl.innerHTML = '';
        section.hidden = true;
        setShellStatus('Orden de compra creada correctamente.');
      } catch (error) {
        createPoMessage.innerHTML = rootShellUi.renderInlineMessage(
          error.message || 'Error al crear la orden de compra.',
          'error',
        );
      } finally {
        createPoSubmit.disabled = false;
        createPoSubmit.textContent = 'Crear orden de compra';
      }
    }
  }

  rootShell.register('views.quotationsComparison', {
    mountComparisonSection,
    refreshForRequest,
  });
}(window));
