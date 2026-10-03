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

  /**
   * Builds the detail cell for a payment row.
   * TRANSFER → shows reference (required) + bank name (if present)
   * CARD     → shows card type (if present)
   * CASH     → '—'
   * @param {ReturnType<typeof h.helpers>} bh
   * @param {{ paymentMethod?: string, reference?: string|null, bankName?: string|null, cardType?: string|null }} pmt
   * @returns {string}
   */
  function buildPaymentDetailCell(bh, pmt) {
    if (pmt.paymentMethod === 'TRANSFER') {
      const ref  = pmt.reference ? `<span class="billing-ref">${bh.escapeHtml(pmt.reference)}</span>` : '—';
      const bank = pmt.bankName  ? `<br><span class="muted" style="font-size:0.78rem;">Banco: ${bh.escapeHtml(pmt.bankName)}</span>` : '';
      return ref + bank;
    }
    if (pmt.paymentMethod === 'CARD') {
      return pmt.cardType ? bh.escapeHtml(bh.cardTypeLabel(pmt.cardType)) : '—';
    }
    return '—';
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

      // Check if there's already a payment in review for this invoice
      const inFlightPayment = (inv.payments || []).find(
        (p) => p.status === 'PENDING_APPROVAL' || p.status === 'UNDER_REVIEW',
      );
      const actionCell = inFlightPayment
        ? `<span style="font-size:0.8rem;font-weight:700;padding:4px 10px;border-radius:6px;background:#fef3c7;color:#92400e;white-space:nowrap;">
             ⏳ Pago en revisión
           </span>`
        : `<button type="button" class="secondary-button billing-register-payment-btn" style="font-size:0.8rem;padding:4px 10px;"
             data-invoice-id="${bh.escapeHtml(String(inv.id))}"
             data-invoice-number="${bh.escapeHtml(inv.invoiceNumber || String(inv.id))}"
             data-pending-amount="${Number(pending)}">
             Registrar pago
           </button>`;

      // Wave 2: fiscal status cell — consume inv.fiscal from the backend DTO.
      // NEVER infer fiscal state from inv.status, payments, or presence of clave.
      const fiscalCell = inv.fiscal
        ? `<span class="${bh.escapeHtml(bh.fiscalStatusListBadgeClass(inv.fiscal.status))}">${bh.escapeHtml(bh.fiscalStatusListLabel(inv.fiscal.status))}</span>`
        : '<span aria-label="Sin emisión fiscal">—</span>';

      return `
        <tr${rowStyle}>
          <td>${bh.escapeHtml(inv.client?.name || inv.clientName || '—')}</td>
          <td><button type="button" class="billing-detail-btn"
              data-invoice-id="${bh.escapeHtml(String(inv.id))}"
              data-invoice-number="${bh.escapeHtml(inv.invoiceNumber || String(inv.id))}"
              style="background:none;border:none;color:#2563EB;cursor:pointer;font-size:inherit;font-weight:600;padding:0;text-decoration:underline;"
            >${bh.escapeHtml(inv.invoiceNumber || String(inv.id || '—'))}</button></td>
          <td class="numeric-cell">${bh.formatCurrency(inv.amount)}</td>
          <td class="numeric-cell" style="font-weight:700;">${bh.formatCurrency(pending)}</td>
          <td>${bh.formatDate(inv.dueAt)}</td>
          <td><span class="${bh.invoiceStatusBadgeClass(inv.status)}">${bh.escapeHtml(bh.invoiceStatusLabel(inv.status))}</span></td>
          <td>${fiscalCell}</td>
          <td>${actionCell}</td>
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
              <th>Estado Fiscal</th>
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
      const referenceCell = buildPaymentDetailCell(bh, pmt);

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
   * Renders a labelled section heading used by both renderInvoiceDetailContent
   * and renderFiscalStatusSection. Module-level to avoid duplication.
   * @param {string} id
   * @param {string} label
   * @returns {string}
   */
  function sectionHead(id, label) {
    return `<h4 id="${id}" style="margin:0 0 8px;font-size:0.88rem;text-transform:uppercase;letter-spacing:0.05em;color:#6B7280;">${label}</h4>`;
  }

  /**
   * Loading skeleton for the invoice detail dialog body.
   * Wave 7: wraps skeleton in role="status" so screen readers announce the loading state.
   * @returns {string}
   */
  function renderInvoiceDetailLoading() {
    return `
      <div role="status" aria-label="Cargando detalle de factura\u2026" style="display:grid;gap:12px;padding:16px;">
        <div style="height:18px;border-radius:4px;background:#f1f5f9;"></div>
        <div style="height:18px;border-radius:4px;background:#f1f5f9;width:70%;"></div>
        <div style="height:18px;border-radius:4px;background:#f1f5f9;width:50%;"></div>
      </div>`;
  }

  /**
   * Not-found state for the invoice detail dialog body.
   * @returns {string}
   */
  function renderInvoiceDetailNotFound() {
    return `<p class="muted" style="padding:24px;text-align:center;">No se encontró la factura solicitada.</p>`;
  }

  /**
   * Safe error state for the invoice detail dialog body.
   * Does NOT expose raw API error details — always shows a fixed safe message.
   * @returns {string}
   */
  function renderInvoiceDetailError() {
    return `<p class="muted" style="color:#DC2626;padding:24px;text-align:center;">No se pudo cargar el detalle de la factura. Por favor intente nuevamente.</p>`;
  }

  /**
   * Maps Inventori URL-safe artifact types to user-facing download labels.
   * Only these three types are supported. Unknown inventoriType values are filtered out.
   * @type {Readonly<Record<string, string>>}
   */
  const ARTIFACT_LABELS = Object.freeze({
    'pdf':               'Descargar PDF',
    'signed-xml':        'Descargar XML firmado',
    'hacienda-response': 'Respuesta Hacienda',
  });

  /**
   * Descriptive aria-labels for artifact download links.
   * Wave 7 — AC-038: each download button must have a descriptive accessible name.
   * @type {Readonly<Record<string, string>>}
   */
  const ARTIFACT_ARIA_LABELS = Object.freeze({
    'pdf':               'Descargar PDF del comprobante electr\u00F3nico',
    'signed-xml':        'Descargar XML firmado del comprobante electr\u00F3nico',
    'hacienda-response': 'Descargar respuesta de Hacienda del comprobante electr\u00F3nico',
  });

  /**
   * Renders fiscal artifact download links or an informative unavailable message.
   * Security: only renders download links for known inventoriType values (allowlist).
   * URL is Inventori proxy — never a direct Billing or Hacienda URL.
   * Wave 7: adds aria-label with invoice number for distinguishable accessible names (AC-038).
   * @param {string|number} invoiceId     Inventori Invoice ID
   * @param {Array<{ inventoriType: string }>|null} items  From listFiscalArtifacts. null = not ACCEPTED.
   * @param {string} [invoiceNumber]       Optional invoice number appended to aria-labels.
   * @returns {string}
   */
  function renderArtifactActions(invoiceId, items, invoiceNumber) {
    const bh       = h.helpers;
    const safeId   = bh.escapeHtml(String(invoiceId || ''));
    const numSuffix = invoiceNumber ? ` ${bh.escapeHtml(String(invoiceNumber))}` : '';

    if (!Array.isArray(items) || items.length === 0) {
      return `<p class="muted" style="font-size:0.88rem;margin-top:12px;">Los documentos fiscales estar\u00E1n disponibles cuando Hacienda acepte el comprobante.</p>`;
    }

    const links = items
      .filter((a) => a && ARTIFACT_LABELS[a.inventoriType])
      .map((a) => {
        const label     = ARTIFACT_LABELS[a.inventoriType];
        const baseAria  = ARTIFACT_ARIA_LABELS[a.inventoriType] || label;
        const ariaLabel = bh.escapeHtml(baseAria + numSuffix);
        const url       = `/api/invoices/${safeId}/fiscal-artifacts/${bh.escapeHtml(String(a.inventoriType))}`;
        return `<a href="${url}" download class="secondary-button billing-artifact-link" aria-label="${ariaLabel}" style="font-size:0.85rem;padding:6px 12px;">${bh.escapeHtml(label)}</a>`;
      });

    if (links.length === 0) {
      return `<p class="muted" style="font-size:0.88rem;margin-top:12px;">Los documentos fiscales estar\u00E1n disponibles cuando Hacienda acepte el comprobante.</p>`;
    }

    return `<div class="billing-artifact-actions" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">${links.join('')}</div>`;
  }

  /**
   * Renders a safe inline error state for when artifact list loading fails.
   * Includes a retry button that re-opens the invoice detail (re-fetches artifacts).
   * Does NOT expose raw Billing errors, stack traces, or storage paths.
   * @param {string|number} invoiceId
   * @param {string} invoiceNumber
   * @returns {string}
   */
  function renderArtifactLoadError(invoiceId, invoiceNumber) {
    const bh     = h.helpers;
    const safeId = bh.escapeHtml(String(invoiceId || ''));
    const safeNum = bh.escapeHtml(String(invoiceNumber || ''));
    return `
      <div class="billing-artifact-error" style="margin-top:12px;">
        <p class="muted" style="color:#DC2626;font-size:0.88rem;">No se pudieron cargar los documentos fiscales. Por favor intente nuevamente.</p>
        <button type="button" class="secondary-button billing-artifact-retry-btn"
          style="font-size:0.8rem;padding:4px 10px;margin-top:4px;"
          data-invoice-id="${safeId}"
          data-invoice-number="${safeNum}">Reintentar</button>
      </div>`;
  }

  /**
   * Renders the "Comprobante electr\u00F3nico" section for the invoice detail panel.
   * Handles all six FiscalIssuanceStatus values plus null (no fiscal issuance).
   * Wave 5: includes artifact actions area (always rendered when opts.invoiceId is present).
   * Security: only accesses approved DTO fields. opts.items comes from listFiscalArtifacts.
   * @param {{ status: string, clave: string|null, consecutive: string|null, acceptedAt: string|null }|null} fiscal
   * @param {{ invoiceId?: string, invoiceNumber?: string, items?: Array|null, failed?: boolean }} [opts]
   * @returns {string}
   */
  function renderFiscalStatusSection(fiscal, opts) {
    const safeOpts = opts && typeof opts === 'object' ? opts : {};
    const bh      = h.helpers;
    const heading = sectionHead('billing-detail-fiscal-heading', 'Comprobante electr\u00F3nico');

    if (!fiscal) {
      // fiscal === null: no fiscal intent — no artifact area
      return `
      <section id="billing-detail-fiscal-section" class="billing-detail-section"
        aria-labelledby="billing-detail-fiscal-heading" style="margin-top:16px;">
        ${heading}
        <p class="muted" style="font-size:0.88rem;">Este comprobante no tiene factura electr\u00F3nica asociada.</p>
      </section>`;
    }

    // Guard: treat any non-string status as unknown
    const status      = typeof fiscal.status === 'string' ? fiscal.status : '';
    const badgeClass  = bh.escapeHtml(bh.fiscalStatusBadgeClass(status));
    const label       = bh.escapeHtml(bh.fiscalStatusLabel(status));
    const description = bh.escapeHtml(bh.fiscalStatusDescription(status));

    // ACCEPTED: show clave, consecutive, acceptedAt.
    // Only fiscal.status === 'ACCEPTED' qualifies — never inferred from other fields.
    let acceptedBlock = '';
    if (status === 'ACCEPTED') {
      const clave  = fiscal.clave       ? bh.escapeHtml(String(fiscal.clave))       : '\u2014';
      const consec = fiscal.consecutive ? bh.escapeHtml(String(fiscal.consecutive)) : '\u2014';
      const at     = fiscal.acceptedAt  ? bh.escapeHtml(bh.formatDateTime(fiscal.acceptedAt)) : '\u2014';

      acceptedBlock = `
        <dl style="display:grid;gap:6px;margin:12px 0 0;">
          <div style="display:grid;grid-template-columns:max-content 1fr;gap:8px;align-items:baseline;">
            <dt style="font-weight:600;font-size:0.88rem;white-space:nowrap;">Clave:</dt>
            <dd style="margin:0;font-family:monospace;font-size:0.82rem;word-break:break-all;overflow-wrap:break-word;">${clave}</dd>
          </div>
          <div style="display:grid;grid-template-columns:max-content 1fr;gap:8px;align-items:baseline;">
            <dt style="font-weight:600;font-size:0.88rem;white-space:nowrap;">Consecutivo:</dt>
            <dd style="margin:0;font-family:monospace;font-size:0.82rem;word-break:break-all;overflow-wrap:break-word;">${consec}</dd>
          </div>
          <div style="display:grid;grid-template-columns:max-content 1fr;gap:8px;align-items:baseline;">
            <dt style="font-weight:600;font-size:0.88rem;white-space:nowrap;">Aceptada:</dt>
            <dd style="margin:0;">${at}</dd>
          </div>
        </dl>`;
    }

    // Artifact actions area — shown when invoiceId is provided (even for non-ACCEPTED statuses).
    // Non-ACCEPTED → informative message via renderArtifactActions(id, null).
    // ACCEPTED + failed → error message with retry.
    // ACCEPTED + items → download links (or informative if empty).
    const hasArtifactContext = safeOpts.invoiceId != null && safeOpts.invoiceId !== '';
    let artifactArea = '';
    if (hasArtifactContext) {
      artifactArea = safeOpts.failed
        ? renderArtifactLoadError(safeOpts.invoiceId, safeOpts.invoiceNumber || '')
        : renderArtifactActions(safeOpts.invoiceId, safeOpts.items ?? null, safeOpts.invoiceNumber || '');
    }

    return `
      <section id="billing-detail-fiscal-section" class="billing-detail-section"
        aria-labelledby="billing-detail-fiscal-heading" style="margin-top:16px;">
        ${heading}
        <span class="${badgeClass}">${label}</span>
        <p class="muted" style="margin:8px 0 0;font-size:0.88rem;">${description}</p>
        ${acceptedBlock}
        ${artifactArea}
      </section>`;
  }

  /**
   * Renders the invoice detail modal body — commercial info + payments + fiscal section.
   * Wave 4: "Comprobante electr\u00F3nico" section is now active via renderFiscalStatusSection.
   * Wave 5: passes artifactCtx to fiscal section for download links or error state.
   * @param {any} invoice  Full detail DTO from GET /api/invoices/:id
   * @param {{ items: Array|null, failed: boolean }|null} [artifactCtx]  null = no artifact context
   * @returns {string}
   */
  function renderInvoiceDetailContent(invoice, artifactCtx) {
    if (!invoice) return renderInvoiceDetailNotFound();
    const bh = h.helpers;

    const storeName = invoice.order?.clientStoreName || null;
    const orderId   = invoice.order?.id ?? invoice.orderId ?? null;
    const orderLine = orderId
      ? `<li><strong>Pedido:</strong> #${bh.escapeHtml(String(orderId))}${storeName ? ` — ${bh.escapeHtml(storeName)}` : ''}</li>`
      : '';

    const dueLine  = invoice.dueAt  ? `<li><strong>Vencimiento:</strong> ${bh.escapeHtml(bh.formatDate(invoice.dueAt))}</li>` : '';
    const paidLine = invoice.paidAt ? `<li><strong>Pagado:</strong> ${bh.escapeHtml(bh.formatDate(invoice.paidAt))}</li>` : '';

    const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
    const paymentsBody = payments.length === 0
      ? '<p class="muted" style="padding:8px 0;font-size:0.88rem;">Sin pagos registrados.</p>'
      : `<div class="table-wrapper">
          <table class="products-admin-table" style="font-size:0.88rem;">
            <thead>
              <tr>
                <th>Método</th><th>Referencia</th>
                <th class="numeric-cell">Monto</th>
                <th>Estado</th><th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((p) => `
                <tr>
                  <td>${bh.escapeHtml(bh.paymentMethodLabel(p.paymentMethod))}</td>
                  <td>${p.reference ? bh.escapeHtml(p.reference) : '\u2014'}</td>
                  <td class="numeric-cell">${bh.formatCurrency(p.amount)}</td>
                  <td><span class="badge">${bh.escapeHtml(bh.paymentStatusLabel(p.status))}</span></td>
                  <td>${bh.formatDate(p.approvedAt || p.createdAt)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

    return `
      <section class="billing-detail-section" aria-labelledby="billing-detail-info-heading">
        ${sectionHead('billing-detail-info-heading', 'Informaci\u00F3n general')}
        <ul style="list-style:none;padding:0;margin:0;display:grid;gap:6px;">
          <li><strong>Factura:</strong> ${bh.escapeHtml(invoice.invoiceNumber || '\u2014')}</li>
          <li><strong>Cliente:</strong> ${bh.escapeHtml(invoice.clientName || '\u2014')}</li>
          ${orderLine}
          <li><strong>Total:</strong> ${bh.escapeHtml(bh.formatCurrency(invoice.amount))}</li>
          <li><strong>Emisi\u00F3n:</strong> ${bh.escapeHtml(bh.formatDate(invoice.issuedAt))}</li>
          ${dueLine}
          ${paidLine}
        </ul>
      </section>

      <section class="billing-detail-section" aria-labelledby="billing-detail-status-heading" style="margin-top:16px;">
        ${sectionHead('billing-detail-status-heading', 'Estado comercial')}
        <span class="${bh.escapeHtml(bh.invoiceStatusBadgeClass(invoice.status))}">
          ${bh.escapeHtml(bh.invoiceStatusLabel(invoice.status))}
        </span>
      </section>

      <section class="billing-detail-section" aria-labelledby="billing-detail-payments-heading" style="margin-top:16px;">
        ${sectionHead('billing-detail-payments-heading', 'Pagos registrados')}
        ${paymentsBody}
      </section>

      ${renderFiscalStatusSection(invoice.fiscal, {
        invoiceId:     String(invoice.id || ''),
        invoiceNumber: invoice.invoiceNumber || '',
        items:  artifactCtx ? (artifactCtx.items  ?? null)  : null,
        failed: artifactCtx ? Boolean(artifactCtx.failed)   : false,
      })}`;
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

    // Credit is now per-store. Aggregate across all stores for a client-level summary.
    const stores = Array.isArray(client.stores) ? client.stores : [];
    const creditLimit   = stores.reduce((s, st) => s + Number(st.creditLimit || 0), 0);
    const creditBalance = stores.reduce((s, st) => s + Number(st.creditBalance || 0), 0);
    const usageRatio    = creditLimit > 0 ? Math.min(creditBalance / creditLimit, 1) : 0;
    const barClass      = usageRatio >= 0.9
      ? 'billing-balance-bar__fill billing-balance-bar__fill--danger'
      : usageRatio >= 0.7
        ? 'billing-balance-bar__fill billing-balance-bar__fill--warning'
        : 'billing-balance-bar__fill';

    const creditSection = creditLimit > 0
      ? `<div style="margin-bottom:16px;">
          <p class="muted" style="font-size:0.82rem;margin-bottom:4px;">
            Crédito utilizado (todas las tiendas): <strong>${bh.formatCurrency(creditBalance)}</strong> de <strong>${bh.formatCurrency(creditLimit)}</strong>
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
      const invoiceItems = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.invoiceItems) ? inv.invoiceItems : [];
      const itemRows = invoiceItems.length === 0
        ? '<p class="muted" style="font-size:0.82rem;padding:8px 0;">No se encontraron items facturados para esta factura.</p>'
        : `<table class="products-admin-table" style="font-size:0.82rem;">
            <thead><tr><th>Producto</th><th>Tipo</th><th class="numeric-cell">Cant.</th><th class="numeric-cell">Total</th></tr></thead>
            <tbody>${invoiceItems.map((item) => `
              <tr>
                <td>${bh.escapeHtml(item.productName || item.description || item.product?.name || 'Item')}</td>
                <td>${bh.escapeHtml(item.itemKind || item.kind || 'PRODUCT')}</td>
                <td class="numeric-cell">${bh.escapeHtml(String(item.quantity ?? '—'))}</td>
                <td class="numeric-cell">${bh.formatCurrency(item.lineTotal ?? item.total ?? item.amount ?? 0)}</td>
              </tr>`).join('')}</tbody>
          </table>`;
      const paymentRows = payments.length === 0
        ? '<p class="muted" style="font-size:0.82rem;padding:8px 0;">Sin pagos registrados.</p>'
        : `<table class="products-admin-table" style="font-size:0.82rem;">
            <thead><tr><th>Método</th><th>Referencia</th><th class="numeric-cell">Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>${payments.map((p) => `
              <tr>
                <td>${bh.escapeHtml(bh.paymentMethodLabel(p.paymentMethod))}</td>
                <td>${buildPaymentDetailCell(bh, p)}</td>
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
                  Items facturados (${invoiceItems.length})
                </summary>
                <div style="margin-top:8px;">${itemRows}</div>
              </details>
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
    renderArtifactActions,
    renderArtifactLoadError,
    renderClientLedger,
    renderClientSelector,
    renderEmptyState,
    renderFiscalStatusSection,
    renderInvoiceDetailContent,
    renderInvoiceDetailError,
    renderInvoiceDetailLoading,
    renderInvoiceDetailNotFound,
    renderLoadingSkeleton,
    renderPendingPaymentsTable,
    renderReceivablesTable,
  });
}(window));
