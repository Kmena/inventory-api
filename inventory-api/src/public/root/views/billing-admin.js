// TASK-011: Billing admin view — main module
// Provides three tabs: accounts receivable, pending payments, client ledger.
// FR-016, DEC-009, DEC-010
(function attachRootShellBillingAdminView(globalScope) {
  'use strict';

  const rootShell      = /** @type {any} */ (globalScope).RootShell;
  const billingApi     = rootShell.require('billingApi');
  const _rootShellUi   = rootShell.require('ui');
  const helpers        = rootShell.require('views.billingAdminHelpers');
  const renderers      = rootShell.require('views.billingAdminRenderers');

  const TOAST_VISIBILITY_MS = 4000;
  let toastTimerId = null;

  function showToast(containerEl, message, tone) {
    const region = containerEl.querySelector('#billing-page-message');
    if (!region) return;
    const cls = tone === 'error' ? 'message error' : 'message';
    region.innerHTML = `<p class="${cls}" role="status">${helpers.escapeHtml(message)}</p>`;
    if (toastTimerId) globalScope.clearTimeout(toastTimerId);
    toastTimerId = globalScope.setTimeout(() => { region.innerHTML = ''; }, TOAST_VISIBILITY_MS);
  }

  function showRejectReasonModal() {
    return new Promise((resolve) => {
      const overlay = globalScope.document.createElement('div');
      overlay.className = 'billing-modal-overlay';
      overlay.innerHTML = `
        <div class="billing-modal" role="dialog" aria-label="Motivo del rechazo">
          <h3 style="margin:0 0 12px 0;font-size:16px;">Motivo del rechazo</h3>
          <textarea id="billing-reject-reason" rows="3" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;" placeholder="Ingrese el motivo..."></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
            <button type="button" class="billing-modal-cancel" style="padding:8px 16px;border:1px solid #d1d5db;background:#fff;border-radius:6px;cursor:pointer;">Cancelar</button>
            <button type="button" class="billing-modal-confirm" style="padding:8px 16px;border:none;background:#2563eb;color:#fff;border-radius:6px;cursor:pointer;">Confirmar</button>
          </div>
        </div>
      `;
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
      overlay.querySelector('.billing-modal').style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.15);';

      function cleanup(value) { overlay.remove(); resolve(value); }
      overlay.querySelector('.billing-modal-cancel').addEventListener('click', () => cleanup(null));
      overlay.querySelector('.billing-modal-confirm').addEventListener('click', () => {
        const reason = /** @type {HTMLTextAreaElement} */ (overlay.querySelector('#billing-reject-reason')).value;
        cleanup(reason);
      });
      globalScope.document.body.appendChild(overlay);
      overlay.querySelector('#billing-reject-reason').focus();
    });
  }

  // ─── Render shell HTML ────────────────────────────────────────────────────

  function renderShell() {
    return `
      <section class="root-hero" aria-labelledby="billing-view-title">
        <p class="eyebrow">Administración</p>
        <h2 id="billing-view-title">Facturación y cobros</h2>
        <p class="muted">Gestiona cuentas por cobrar, aprueba cobros y revisa el historial de clientes.</p>
      </section>

      <section class="commercial-page" id="billing-page">
        <div id="billing-page-message"></div>

        <article class="card root-card">
          <nav class="tabs-nav" aria-label="Secciones de facturación">
            <button type="button" class="tab-button active" data-tab="receivables" id="billing-tab-receivables">
              Cuentas por cobrar
            </button>
            <button type="button" class="tab-button" data-tab="pending" id="billing-tab-pending">
              Cobros pendientes
            </button>
            <button type="button" class="tab-button" data-tab="history" id="billing-tab-history">
              Historial por cliente
            </button>
          </nav>

          <div id="billing-panel-receivables" class="tab-panel" role="tabpanel">
            ${renderers.renderLoadingSkeleton()}
          </div>

          <div id="billing-panel-pending" class="tab-panel hidden" role="tabpanel">
            ${renderers.renderLoadingSkeleton()}
          </div>

          <div id="billing-panel-history" class="tab-panel hidden" role="tabpanel">
            <div id="billing-client-selector-region"></div>
            <div id="billing-ledger-region" style="margin-top:16px;"></div>
          </div>
        </article>
      </section>

      <dialog id="billing-pay-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3>Registrar pago</h3>
            <p class="muted" id="billing-pay-dialog-subtitle">Factura —</p>
          </div>
          <button type="button" id="billing-pay-dialog-close" class="secondary-button">Cerrar</button>
        </div>
        <div id="billing-pay-dialog-message"></div>
        <form id="billing-pay-form" class="root-form" novalidate>
          <div class="root-form-grid">
            <label class="root-form-grid__full">
              <span>Método de pago *</span>
              <select id="billing-pay-method" style="font-size:16px;" required>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </label>
            <label class="root-form-grid__full">
              <span>Monto *</span>
              <input type="number" id="billing-pay-amount" min="0.01" step="0.01" style="font-size:16px;" required />
              <small id="billing-pay-max-hint" class="muted"></small>
            </label>
            <label class="root-form-grid__full" id="billing-pay-reference-label">
              <span>Referencia *</span>
              <input type="text" id="billing-pay-reference" maxlength="255" placeholder="Número de referencia o comprobante" style="font-size:16px;" />
            </label>
            <label class="root-form-grid__full">
              <span>Nota (opcional)</span>
              <textarea id="billing-pay-note" rows="2" maxlength="500" style="font-size:16px;"></textarea>
            </label>
          </div>
          <div class="hint-box" style="margin:8px 0 16px;padding:10px 14px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;font-size:0.82rem;color:#1E40AF;">
            ℹ️ Los pagos registrados desde la oficina se aprueban automáticamente.
          </div>
          <div id="billing-pay-error" hidden style="color:#DC2626;font-size:0.88rem;margin-bottom:8px;"></div>
          <div class="action-row">
            <button type="submit" id="billing-pay-submit">Registrar pago</button>
            <button type="button" id="billing-pay-cancel" class="secondary-button">Cancelar</button>
          </div>
        </form>
      </dialog>`;
  }

  // ─── Mount ─────────────────────────────────────────────────────────────────

  async function mount(containerEl, session) {
    // ── Tab switching ──
    const tabLoadedFlags = { receivables: false, pending: false, history: false };

    function showTab(tabName) {
      ['receivables', 'pending', 'history'].forEach((name) => {
        const btn   = containerEl.querySelector(`#billing-tab-${name}`);
        const panel = containerEl.querySelector(`#billing-panel-${name}`);
        const isActive = name === tabName;
        if (btn) btn.classList.toggle('active', isActive);
        if (panel) panel.classList.toggle('hidden', !isActive);
      });
    }

    containerEl.querySelectorAll('.tab-button[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;
        showTab(tab);
        if (!tabLoadedFlags[tab]) {
          tabLoadedFlags[tab] = true;
          if (tab === 'pending')  loadPendingPayments();
          if (tab === 'history')  loadHistoryClientList();
        }
      });
    });

    // ── Accounts receivable tab ──
    async function loadReceivables() {
      const panel = containerEl.querySelector('#billing-panel-receivables');
      if (!panel) return;
      panel.innerHTML = renderers.renderLoadingSkeleton();
      try {
        const data = await billingApi.fetchReceivables(session);
        const invoices = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        panel.innerHTML = renderers.renderReceivablesTable(invoices);
        bindRegisterPaymentButtons(panel, session);
      } catch (err) {
        panel.innerHTML = `<p class="muted" style="color:#DC2626;padding:16px;">${helpers.escapeHtml(err.message || 'Error al cargar facturas.')}</p>`;
      }
    }

    function bindRegisterPaymentButtons(panel, sess) {
      panel.querySelectorAll('.billing-register-payment-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const invoiceId     = btn.getAttribute('data-invoice-id');
          const invoiceNumber = btn.getAttribute('data-invoice-number');
          const pendingAmount = parseFloat(btn.getAttribute('data-pending-amount') || '0');
          openPayDialog(sess, invoiceId, invoiceNumber, pendingAmount);
        });
      });
    }

    // ── Payment dialog (FR-016, DEC-010) ──
    function openPayDialog(sess, invoiceId, invoiceNumber, pendingAmount) {
      const dialog   = /** @type {HTMLDialogElement|null} */ (containerEl.querySelector('#billing-pay-dialog'));
      const subtitle = containerEl.querySelector('#billing-pay-dialog-subtitle');
      const maxHint  = containerEl.querySelector('#billing-pay-max-hint');
      const msgEl    = containerEl.querySelector('#billing-pay-dialog-message');
      const errEl    = containerEl.querySelector('#billing-pay-error');
      const methodSel = /** @type {HTMLSelectElement|null} */ (containerEl.querySelector('#billing-pay-method'));
      const amountIn  = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#billing-pay-amount'));
      const refIn     = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#billing-pay-reference'));
      const refLabel  = containerEl.querySelector('#billing-pay-reference-label');
      const noteIn    = /** @type {HTMLTextAreaElement|null} */ (containerEl.querySelector('#billing-pay-note'));
      const submitBtn = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector('#billing-pay-submit'));

      if (!dialog) return;

      // Reset form state
      if (subtitle)  subtitle.textContent = `Factura ${invoiceNumber || '—'} · Pendiente: ${helpers.formatCurrency(pendingAmount)}`;
      if (maxHint)   maxHint.textContent  = `Máximo: ${helpers.formatCurrency(pendingAmount)}`;
      if (msgEl)     msgEl.innerHTML = '';
      if (errEl)   { errEl.hidden = true; errEl.textContent = ''; }
      if (methodSel) methodSel.value = 'CASH';
      if (amountIn)  amountIn.value  = '';
      if (refIn)     refIn.value     = '';
      if (noteIn)    noteIn.value    = '';
      if (refLabel)  refLabel.hidden = true;   // default: CASH → reference not shown
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar pago'; }

      // Method change handler — show reference only for TRANSFER
      function handleMethodChange() {
        const val = methodSel?.value;
        if (refLabel) refLabel.hidden = (val !== 'TRANSFER');
        if (refIn)    refIn.required  = (val === 'TRANSFER');
      }

      if (methodSel) {
        methodSel.removeEventListener('change', handleMethodChange);
        methodSel.addEventListener('change', handleMethodChange);
      }

      dialog.showModal();

      // ── Submit: create + immediately approve (DEC-010) ──
      const form = containerEl.querySelector('#billing-pay-form');
      const onSubmit = async (evt) => {
        evt.preventDefault();

        const method    = methodSel?.value || 'CASH';
        const amount    = parseFloat(amountIn?.value || '0');
        const reference = refIn?.value?.trim() || '';
        const note      = noteIn?.value?.trim() || '';

        // Validate
        if (!amount || amount <= 0) {
          if (errEl) { errEl.textContent = 'El monto debe ser mayor a cero.'; errEl.hidden = false; }
          return;
        }
        if (method === 'TRANSFER' && !reference) {
          if (errEl) { errEl.textContent = 'La referencia es requerida para transferencias.'; errEl.hidden = false; }
          return;
        }
        if (errEl) errEl.hidden = true;

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Registrando…'; }

        try {
          // Step 1: create payment (→ PENDING_APPROVAL)
          const created = await billingApi.createPayment(sess, invoiceId, {
            paymentMethod: method,
            amount,
            reference: reference || null,
            note: note || null,
          });

          // Step 2: approve immediately (DEC-010 — office payments go directly to APPROVED)
          const paymentId = created?.id;
          if (paymentId) {
            await billingApi.approvePayment(sess, paymentId, note || 'Pago registrado por oficina');
          }

          dialog.close();
          // Reload receivables list to reflect updated state
          await loadReceivables();
        } catch (err) {
          if (errEl) { errEl.textContent = err.message || 'No se pudo registrar el pago.'; errEl.hidden = false; }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar pago'; }
        }
      };

      if (form) {
        form.removeEventListener('submit', form._billingOnSubmit);
        form._billingOnSubmit = onSubmit;
        form.addEventListener('submit', onSubmit);
      }
    }

    // Close dialog handlers
    const closeBtn   = containerEl.querySelector('#billing-pay-dialog-close');
    const cancelBtn  = containerEl.querySelector('#billing-pay-cancel');
    const payDialog  = /** @type {HTMLDialogElement|null} */ (containerEl.querySelector('#billing-pay-dialog'));
    if (closeBtn && payDialog) closeBtn.addEventListener('click', () => payDialog.close());
    if (cancelBtn && payDialog) cancelBtn.addEventListener('click', () => payDialog.close());

    // ── Pending payments tab ──
    async function loadPendingPayments() {
      const panel = containerEl.querySelector('#billing-panel-pending');
      if (!panel) return;
      panel.innerHTML = renderers.renderLoadingSkeleton();
      try {
        const data = await billingApi.fetchPendingPayments(session);
        const payments = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        panel.innerHTML = renderers.renderPendingPaymentsTable(payments);
        bindPendingPaymentActions(panel, session);
      } catch (err) {
        panel.innerHTML = `<p class="muted" style="color:#DC2626;padding:16px;">${helpers.escapeHtml(err.message || 'Error al cargar cobros pendientes.')}</p>`;
      }
    }

    /**
     * Shows a confirmation modal with payment details before approving.
     * @param {any} pmt  — parsed payment summary from data-payment attribute
     * @returns {Promise<string|null>}  — receiver note or null if cancelled
     */
    function showApproveConfirmModal(pmt) {
      return new Promise((resolve) => {
        const existing = document.getElementById('billing-approve-confirm-dialog');
        if (existing) { existing.remove(); }

        const methodLabel = helpers.paymentMethodLabel?.(pmt.paymentMethod) || pmt.paymentMethod || '—';
        const amountLabel = helpers.formatCurrency?.(pmt.amount) || `₡${pmt.amount}`;
        const dateLabel   = helpers.formatDateTime?.(pmt.submittedAt) || pmt.submittedAt || '—';

        const dialog = document.createElement('dialog');
        dialog.id = 'billing-approve-confirm-dialog';
        dialog.style.cssText = 'border:none;border-radius:12px;padding:0;max-width:min(720px,92vw);width:92vw;box-shadow:0 8px 32px rgba(0,0,0,0.18);';
        dialog.innerHTML = `
          <form method="dialog" style="padding:24px;display:grid;gap:16px;">
            <h3 style="margin:0;font-size:1rem;">Confirmar aprobación de cobro</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem;background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr><td style="color:#57606a;padding:6px 12px;border-bottom:1px solid #e2e8f0;">Cliente</td>     <td style="font-weight:600;text-align:right;padding:6px 12px;border-bottom:1px solid #e2e8f0;">${helpers.escapeHtml(pmt.clientName || '—')}</td></tr>
              <tr><td style="color:#57606a;padding:6px 12px;border-bottom:1px solid #e2e8f0;">Factura</td>     <td style="font-weight:600;text-align:right;padding:6px 12px;border-bottom:1px solid #e2e8f0;">${helpers.escapeHtml(pmt.invoiceNumber || '—')}</td></tr>
              <tr><td style="color:#57606a;padding:6px 12px;border-bottom:1px solid #e2e8f0;">Monto</td>       <td style="font-weight:700;text-align:right;color:#16A34A;font-size:1.05rem;padding:6px 12px;border-bottom:1px solid #e2e8f0;">${helpers.escapeHtml(amountLabel)}</td></tr>
              <tr><td style="color:#57606a;padding:6px 12px;border-bottom:1px solid #e2e8f0;">Método</td>      <td style="text-align:right;padding:6px 12px;border-bottom:1px solid #e2e8f0;">${helpers.escapeHtml(methodLabel)}</td></tr>
              ${pmt.reference ? `<tr><td style="color:#57606a;padding:6px 12px;border-bottom:1px solid #e2e8f0;">Referencia</td><td style="text-align:right;padding:6px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:0.85rem;">${helpers.escapeHtml(pmt.reference)}</td></tr>` : ''}
              <tr><td style="color:#57606a;padding:6px 12px;border-bottom:1px solid #e2e8f0;">Agente</td>      <td style="text-align:right;padding:6px 12px;border-bottom:1px solid #e2e8f0;">${helpers.escapeHtml(pmt.agentName || pmt.agentEmail || '—')}</td></tr>
              <tr><td style="color:#57606a;padding:6px 12px;">Enviado</td>               <td style="text-align:right;padding:6px 12px;">${helpers.escapeHtml(dateLabel)}</td></tr>
            </table>
            <label style="display:grid;gap:4px;font-size:0.85rem;">
              <span>Recibido por (oficina) <span style="color:#57606a;">— opcional</span></span>
              <input id="billing-approve-receiver" type="text" placeholder="Nombre de quien recibe el dinero"
                style="padding:7px 10px;border:1px solid #d0d7de;border-radius:6px;font-size:0.88rem;font-family:inherit;" />
            </label>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" id="billing-approve-cancel-btn" class="secondary-button">Cancelar</button>
              <button type="submit" id="billing-approve-confirm-btn" style="background:#16A34A;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:0.88rem;cursor:pointer;font-weight:600;">✓ Confirmar aprobación</button>
            </div>
          </form>
        `;

        document.body.appendChild(dialog);
        dialog.showModal();
        dialog.querySelector('#billing-approve-receiver')?.focus();

        dialog.querySelector('#billing-approve-cancel-btn')?.addEventListener('click', () => {
          dialog.close();
          dialog.remove();
          resolve(null);
        });

        dialog.querySelector('form')?.addEventListener('submit', () => {
          const receiver = /** @type {HTMLInputElement|null} */ (dialog.querySelector('#billing-approve-receiver'));
          const note = receiver?.value?.trim() || '';
          dialog.remove();
          resolve(note);
        });

        dialog.addEventListener('cancel', () => { dialog.remove(); resolve(null); });
      });
    }

    function bindPendingPaymentActions(panel, sess) {
      panel.querySelectorAll('.billing-approve-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const paymentId = btn.getAttribute('data-payment-id');
          if (!paymentId) return;

          // Parse the embedded payment summary for the confirmation modal
          let pmtSummary = {};
          try { pmtSummary = JSON.parse(btn.getAttribute('data-payment') || '{}'); } catch (_) { /* ignore */ }

          const receiverNote = await showApproveConfirmModal(pmtSummary);
          if (receiverNote === null) { return; } // cancelled

          /** @type {HTMLButtonElement} */ (btn).disabled = true;
          const siblingReject = panel.querySelector(`.billing-reject-btn[data-payment-id="${paymentId}"]`);
          if (siblingReject) /** @type {HTMLButtonElement} */ (siblingReject).disabled = true;
          try {
            await billingApi.approvePayment(sess, paymentId, receiverNote);
            await loadPendingPayments();
          } catch (err) {
            /** @type {HTMLButtonElement} */ (btn).disabled = false;
            if (siblingReject) /** @type {HTMLButtonElement} */ (siblingReject).disabled = false;
            showToast(containerEl, err.message || 'No se pudo aprobar el pago.', 'error');
          }
        });
      });

      panel.querySelectorAll('.billing-reject-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const paymentId = btn.getAttribute('data-payment-id');
          if (!paymentId) return;
          const reason = await showRejectReasonModal();
          if (reason === null) return; // cancelled
          /** @type {HTMLButtonElement} */ (btn).disabled = true;
          const siblingApprove = panel.querySelector(`.billing-approve-btn[data-payment-id="${paymentId}"]`);
          if (siblingApprove) /** @type {HTMLButtonElement} */ (siblingApprove).disabled = true;
          try {
            await billingApi.rejectPayment(sess, paymentId, reason || '');
            await loadPendingPayments();
          } catch (err) {
            /** @type {HTMLButtonElement} */ (btn).disabled = false;
            if (siblingApprove) /** @type {HTMLButtonElement} */ (siblingApprove).disabled = false;
            showToast(containerEl, err.message || 'No se pudo rechazar el pago.', 'error');
          }
        });
      });
    }

    // ── History tab ──
    async function loadHistoryClientList() {
      const selectorRegion = containerEl.querySelector('#billing-client-selector-region');
      if (!selectorRegion) return;
      selectorRegion.innerHTML = renderers.renderLoadingSkeleton();
      try {
        const data    = await billingApi.fetchClientsForLedger(session);
        const clients = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        selectorRegion.innerHTML = renderers.renderClientSelector(clients, null);
        const sel = selectorRegion.querySelector('#billing-client-selector');
        if (sel) {
          sel.addEventListener('change', async () => {
            const clientId = /** @type {HTMLSelectElement} */ (sel).value;
            const ledgerRegion = containerEl.querySelector('#billing-ledger-region');
            if (!ledgerRegion) return;
            if (!clientId) { ledgerRegion.innerHTML = ''; return; }
            ledgerRegion.innerHTML = renderers.renderLoadingSkeleton();
            try {
              const ledger = await billingApi.fetchClientLedger(session, clientId);
              ledgerRegion.innerHTML = renderers.renderClientLedger(ledger);
            } catch (err) {
              ledgerRegion.innerHTML = `<p class="muted" style="color:#DC2626;padding:16px;">${helpers.escapeHtml(err.message || 'Error al cargar historial.')}</p>`;
            }
          });
        }
      } catch (err) {
        selectorRegion.innerHTML = `<p class="muted" style="color:#DC2626;padding:16px;">${helpers.escapeHtml(err.message || 'Error al cargar clientes.')}</p>`;
      }
    }

    // ── Load initial tab ──
    tabLoadedFlags.receivables = true;
    await loadReceivables();
  }

  function render(_session) {
    return renderShell();
  }

  rootShell.register('views.billingAdmin', { render, mount });
}(window));
