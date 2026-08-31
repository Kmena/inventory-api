/**
 * Warehouse SPA — Production rejection/re-execution controller handlers.
 *
 * TASK-007: production-stage-rejection-and-reexecution
 *
 * Extracted from production.controllers.js to keep files ≤ 600 lines.
 * Registers rejection-specific handlers into WarehouseShell.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

/**
 * Attaches the handler for the «Declarar pérdidas y continuar» button.
 * Collects form rows where quantity > 0 and submits to POST .../losses.
 * Then reloads the order to refresh the stage status.
 *
 * @param {HTMLElement} container
 * @param {any} session
 * @param {{ warehouseApi: any, app: any }} deps
 */
function attachStageLossHandlers(container, session, deps) {
  const btn = container.querySelector('.wh-declare-losses-btn');
  if (!btn) { return; }

  btn.addEventListener('click', async () => {
    const section = container.querySelector('.wh-loss-form-section');
    if (!section) { return; }

    const orderId = section.getAttribute('data-order-id');
    const stageId = section.getAttribute('data-stage-id');
    const rows = Array.from(section.querySelectorAll('.wh-loss-row'));

    // Collect loss items where quantity > 0
    const losses = rows
      .map((row) => {
        const productId = row.getAttribute('data-product-id');
        const lotId = row.getAttribute('data-lot-id');
        const qtyInput = row.querySelector('.wh-loss-qty-input');
        const reasonInput = row.querySelector('.wh-loss-reason-input');
        const noteInput = row.querySelector('.wh-loss-note-input');
        const qty = parseFloat(qtyInput?.value || '0');
        const reason = reasonInput?.value?.trim() || '';
        const note = noteInput?.value?.trim() || null;
        return { productId, lotId, quantity: qty, reasonCode: reason, note, _qty: qty };
      })
      .filter((item) => item._qty > 0)
      .map(({ productId, lotId, quantity, reasonCode, note }) => ({
        productId, lotId, quantity, reasonCode, note,
      }));

    // Validate: if any row has quantity > 0, reasonCode is required
    const missingReason = losses.some((l) => !l.reasonCode);
    if (missingReason) {
      deps.app.showToast('La razón de pérdida es obligatoria para filas con cantidad > 0.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
      await deps.warehouseApi.registerStageLosses(session, orderId, stageId, { losses });
      deps.app.showToast('Pérdidas registradas correctamente.');
      // Reload order to refresh stage status (lossesAcknowledged will be true)
      if (typeof deps.app.refreshCurrentOrder === 'function') {
        await deps.app.refreshCurrentOrder();
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Declarar pérdidas y continuar';
      deps.app.showToast(err?.message || 'No se pudieron registrar las pérdidas.');
    }
  });
}

/**
 * Attaches the handler for «Re-ejecutar etapa» button.
 * Opens the execution form (same as first execution).
 *
 * @param {HTMLElement} container
 * @param {any} session
 * @param {{ app: any }} deps
 */
function attachReExecuteHandler(container, session, deps) {
  const btn = container.querySelector('.wh-re-execute-stage-btn');
  if (!btn) { return; }

  btn.addEventListener('click', () => {
    const orderId = btn.getAttribute('data-order-id');
    const stageId = btn.getAttribute('data-stage-id');
    // Open the same execution form used for the first execution.
    if (typeof deps.app.showExecuteStageForm === 'function') {
      deps.app.showExecuteStageForm(orderId, stageId);
    }
  });
}

// ─── Cancel with stock returns ────────────────────────────────────────────────

/**
 * Collects the cancel+returns payload from the rendered panel.
 * Items with quantity = 0 are excluded (server also ignores them).
 * Validates that items with quantity > 0 and mode "new" have a lot code.
 *
 * @param {HTMLElement} panel
 * @returns {{ ok: boolean, payload?: object, errorMessage?: string }}
 */
function collectCancelPayload(panel) {
  const rows = Array.from(panel.querySelectorAll('.wh-cancel-return-row'));
  const returns = [];

  for (const row of rows) {
    const productId    = row.getAttribute('data-product-id');
    const originalLotId = row.getAttribute('data-lot-id');
    const qtyInput     = /** @type {HTMLInputElement} */ (row.querySelector('.wh-cancel-return-qty'));
    const quantity     = parseFloat(qtyInput?.value || '0');
    if (!(quantity > 0)) { continue; } // skip zero-quantity rows

    const modeSelected = /** @type {HTMLInputElement|null} */ (row.querySelector('.wh-cancel-lot-mode:checked'));
    const mode = modeSelected?.value || 'original';

    if (mode === 'original') {
      returns.push({ productId, quantity, targetLotId: originalLotId });
    } else {
      const codeInput   = /** @type {HTMLInputElement} */ (row.querySelector('.wh-cancel-new-lot-code'));
      const expiryInput = /** @type {HTMLInputElement} */ (row.querySelector('.wh-cancel-new-lot-expiry'));
      const newLotCode  = codeInput?.value?.trim() || '';
      if (!newLotCode) {
        return { ok: false, errorMessage: 'Debe ingresar un codigo para el lote nuevo.' };
      }
      const entry = { productId, quantity, newLotCode };
      if (expiryInput?.value) { entry.expirationDate = expiryInput.value; }
      returns.push(entry);
    }
  }

  const noteEl = /** @type {HTMLTextAreaElement} */ (panel.querySelector('.wh-cancel-note'));
  const note   = noteEl?.value?.trim() || null;
  return { ok: true, payload: { returns, ...(note ? { note } : {}) } };
}

/**
 * Wires the cancel-with-returns panel buttons once the panel is in the DOM.
 *
 * @param {HTMLElement} container     - parent container that holds the panel
 * @param {any}         session
 * @param {{ warehouseApi: any, app: any, onDismiss?: () => void }} deps
 */
function attachCancelWithReturnsHandlers(container, session, deps) {
  const panel = container.querySelector('.wh-cancel-returns-panel');
  if (!panel) { return; }

  const orderId  = panel.getAttribute('data-order-id');
  const errorEl  = panel.querySelector('#wh-cancel-error');

  // Show / hide new-lot fields when the radio changes
  panel.querySelectorAll('.wh-cancel-return-row').forEach((row) => {
    row.querySelectorAll('.wh-cancel-lot-mode').forEach((radio) => {
      radio.addEventListener('change', () => {
        const selected = /** @type {HTMLInputElement} */ (row.querySelector('.wh-cancel-lot-mode:checked'));
        const newLotFields = /** @type {HTMLElement} */ (row.querySelector('.wh-cancel-new-lot-fields'));
        if (newLotFields) { newLotFields.style.display = selected?.value === 'new' ? '' : 'none'; }
      });
    });
  });

  // Dismiss — go back (no cancel)
  panel.querySelector('.wh-cancel-dismiss-btn')?.addEventListener('click', () => {
    if (typeof deps.onDismiss === 'function') { deps.onDismiss(); }
    else { deps.app.navigate('production'); }
  });

  async function doCancel(payload) {
    const confirmBtns = panel.querySelectorAll('.wh-cancel-no-returns-btn, .wh-cancel-with-returns-btn');
    confirmBtns.forEach((b) => { b.disabled = true; });
    if (errorEl) { errorEl.hidden = true; }

    try {
      await deps.warehouseApi.cancelProductionOrder(session, orderId, payload);
      deps.app.showToast('Orden de produccion cancelada.');
      deps.app.navigate('production');
    } catch (err) {
      confirmBtns.forEach((b) => { b.disabled = false; });
      if (errorEl) {
        errorEl.textContent = err?.message || 'No se pudo cancelar la orden.';
        errorEl.hidden = false;
      }
    }
  }

  // Cancel WITHOUT returning any material
  panel.querySelector('.wh-cancel-no-returns-btn')?.addEventListener('click', () => {
    doCancel({ returns: [] });
  });

  // Cancel WITH returns collected from the form
  panel.querySelector('.wh-cancel-with-returns-btn')?.addEventListener('click', () => {
    const result = collectCancelPayload(panel);
    if (!result.ok) {
      if (errorEl) {
        errorEl.textContent = result.errorMessage || 'Error en el formulario.';
        errorEl.hidden = false;
      }
      return;
    }
    doCancel(result.payload);
  });
}

/**
 * Attaches the handler for «Terminar producción» / «Cancelar orden» buttons.
 * Instead of window.confirm, renders the cancel-with-returns panel inline.
 *
 * @param {HTMLElement} container
 * @param {any}         session
 * @param {{ warehouseApi: any, app: any, order?: object }} deps
 *   deps.order — the full production order object (needed to aggregate consumptions)
 */
function attachTerminateProductionHandler(container, session, deps) {
  const btn = container.querySelector('.wh-terminate-production-btn');
  if (!btn) { return; }

  btn.addEventListener('click', () => {
    const orderId = btn.getAttribute('data-order-id');
    const order   = deps.order || null;

    const rejection = WarehouseShell.require('views.productionRenderersRejection');
    // Replace the current panel/section with the cancel-with-returns form
    const panelHtml = rejection.renderCancelWithReturnsPanel(order || {}, orderId);

    // Find the closest section/container to replace, fall back to appending
    const targetSection = btn.closest('section') || btn.closest('[class*="panel"]') || container;
    targetSection.outerHTML = panelHtml;

    // Re-query after DOM replacement
    const newPanel = container.querySelector('.wh-cancel-returns-panel')
      || document.querySelector('.wh-cancel-returns-panel');

    if (newPanel) {
      attachCancelWithReturnsHandlers(newPanel.parentElement || container, session, {
        warehouseApi: deps.warehouseApi,
        app:          deps.app,
        onDismiss:    () => {
          if (typeof deps.app.refreshCurrentOrder === 'function') {
            deps.app.refreshCurrentOrder();
          }
        },
      });
    }
  });
}


/**
 * Attaches reconciliation panel to the DOM and wires submit/dismiss actions.
 * AUD-002 fix — TASK-007 (qa-rejection-material-reconciliation-amendment)
 *
 * @param {HTMLElement} container
 * @param {{ orderId: string, recolectionId: string }} ids
 * @param {any} session
 * @param {{ warehouseApi: any, renderReconciliationPanel: any, app: any }} deps
 */
function attachReconciliationHandlers(container, ids, session, deps) {
  const { orderId, recolectionId } = ids;
  const { warehouseApi, renderReconciliationPanel, app } = deps;

  const panel = container.querySelector('.wh-reconciliation-panel');
  if (!panel) { return; }

  // dismiss
  const dismissBtn = panel.querySelector('.wh-reconciliation-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      if (typeof app.refreshCurrentOrder === 'function') { app.refreshCurrentOrder(); }
    });
  }

  // submit
  const submitBtn = panel.querySelector('.wh-reconciliation-submit-btn');
  if (!submitBtn) { return; }

  submitBtn.addEventListener('click', async () => {
    const errorEl = panel.querySelector('.wh-reconciliation-error');
    if (errorEl) { errorEl.hidden = true; }

    const rows = Array.from(panel.querySelectorAll('.wh-reconciliation-row'));
    const outcomes = rows.map((row) => {
      const productId = row.getAttribute('data-product-id');
      const lotId = row.getAttribute('data-lot-id');
      const outcome = row.querySelector('.wh-reconciliation-outcome')?.value?.trim() || '';
      const qty = parseFloat(row.querySelector('.wh-reconciliation-qty')?.value || '0');
      const notes = row.querySelector('.wh-reconciliation-notes')?.value?.trim() || null;
      return { productId, lotId, outcome, quantity: qty, notes };
    }).filter((o) => o.outcome);

    if (outcomes.length === 0) {
      if (errorEl) { errorEl.textContent = 'Debes registrar al menos un resultado.'; errorEl.hidden = false; }
      return;
    }

    const missingOutcome = outcomes.find((o) => !o.outcome);
    const zeroQty = outcomes.find((o) => o.quantity <= 0);
    if (missingOutcome || zeroQty) {
      if (errorEl) { errorEl.textContent = 'Todos los resultados deben tener destino y cantidad mayor a 0.'; errorEl.hidden = false; }
      return;
    }

    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    submitBtn.textContent = 'Registrando...';

    try {
      await warehouseApi.reconcileRecolection(session, orderId, recolectionId, outcomes);
      if (typeof app.refreshCurrentOrder === 'function') { app.refreshCurrentOrder(); }
    } catch (err) {
      const msg = err?.message || 'Error al registrar conciliacion.';
      if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  });
}

WarehouseShell.register('views.productionControllersRejection', {
  attachStageLossHandlers,
  attachReExecuteHandler,
  attachTerminateProductionHandler,
  attachCancelWithReturnsHandlers,
  collectCancelPayload,
  attachReconciliationHandlers,
});
})();
