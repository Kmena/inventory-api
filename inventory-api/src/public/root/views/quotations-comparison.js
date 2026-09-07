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

    // Quotations in flight — kept for matrix recompute on radio change
    let currentRespondedQuotations = [];

    async function loadComparisonData(requestId) {
      currentPurchaseRequestId = requestId;
      tableRegion.innerHTML = '<p class="empty-state">Cargando cotizaciones...</p>';
      messageEl.innerHTML = '';

      try {
        const data = await quotationsApi.getComparisonData(session, requestId);
        const quotations = Array.isArray(data.quotations) ? data.quotations : [];
        const activeOrderedProductIds = new Set(data.activeOrderedProductIds || []);

        if (!quotations.length) {
          section.hidden = true;
          return;
        }

        const responded = quotations.filter((q) => q.responseSource);
        const catalogOnly = quotations.filter((q) => !q.responseSource);
        currentRespondedQuotations = responded;

        section.removeAttribute('hidden');
        const parts = [];
        if (responded.length) parts.push(`${responded.length} con respuesta`);
        if (catalogOnly.length) parts.push(`${catalogOnly.length} solo precio histórico`);
        summaryEl.textContent = parts.join(' · ');

        if (responded.length >= 2) {
          // Multiple suppliers → show product matrix for line-level selection
          const hasLocked = activeOrderedProductIds.size > 0;
          const lockedBanner = hasLocked
            ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:0.6rem 0.75rem;margin-bottom:0.75rem;font-size:0.82rem;">
                ⚠️ Las filas en gris ya tienen una OC activa — no se pueden volver a seleccionar para evitar duplicados.
               </div>`
            : '';
          tableRegion.innerHTML = `
            <p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem;">Seleccioná el proveedor más conveniente por cada línea de producto. El precio más bajo está pre-seleccionado en verde.</p>
            ${lockedBanner}
            ${renderers.renderProductMatrix(responded, activeOrderedProductIds)}
            ${catalogOnly.length ? '<div style="margin-top:1.5rem;">' + buildCatalogSection(catalogOnly) + '</div>' : ''}
          `;
          updateMatrixFooter();
          bindMatrixRadios();
        } else {
          // Single supplier or all catalog → keep the simple table.
          // Pass activeOrderedProductIds so already-covered quotations show "OC generada" en vez del botón.
          tableRegion.innerHTML = renderers.renderComparisonTable(quotations, activeOrderedProductIds);
          bindSelectButtons();
        }
      } catch (_error) {
        section.hidden = true;
      }
    }

    function buildCatalogSection(catalogQuotations) {
      return `
        <h4 style="margin:0 0 0.5rem;">Precio histórico de catálogo</h4>
        <p class="muted" style="font-size:0.82rem;margin:0 0 0.75rem;">Sin respuesta confirmada del proveedor para esta solicitud.</p>
        ${renderers.renderComparisonTable(catalogQuotations)}
      `;
    }

    /** Recompute subtotals from current radio state and refresh the matrix footer. */
    function updateMatrixFooter() {
      const matrixFooter = tableRegion.querySelector('#quotations-matrix-footer');
      if (!matrixFooter) return;

      // Aggregate selected lines by quotation (skip locked/disabled rows)
      const byQuotation = new Map(); // quotationId → { supplierName, currency, totalAmount, itemCount }
      const radios = tableRegion.querySelectorAll('.quotations-matrix-radio:checked:not([disabled])');
      radios.forEach((radio) => {
        const qid = radio.getAttribute('data-quotation-id');
        const qty = Number(radio.getAttribute('data-quantity') || 0);
        const up = Number(radio.getAttribute('data-unit-price') || 0);
        const currency = radio.getAttribute('data-currency') || 'CRC';
        const q = currentRespondedQuotations.find((r) => String(r.id) === qid);
        if (!q) return;
        if (!byQuotation.has(qid)) {
          byQuotation.set(qid, { supplierName: q.supplier?.name || q.supplierName || '—', currency, totalAmount: 0, itemCount: 0 });
        }
        const entry = byQuotation.get(qid);
        entry.totalAmount += qty * up;
        entry.itemCount += 1;
      });

      matrixFooter.innerHTML = renderers.renderMatrixFooter([...byQuotation.values()]);
      const confirmBtn = matrixFooter.querySelector('#quotations-confirm-mixed-button');
      if (confirmBtn) confirmBtn.addEventListener('click', openMixedConfirmDialog);
    }

    function bindMatrixRadios() {
      tableRegion.querySelectorAll('.quotations-matrix-radio').forEach((radio) => {
        radio.addEventListener('change', updateMatrixFooter);
      });
    }

    // Exponer el loader para que modulos externos puedan refrescar
    _refreshRef = loadComparisonData;

    function bindSelectButtons() {
      tableRegion.querySelectorAll('.quotations-select-supplier-button').forEach((btn) => {
        btn.addEventListener('click', () => openSelectConfirmDialog(btn));
      });
    }

    function openMixedConfirmDialog() {
      if (!canManage) return;
      // Build a summary of the current matrix selection (skip locked/disabled rows)
      const lines = [];
      tableRegion.querySelectorAll('.quotations-matrix-radio:checked:not([disabled])').forEach((radio) => {
        lines.push({
          productId: radio.getAttribute('data-product-id'),
          quotationId: radio.getAttribute('data-quotation-id'),
          quantity: Number(radio.getAttribute('data-quantity') || 0),
          unitPrice: Number(radio.getAttribute('data-unit-price') || 0),
        });
      });
      if (!lines.length) return;

      // Reuse the select-confirm dialog with mixed context
      currentSelectionContext = { mixed: true, lines };
      const totalAll = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const firstQ = currentRespondedQuotations.find((q) => String(q.id) === lines[0].quotationId);
      const currency = firstQ?.currency || 'CRC';
      const supplierCount = new Set(lines.map((l) => l.quotationId)).size;
      selectConfirmSupplier.textContent = `${supplierCount} proveedor(es) — selección mixta`;
      selectConfirmAmount.textContent = renderers.formatCurrency(totalAll, currency);
      selectJustification.value = '';
      selectConfirmMessage.innerHTML = '';
      selectConfirmSubmit.disabled = false;
      selectConfirmSubmit.textContent = 'Confirmar selección mixta';
      selectConfirmDialog.showModal();
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
        if (currentSelectionContext.mixed) {
          // Mixed-supplier flow: send all lines grouped by quotation
          const result = await quotationsApi.selectMixedItems(session, currentPurchaseRequestId, {
            justification,
            items: currentSelectionContext.lines,
          });
          currentSelectionResult = result;
          selectConfirmDialog.close();
          if (result.requiresApproval) {
            const firstSel = result.selections[0];
            renderApprovalBanner(canApprove, firstSel?.id);
          } else {
            openCreatePoDialogMixed(result.selections);
          }
          return;
        }

        // Single-supplier flow (unchanged)
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

    // FR-008, FR-009: Render approval banner listing ALL pending selections
    function renderApprovalBanner(canApproveFlag, selectionIdOrSelections) {
      const esc = rootShellUi.escapeHtml;

      // Derive the full list of pending selections from currentSelectionResult
      let pendingSelections = [];
      if (currentSelectionResult?.selections) {
        pendingSelections = currentSelectionResult.selections.filter(
          (s) => s.requiresApproval || s.approvalRequired,
        );
      }
      if (pendingSelections.length === 0 && selectionIdOrSelections) {
        // Fallback: single selection
        pendingSelections = [{ id: selectionIdOrSelections }];
      }

      const selectionList = pendingSelections.map((sel) => {
        const selId = esc(String(sel.id || ''));
        const supplierName = esc(sel.supplierName || sel.supplier?.name || '—');
        const amount = sel.totalAmount ?? sel.amount ?? '—';
        const individualBtn = canApproveFlag
          ? `<button type="button" class="secondary-button quotations-approve-individual-btn" data-selection-id="${selId}" style="font-size:0.82rem;">Aprobar</button>`
          : '';
        return `
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid #fde68a;">
            <span style="flex:1;">${supplierName} — ${esc(String(amount))}</span>
            ${individualBtn}
          </div>`;
      }).join('');

      const approveAllBtn = canApproveFlag && pendingSelections.length > 0
        ? `<button type="button" id="quotations-approve-all-selections-button" style="margin-top:0.75rem;">Aprobar todas (${pendingSelections.length})</button>`
        : '';

      messageEl.innerHTML = `
        <div class="message warning approval-banner" role="status" aria-live="polite">
          <p style="margin:0 0 0.5rem;font-weight:600;">Selecciones pendientes de aprobación (${pendingSelections.length})</p>
          <p class="muted" style="margin:0 0 0.5rem;font-size:0.84rem;">Estas selecciones requieren aprobación gerencial antes de generar las órdenes de compra.</p>
          ${selectionList}
          ${approveAllBtn}
        </div>
      `;

      if (canApproveFlag) {
        // Individual approve buttons
        messageEl.querySelectorAll('.quotations-approve-individual-btn').forEach((btn) => {
          btn.addEventListener('click', () => submitApproveSelection(btn.getAttribute('data-selection-id'), btn));
        });

        // Approve-all button (sequential)
        const approveAll = messageEl.querySelector('#quotations-approve-all-selections-button');
        if (approveAll) {
          approveAll.addEventListener('click', () => submitApproveAllSelections(pendingSelections));
        }
      }
    }

    async function submitApproveSelection(selectionId, btn) {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Aprobando...';
      }

      try {
        await quotationsApi.approveSelection(session, selectionId, {});
        if (btn) {
          btn.textContent = '✓ Aprobada';
          btn.style.color = '#166534';
        }
      } catch (error) {
        if (btn) {
          btn.textContent = 'Error';
          btn.disabled = false;
          btn.title = error.message || 'No se pudo aprobar.';
        }
      }
    }

    async function submitApproveAllSelections(selections) {
      const approveAllBtn = messageEl.querySelector('#quotations-approve-all-selections-button');
      if (approveAllBtn) {
        approveAllBtn.disabled = true;
        approveAllBtn.textContent = 'Aprobando todas...';
      }

      let allSuccess = true;
      for (const sel of selections) {
        const individualBtn = messageEl.querySelector(`[data-selection-id="${sel.id}"]`);
        try {
          await quotationsApi.approveSelection(session, sel.id, {});
          if (individualBtn) {
            individualBtn.textContent = '✓ Aprobada';
            individualBtn.style.color = '#166534';
            individualBtn.disabled = true;
          }
        } catch (error) {
          allSuccess = false;
          if (individualBtn) {
            individualBtn.textContent = 'Error';
            individualBtn.title = error.message || 'No se pudo aprobar.';
          }
        }
      }

      if (approveAllBtn) {
        approveAllBtn.textContent = allSuccess ? '✓ Todas aprobadas' : 'Aprobación parcial';
      }

      // After all approvals, open PO creation if all succeeded
      if (allSuccess && currentSelectionResult) {
        if (currentSelectionResult.selections) {
          openCreatePoDialogMixed(currentSelectionResult.selections);
        } else if (currentSelectionResult.single) {
          openCreatePoDialog(currentSelectionResult.single);
        }
      }
    }

    function openCreatePoDialog(selection) {
      const items = selection?.quotation?.items || [];
      createPoSummaryRegion.innerHTML = renderers.renderCreatePoSummary(selection, items);
      createPoNotes.value = '';
      createPoMessage.innerHTML = '';
      createPoSubmit.disabled = false;
      createPoSubmit.textContent = 'Crear orden de compra';
      currentSelectionResult = { single: selection };
      createPoDialog.showModal();
    }

    /** Opens the PO creation dialog for a mixed-supplier result (N selections → N POs). */
    function openCreatePoDialogMixed(selections) {
      // Build a combined summary showing each supplier + their assigned items
      const combinedHtml = selections.map((sel) => {
        const items = sel.assignedItems || [];
        return renderers.renderCreatePoSummary(sel, items);
      }).join('<hr style="margin:1rem 0;"/>');

      createPoSummaryRegion.innerHTML = combinedHtml;
      createPoNotes.value = '';
      createPoMessage.innerHTML = '';
      createPoSubmit.disabled = false;
      createPoSubmit.textContent = `Crear ${selections.length} orden(es) de compra`;
      currentSelectionResult = { mixed: selections };
      createPoDialog.showModal();
    }

    // FR-003, FR-004, FR-005, FR-006, FR-007: Persistent success state after PO creation
    function renderCreatedPoSuccessState(createdOrders) {
      const esc = rootShellUi.escapeHtml;
      const canIssue = sessionAdapter.hasPermission(session, 'procurement.manage');

      const orderCards = (Array.isArray(createdOrders) ? createdOrders : [createdOrders]).map((po) => {
        const poId = po?.id || po?.purchaseOrderId || '—';
        const supplierName = po?.supplier?.name || po?.supplierName || '—';
        const total = po?.totalAmount ?? po?.total ?? '—';
        const currency = po?.currency || 'CRC';

        const issueAction = canIssue
          ? `<button type="button" class="po-success-action" data-action="issue" data-po-id="${esc(String(poId))}" style="background:var(--color-success,#16A34A);color:#fff">Emitir OC #${esc(String(poId))}</button>`
          : '';

        return `
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;padding:0.75rem 0;border-bottom:1px solid #e5e7eb;">
            <div style="flex:1;min-width:150px;">
              <strong>OC #${esc(String(poId))}</strong>
              <span class="muted" style="margin-left:0.5rem;">${esc(supplierName)}</span>
              <span class="muted" style="margin-left:0.5rem;">${esc(String(total))} ${esc(currency)}</span>
            </div>
            <div class="action-row compact-action-row">
              ${issueAction}
              <button type="button" class="secondary-button po-success-action" data-action="view" data-po-id="${esc(String(poId))}">Ver orden de compra</button>
            </div>
          </div>
        `;
      }).join('');

      tableRegion.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:1rem 1.25rem;">
          <p style="margin:0 0 0.75rem;font-weight:600;font-size:1rem;color:#166534;">✓ Orden(es) de compra creada(s) correctamente</p>
          ${orderCards}
          <div style="margin-top:1rem;">
            <button type="button" class="secondary-button po-success-action" data-action="back-to-requests">Volver a solicitudes</button>
          </div>
        </div>
      `;

      tableRegion.querySelectorAll('.po-success-action').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          if (action === 'view' || action === 'issue') {
            window.location.hash = '#ordenes_compra';
          } else if (action === 'back-to-requests') {
            window.location.hash = '#solicitudes_compra';
          }
        });
      });
    }

    async function submitCreatePurchaseOrder() {
      if (!currentSelectionResult || !currentPurchaseRequestId) return;

      const notes = createPoNotes.value.trim() || null;
      createPoSubmit.disabled = true;
      createPoMessage.innerHTML = '';

      try {
        let createdOrders;
        let requestStatus = 'CLOSED';
        if (currentSelectionResult.mixed) {
          // Batch: one request, one transaction, request closed once at the end.
          createPoSubmit.textContent = 'Creando órdenes...';
          const result = await quotationsApi.createPurchaseOrdersBatch(session, currentPurchaseRequestId, {
            notes,
            orders: currentSelectionResult.mixed.map((sel) => ({
              selectionId: sel.id,
              items: sel.assignedItems,
            })),
          });
          createdOrders = result?.purchaseOrders || result?.orders || (Array.isArray(result) ? result : [result]);
          requestStatus = result?.requestStatus || 'CLOSED';
        } else {
          createPoSubmit.textContent = 'Creando orden...';
          const result = await quotationsApi.createPurchaseOrder(session, currentPurchaseRequestId, {
            selectionId: currentSelectionResult.single.id,
            notes,
          });
          createdOrders = [result];
          requestStatus = result?.requestStatus || 'CLOSED';
        }

        createPoDialog.close();
        messageEl.innerHTML = '';
        setShellStatus('Orden(es) de compra creada(s) correctamente.');

        if (requestStatus === 'OPEN') {
          // Partial order: request still has uncovered products.
          // Reload the comparison table so the user can continue selecting
          // providers for the remaining items.
          await refreshForRequest(currentPurchaseRequestId);
          const poSummary = (Array.isArray(createdOrders) ? createdOrders : [createdOrders])
            .map((po) => {
              const supplier = po?.supplier?.name || po?.supplierName || '—';
              return rootShellUi.escapeHtml(supplier);
            })
            .join(', ');
          messageEl.innerHTML = rootShellUi.renderInlineMessage(
            `✓ Orden(es) de compra creada(s) para ${poSummary}. La solicitud sigue abierta — seleccioná proveedor para los productos restantes.`,
            'success',
          );
        } else {
          // All products covered: show the persistent success state.
          renderCreatedPoSuccessState(createdOrders);
        }
      } catch (error) {
        const msg = error.message || 'Error al crear la(s) orden(es) de compra.';
        // Scroll the dialog to top so the error is visible
        createPoMessage.innerHTML = rootShellUi.renderInlineMessage(msg, 'error');
        createPoMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } finally {
        createPoSubmit.disabled = false;
        createPoSubmit.textContent = 'Crear orden(es) de compra';
      }
    }
  }

  rootShell.register('views.quotationsComparison', {
    mountComparisonSection,
    refreshForRequest,
  });
}(window));
