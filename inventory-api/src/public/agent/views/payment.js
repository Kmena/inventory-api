/**
 * Agent SPA — Payment registration view.
 *
 * Lets the agent register a payment collected from a client store.
 *   CASH     → amount + optional note → PENDING_APPROVAL (root confirms cash received)
 *   TRANSFER → amount + reference number + comprobante photo → PENDING_APPROVAL (root verifies)
 *
 * Route: #payment?storeId=<id>
 */
(function attachAgentPaymentView(globalScope) {
'use strict';

const AgentShell  = /** @type {any} */ (globalScope).AgentShell;

// ─── Helpers ────────────────────────────────────────────────────────────────

function h() { return AgentShell.require('helpers'); }
function esc(v) { return h().escapeHtml(v); }
function cur(v) { return h().currency(Number(v || 0)); }

function paymentStatusLabel(status) {
  const map = {
    PENDING_APPROVAL: { label: 'Pendiente de aprobación', color: '#92400e', bg: '#fef3c7' },
    UNDER_REVIEW:     { label: 'En revisión',              color: '#1e40af', bg: '#dbeafe' },
    APPROVED:         { label: 'Aprobado',                 color: '#065f46', bg: '#d1fae5' },
    REJECTED:         { label: 'Rechazado',                color: '#991b1b', bg: '#fee2e2' },
  };
  const s = map[status] || { label: status || '—', color: '#374151', bg: '#f1f5f9' };
  return `<span style="font-size:0.78rem;font-weight:700;padding:2px 10px;border-radius:999px;background:${s.bg};color:${s.color};">${esc(s.label)}</span>`;
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderInvoiceOption(inv) {
  const num = inv.number ? `#${esc(String(inv.number))}` : `Factura ${esc(String(inv.id))}`;
  const pending = cur(inv.pendingAmount);
  return `<option value="${esc(String(inv.id))}" data-pending="${esc(String(inv.pendingAmount))}">${num} — pendiente: ${pending}</option>`;
}

function renderPastPayments(invoices) {
  const payments = invoices.flatMap((inv) =>
    (inv.payments || []).map((pay) => ({ ...pay, invoiceNumber: inv.number }))
  );
  if (!payments.length) return '';
  return `
    <details style="margin-top:16px;">
      <summary style="cursor:pointer;font-size:0.85rem;font-weight:700;color:#2563eb;">
        Pagos registrados anteriores (${payments.length})
      </summary>
      <div style="margin-top:8px;display:grid;gap:8px;">
        ${payments.map((pay) => `
          <div style="font-size:0.82rem;background:#f8fafc;border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div>
              <div><strong>${cur(pay.amount)}</strong> · ${esc(pay.paymentMethod || '—')}</div>
              ${pay.reference ? `<div class="muted">${esc(pay.reference)}</div>` : ''}
              ${pay.invoiceNumber ? `<div class="muted">Factura #${esc(String(pay.invoiceNumber))}</div>` : ''}
            </div>
            ${paymentStatusLabel(pay.status)}
          </div>`).join('')}
      </div>
    </details>`;
}

function renderForm(store, storeId, pendingInvoices, allInvoices) {
  const invoiceOptions = pendingInvoices.map(renderInvoiceOption).join('');
  const hasPending = pendingInvoices.length > 0;

  return `
    <div class="agent-page" style="padding-bottom:80px;">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="pay-back-btn" class="secondary-button">← Volver</button>
        <h1 style="margin:0;font-size:1.2rem;flex:1;">Registrar cobro</h1>
      </header>

      <div style="margin:12px 0;padding:12px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem;">
        <strong>${esc(store.name || '—')}</strong>
        ${store.clientName ? `<div class="muted">${esc(store.clientName)}</div>` : ''}
        <div style="margin-top:6px;font-size:0.92rem;font-weight:700;color:${hasPending ? '#dc2626' : '#16a34a'};">
          Saldo pendiente: ${cur(store.pendingBalance)}
        </div>
      </div>

      ${!hasPending ? `
        <div style="text-align:center;padding:48px 24px;">
          <div style="font-size:3rem;">✅</div>
          <h3 style="margin:8px 0;">Sin saldo pendiente</h3>
          <p class="muted">Esta tienda no tiene facturas pendientes de cobro.</p>
        </div>` : `
        <form id="pay-form" style="display:grid;gap:14px;margin-top:4px;">

          <div>
            <label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:6px;">
              Factura a cobrar <span style="color:#dc2626;">*</span>
            </label>
            <select id="pay-invoice-id" required
              style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.9rem;background:#fff;">
              ${pendingInvoices.length > 1 ? '<option value="">— Seleccione —</option>' : ''}
              ${invoiceOptions}
            </select>
          </div>

          <div>
            <label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:6px;">
              Monto cobrado (₡) <span style="color:#dc2626;">*</span>
            </label>
            <input id="pay-amount" type="number" min="1" step="1" required
              style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:1rem;box-sizing:border-box;"
              placeholder="Ej. 75000" />
            <div id="pay-amount-hint" class="muted" style="font-size:0.78rem;margin-top:4px;"></div>
          </div>

          <div>
            <label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:6px;">
              Método de pago <span style="color:#dc2626;">*</span>
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <button type="button" class="pay-method-btn" data-method="CASH"
                style="padding:12px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:0.9rem;">
                💵 Efectivo
              </button>
              <button type="button" class="pay-method-btn" data-method="TRANSFER"
                style="padding:12px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:0.9rem;">
                📲 Transferencia
              </button>
            </div>
            <input type="hidden" id="pay-method" value="" />
            <span id="pay-method-error" style="color:#dc2626;font-size:0.8rem;display:none;">Seleccione el método de pago.</span>
          </div>

          <!-- Solo para transferencias -->
          <div id="pay-transfer-fields" style="display:none;gap:12px;flex-direction:column;">
            <div>
              <label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:6px;">
                Número de referencia / SINPE <span style="color:#dc2626;">*</span>
              </label>
              <input id="pay-reference" type="text" maxlength="255"
                style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.9rem;box-sizing:border-box;"
                placeholder="Ej. 8812-3456 o número de comprobante" />
            </div>
            <div>
              <label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:6px;">
                Comprobante (foto) <span style="color:#dc2626;">*</span>
              </label>
              <input id="pay-receipt" type="file" accept="image/*,application/pdf" capture="environment"
                style="width:100%;font-size:0.85rem;" />
              <div id="pay-receipt-preview" style="margin-top:8px;"></div>
            </div>
          </div>

          <!-- Nota opcional para efectivo -->
          <div id="pay-cash-note-field">
            <label style="font-weight:700;font-size:0.9rem;display:block;margin-bottom:6px;">Nota (opcional)</label>
            <input id="pay-cash-note" type="text" maxlength="255"
              style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.9rem;box-sizing:border-box;"
              placeholder="Ej. cobro de visita del lunes" />
          </div>

          <div id="pay-error" style="display:none;padding:10px 14px;background:#fee2e2;color:#991b1b;border-radius:8px;font-size:0.85rem;font-weight:700;"></div>

          <button type="submit" id="pay-submit" class="btn"
            style="width:100%;font-size:1rem;padding:14px;margin-top:4px;" disabled>
            Registrar cobro
          </button>
        </form>

        ${renderPastPayments(allInvoices)}`}
    </div>`;
}

// ─── File → base64 ───────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = /** @type {string} */ (reader.result);
      // Strip "data:<mime>;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Main render ─────────────────────────────────────────────────────────────

async function render(containerEl, session, params) {
  const navigate  = AgentShell.require('navigate');
  const agentApi  = AgentShell.require('api.agentApi');
  const storeId   = params?.storeId;

  if (!storeId) { navigate('dashboard'); return; }

  containerEl.innerHTML = `<div class="agent-page"><div class="agent-goals-skeleton">
    <div class="agent-skeleton-card" style="height:48px;"></div>
    <div class="agent-skeleton-card" style="height:80px;"></div>
    <div class="agent-skeleton-card" style="height:260px;"></div>
  </div></div>`;

  let store;
  try {
    store = await agentApi.fetchStoreDetail(session, storeId);
  } catch (err) {
    containerEl.innerHTML = `<div class="agent-page"><div class="agent-error-banner">
      <p style="margin:0;font-weight:700;">Error al cargar la tienda</p>
      <p style="margin:0;">${esc(err.message || 'Error de red.')}</p>
      <button type="button" id="pay-retry-btn" class="btn" style="margin-top:8px;">Reintentar</button>
    </div></div>`;
    const retryBtn = containerEl.querySelector('#pay-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, params));
    return;
  }

  // Collect all invoices across purchase history, keep pending ones for payment
  const allInvoices = (store.purchaseHistory || []).flatMap((order) => order.invoices || []);
  const pendingInvoices = allInvoices.filter((inv) => Number(inv.pendingAmount || 0) > 0);

  containerEl.innerHTML = renderForm(store, storeId, pendingInvoices, allInvoices);

  const backBtn = containerEl.querySelector('#pay-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => navigate('store-detail', { storeId }));

  if (!pendingInvoices.length) return;

  // ── Form wiring ───────────────────────────────────────────────────────────
  const form          = containerEl.querySelector('#pay-form');
  const invoiceSelect = /** @type {HTMLSelectElement|null} */ (containerEl.querySelector('#pay-invoice-id'));
  const amountInput   = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#pay-amount'));
  const amountHint    = containerEl.querySelector('#pay-amount-hint');
  const methodInput   = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#pay-method'));
  const methodError   = containerEl.querySelector('#pay-method-error');
  const transferFields = containerEl.querySelector('#pay-transfer-fields');
  const cashNoteField  = containerEl.querySelector('#pay-cash-note-field');
  const referenceInput = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#pay-reference'));
  const receiptInput   = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#pay-receipt'));
  const receiptPreview = containerEl.querySelector('#pay-receipt-preview');
  const errorDiv       = containerEl.querySelector('#pay-error');
  const submitBtn      = /** @type {HTMLButtonElement|null} */ (containerEl.querySelector('#pay-submit'));

  // Auto-select only invoice and pre-fill amount
  if (pendingInvoices.length === 1 && invoiceSelect) {
    invoiceSelect.value = String(pendingInvoices[0].id);
    if (amountInput) amountInput.value = String(Math.round(Number(pendingInvoices[0].pendingAmount)));
    if (amountHint) amountHint.textContent = `Pendiente: ${cur(pendingInvoices[0].pendingAmount)}`;
  }

  if (invoiceSelect) {
    invoiceSelect.addEventListener('change', () => {
      const opt = invoiceSelect.selectedOptions[0];
      const pending = opt?.getAttribute('data-pending');
      if (pending && amountInput) amountInput.value = String(Math.round(Number(pending)));
      if (amountHint) amountHint.textContent = pending ? `Pendiente: ${cur(pending)}` : '';
    });
  }

  /** @param {'CASH'|'TRANSFER'} method */
  function selectMethod(method) {
    if (!methodInput) return;
    methodInput.value = method;
    if (methodError) methodError.style.display = 'none';
    containerEl.querySelectorAll('.pay-method-btn').forEach((btn) => {
      const isSelected = btn.getAttribute('data-method') === method;
      /** @type {HTMLElement} */ (btn).style.borderColor  = isSelected ? '#2563eb' : '#e2e8f0';
      /** @type {HTMLElement} */ (btn).style.background   = isSelected ? '#eff6ff' : '#fff';
      /** @type {HTMLElement} */ (btn).style.fontWeight   = isSelected ? '700' : '400';
    });
    if (transferFields) transferFields.style.display = method === 'TRANSFER' ? 'flex' : 'none';
    if (cashNoteField)  cashNoteField.style.display  = method === 'CASH' ? 'block' : 'none';
    if (submitBtn) submitBtn.disabled = false;
  }

  containerEl.querySelectorAll('.pay-method-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.getAttribute('data-method');
      if (m) selectMethod(/** @type {'CASH'|'TRANSFER'} */ (m));
    });
  });

  // Receipt preview
  if (receiptInput) {
    receiptInput.addEventListener('change', () => {
      const file = receiptInput.files?.[0];
      if (!file || !receiptPreview) return;
      const url = URL.createObjectURL(file);
      const isImg = file.type.startsWith('image/');
      receiptPreview.innerHTML = isImg
        ? `<img src="${url}" alt="Comprobante" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid #e2e8f0;" />`
        : `<div style="font-size:0.82rem;color:#2563eb;">📎 ${esc(file.name)}</div>`;
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorDiv) errorDiv.style.display = 'none';

      const method = methodInput?.value;
      if (!method) {
        if (methodError) methodError.style.display = 'block';
        return;
      }

      const invoiceId = invoiceSelect?.value;
      const amount    = Number(amountInput?.value || 0);
      const reference = referenceInput?.value?.trim() || null;
      const cashNote  = /** @type {HTMLInputElement|null} */ (containerEl.querySelector('#pay-cash-note'))?.value?.trim() || null;

      // Client-side validation for transfer
      if (method === 'TRANSFER') {
        if (!reference) {
          if (errorDiv) { errorDiv.textContent = 'Ingresa el número de referencia o SINPE.'; errorDiv.style.display = 'block'; }
          return;
        }
        if (!receiptInput?.files?.length) {
          if (errorDiv) { errorDiv.textContent = 'Adjunta el comprobante de la transferencia.'; errorDiv.style.display = 'block'; }
          return;
        }
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Registrando…'; }

      /** @type {any} */
      let receiptFile = null;
      if (method === 'TRANSFER' && receiptInput?.files?.length) {
        const file = receiptInput.files[0];
        try {
          const fileContentBase64 = await fileToBase64(file);
          receiptFile = { fileName: file.name, mimeType: file.type, fileContentBase64 };
        } catch (_err) {
          if (errorDiv) { errorDiv.textContent = 'No se pudo leer el comprobante.'; errorDiv.style.display = 'block'; }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar cobro'; }
          return;
        }
      }

      const payload = {
        invoiceId: Number(invoiceId),
        amount,
        paymentMethod: method,
        reference: reference || cashNote || undefined,
        ...(receiptFile ? { receiptFile } : {}),
      };

      try {
        await agentApi.postPayment(session, storeId, payload);
        containerEl.innerHTML = `
          <div class="agent-page" style="text-align:center;padding:48px 24px;">
            <div style="font-size:3rem;margin-bottom:16px;">✅</div>
            <h2 style="margin:0 0 8px;">Cobro registrado</h2>
            <p class="muted" style="margin:0 0 24px;">
              ${method === 'CASH'
                ? 'El cobro en efectivo está pendiente de confirmación en oficina.'
                : 'La transferencia está pendiente de verificación en oficina.'}
            </p>
            <button type="button" id="pay-done-btn" class="btn" style="width:100%;font-size:1rem;">Volver a la tienda</button>
          </div>`;
        const doneBtn = containerEl.querySelector('#pay-done-btn');
        if (doneBtn) doneBtn.addEventListener('click', () => navigate('store-detail', { storeId }));
      } catch (err) {
        if (errorDiv) { errorDiv.textContent = err.message || 'Error al registrar el cobro.'; errorDiv.style.display = 'block'; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar cobro'; }
      }
    });
  }
}

AgentShell.register('views.payment', { render });

})(typeof globalThis !== 'undefined' ? globalThis : window);
