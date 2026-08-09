// TASK-011: Billing admin view — renderers module
(function attachRootShellBillingAdminRenderers(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const h = {
    get helpers() { return rootShell.require('views.billingAdminHelpers'); },
  };

  function renderEmptyState(message) {
    return `<p class="muted" style="padding:24px;text-align:center;">${h.helpers.escapeHtml(message || 'Sin datos.')}</p>`;
  }

  function renderLoadingSkeleton() {
    return `
      <div style="display:grid;gap:12px;padding:16px;">
        <div class="agent-skeleton-card" style="height:48px;border-radius:8px;background:#f1f5f9;"></div>
        <div class="agent-skeleton-card" style="height:48px;border-radius:8px;background:#f1f5f9;"></div>
        <div class="agent-skeleton-card" style="height:48px;border-radius:8px;background:#f1f5f9;"></div>
      </div>`;
  }

  /**
   * Renders the accounts receivable table (PENDING/PARTIAL invoices).
   * @param {any[]} invoices
   * @returns {string}
   */
  function renderReceivablesTable(invoices) {
    if (!invoices || invoices.length === 0) {
      return renderEmptyState('No hay facturas pendientes de cobro.');
    }

    const bh = h.helpers;
    const rows = invoices.map((inv) => {
      const overdue = bh.isOverdue(inv);
      const rowStyle = overdue ? ' class="billing-row--overdue"' : '';
      const pending = inv.pendingAmount ?? inv.amount ?? 0;
      return `
        <tr${rowStyle}>
          <td>${bh.escapeHtml(inv.client?.name || inv.clientName || '—')}</td>
          <td>${bh.escapeHtml(inv.invoiceNumber || String(inv.id || '—'))}</td>
          <td class="numeric-cell">${bh.formatCurrency(inv.amount)}</td>
          <td class="numeric-cell" style="font-weight:700;">${bh.formatCurrency(pending)}</td>
          <td>${bh.formatDate(inv.dueAt)}</td>
          <td><span class="${bh.invoiceStatusBadgeClass(inv.status)}">${bh.escapeHtml(bh.invoiceStatusLabel(inv.status))}</span></td>
          <td>
            <button type="button" class="secondary-button billing-register-payment-btn" style="font-size:0.8rem;padding:4px 10px;"
              data-invoice-id="${bh.escapeHtml(String(inv.id))}"
              data-invoice-number="${bh.escapeHtml(inv.invoiceNumber || String(inv.id))}"
              data-pending-amount="${Number(pending)}">
              💰 Registrar pago
            </button>
          </td>
        </tr>`;
    });

    return `
      <div class="table-wrapper">
        <table class="products-admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>N° Factura</th>
              <th class="numeric-cell">Total</th>
              <th class="numeric-cell">Pendiente</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p class="muted" style="padding:8px 0;font-size:0.82rem;">${invoices.length} factura(s)</p>`;
  }

  /**
   * Renders the pending payments table (PENDING_APPROVAL status).
   * @param {any[]} payments
   * @returns {string}
   */
  function renderPendingPaymentsTable(payments) {
    if (!payments || payments.length === 0) {
      return renderEmptyState('No hay cobros pendientes de aprobación.');
    }

    const bh = h.helpers;
    const rows = payments.map((pmt) => {
      const referenceCell = pmt.paymentMethod === 'TRANSFER' && pmt.reference
        ? `<span class="billing-ref">${bh.escapeHtml(pmt.reference)}</span>`
        : (pmt.reference ? bh.escapeHtml(pmt.reference) : '—');

      return `
        <tr>
          <td>${bh.escapeHtml(pmt.invoice?.client?.name || pmt.clientName || '—')}</td>
          <td>${bh.escapeHtml(pmt.invoice?.invoiceNumber || String(pmt.invoiceId || '—'))}</td>
          <td>${bh.escapeHtml(bh.paymentMethodLabel(pmt.paymentMethod))}</td>
          <td>${referenceCell}</td>
          <td class="numeric-cell" style="font-weight:700;">${bh.formatCurrency(pmt.amount)}</td>
          <td>${bh.formatDateTime(pmt.submittedAt || pmt.createdAt)}</td>
          <td style="white-space:nowrap;">
            <button type="button" class="billing-approve-btn" style="font-size:0.8rem;padding:4px 10px;background:#16A34A;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:4px;"
              data-payment-id="${bh.escapeHtml(String(pmt.id))}">
              ✓ Aprobar
            </button>
            <button type="button" class="billing-reject-btn secondary-button" style="font-size:0.8rem;padding:4px 10px;"
              data-payment-id="${bh.escapeHtml(String(pmt.id))}">
              ✕ Rechazar
            </button>
          </td>
        </tr>`;
    });

    return `
      <div class="table-wrapper">
        <table class="products-admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Factura</th>
              <th>Método</th>
              <th>Referencia</th>
              <th class="numeric-cell">Monto</th>
              <th>Enviado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p class="muted" style="padding:8px 0;font-size:0.82rem;">${payments.length} cobro(s) pendiente(s)</p>`;
  }

  /**
   * Renders the client selector for the ledger tab.
   * @param {any[]} clients
   * @param {string|null} selectedId
   * @returns {string}
   */
  function renderClientSelector(clients, selectedId) {
    if (!clients || clients.length === 0) {
      return '<p class="muted">No hay clientes disponibles.</p>';
    }
    const bh = h.helpers;
    const options = clients.map((c) => {
      const val = bh.escapeHtml(String(c.id));
      const label = bh.escapeHtml(c.name || String(c.id));
      const selected = String(c.id) === String(selectedId) ? ' selected' : '';
      return `<option value="${val}"${selected}>${label}</option>`;
    });
    return `
      <div class="field" style="max-width:400px;">
        <label for="billing-client-selector" style="font-weight:700;">Seleccionar cliente</label>
        <select id="billing-client-selector" style="font-size:16px;">
          <option value="">— Selecciona un cliente —</option>
          ${options.join('')}
        </select>
      </div>`;
  }

  /**
   * Renders the full client ledger including invoices and collapsible payments.
   * @param {any} ledgerData
   * @returns {string}
   */
  function renderClientLedger(ledgerData) {
    if (!ledgerData) return renderEmptyState('No se encontraron datos del cliente.');
    const bh = h.helpers;
    const client = ledgerData.client || {};
    const invoices = Array.isArray(ledgerData.invoices) ? ledgerData.invoices : [];

    const creditLimit   = Number(client.creditLimit || 0);
    const creditBalance = Number(client.creditBalance || 0);
    const usageRatio    = creditLimit > 0 ? Math.min(creditBalance / creditLimit, 1) : 0;
    const barClass      = usageRatio >= 0.9
      ? 'billing-balance-bar__fill billing-balance-bar__fill--danger'
      : usageRatio >= 0.7
        ? 'billing-balance-bar__fill billing-balance-bar__fill--warning'
        : 'billing-balance-bar__fill';

    const creditSection = creditLimit > 0
      ? `<div style="margin-bottom:16px;">
          <p class="muted" style="font-size:0.82rem;margin-bottom:4px;">
            Crédito utilizado: <strong>${bh.formatCurrency(creditBalance)}</strong> de <strong>${bh.formatCurrency(creditLimit)}</strong>
          </p>
          <div class="billing-balance-bar">
            <div class="${barClass}" style="width:${Math.round(usageRatio * 100)}%;"></div>
          </div>
        </div>`
      : '';

    if (invoices.length === 0) {
      return `${creditSection}<p class="muted" style="padding:16px 0;">Este cliente no tiene facturas registradas.</p>`;
    }

    const invoiceRows = invoices.map((inv) => {
      const payments = Array.isArray(inv.payments) ? inv.payments : [];
      const paymentRows = payments.length === 0
        ? '<p class="muted" style="font-size:0.82rem;padding:8px 0;">Sin pagos registrados.</p>'
        : `<table class="products-admin-table" style="font-size:0.82rem;">
            <thead><tr><th>Método</th><th>Referencia</th><th class="numeric-cell">Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>${payments.map((p) => `
              <tr>
                <td>${bh.escapeHtml(bh.paymentMethodLabel(p.paymentMethod))}</td>
                <td>${p.reference ? bh.escapeHtml(p.reference) : '—'}</td>
                <td class="numeric-cell">${bh.formatCurrency(p.amount)}</td>
                <td><span class="badge">${bh.escapeHtml(bh.paymentStatusLabel(p.status))}</span></td>
                <td>${bh.formatDate(p.approvedAt || p.createdAt)}</td>
              </tr>`).join('')}</tbody>
          </table>`;

      const overdue = bh.isOverdue(inv);
      const rowStyle = overdue ? 'background:#fff5f5;' : '';
      return `
        <tr style="${rowStyle}">
          <td>${bh.escapeHtml(inv.invoiceNumber || String(inv.id || '—'))}</td>
          <td class="numeric-cell">${bh.formatCurrency(inv.amount)}</td>
          <td class="numeric-cell" style="font-weight:700;">${bh.formatCurrency(inv.pendingAmount ?? inv.amount)}</td>
          <td>${bh.formatDate(inv.dueAt)}</td>
          <td><span class="${bh.invoiceStatusBadgeClass(inv.status)}">${bh.escapeHtml(bh.invoiceStatusLabel(inv.status))}</span></td>
        </tr>
        <tr>
          <td colspan="5" style="padding:0;">
            <div class="billing-invoice-payments">
              <details>
                <summary style="cursor:pointer;font-size:0.82rem;color:#3B82F6;padding:4px 0;">
                  ${payments.length > 0 ? `Ver ${payments.length} pago(s)` : 'Sin pagos'}
                </summary>
                <div style="margin-top:8px;">${paymentRows}</div>
              </details>
            </div>
          </td>
        </tr>`;
    });

    return `
      ${creditSection}
      <div class="table-wrapper">
        <table class="products-admin-table">
          <thead>
            <tr>
              <th>N° Factura</th>
              <th class="numeric-cell">Total</th>
              <th class="numeric-cell">Pendiente</th>
              <th>Vencimiento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>${invoiceRows.join('')}</tbody>
        </table>
      </div>`;
  }

  rootShell.register('views.billingAdminRenderers', {
    renderClientLedger,
    renderClientSelector,
    renderEmptyState,
    renderLoadingSkeleton,
    renderPendingPaymentsTable,
    renderReceivablesTable,
  });
}(window));
