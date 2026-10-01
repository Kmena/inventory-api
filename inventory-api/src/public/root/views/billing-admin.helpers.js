// TASK-011: Billing admin view — helpers module
(function attachRootShellBillingAdminHelpers(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const INVOICE_STATUS_LABELS = {
    PENDING:   'Pendiente',
    PARTIAL:   'Parcial',
    PAID:      'Pagado',
    CANCELLED: 'Cancelado',
  };

  const INVOICE_STATUS_BADGE_CLASSES = {
    PENDING:   'badge badge-warning',
    PARTIAL:   'badge badge-info',
    PAID:      'badge badge-success',
    CANCELLED: 'badge',
  };

  const PAYMENT_METHOD_LABELS = {
    CASH:     'Efectivo',
    TRANSFER: 'Transferencia',
    CREDIT:   'Crédito',
    CARD:     'Tarjeta',
  };

  const CARD_TYPE_LABELS = {
    VISA:       'Visa',
    MASTERCARD: 'Mastercard',
    AMEX:       'American Express',
    DINERS:     'Diners Club',
    OTHER:      'Otro',
  };

  const PAYMENT_STATUS_LABELS = {
    PENDING_APPROVAL: 'Por aprobar',
    APPROVED:         'Aprobado',
    REJECTED:         'Rechazado',
    REVERSED:         'Revertido',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatCurrency(amount) {
    const num = typeof amount === 'bigint' ? Number(amount) : Number(amount || 0);
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 2,
    }).format(num);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    const datePart = date.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  }

  function invoiceStatusLabel(status) {
    return INVOICE_STATUS_LABELS[status] || status || '—';
  }

  function invoiceStatusBadgeClass(status) {
    return INVOICE_STATUS_BADGE_CLASSES[status] || 'badge';
  }

  function paymentMethodLabel(method) {
    return PAYMENT_METHOD_LABELS[method] || method || '—';
  }

  function cardTypeLabel(cardType) {
    return CARD_TYPE_LABELS[cardType] || cardType || '—';
  }

  function paymentStatusLabel(status) {
    return PAYMENT_STATUS_LABELS[status] || status || '—';
  }

  function isOverdue(invoice) {
    if (!invoice?.dueAt) return false;
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') return false;
    return new Date(invoice.dueAt) < new Date();
  }

  // ─── Fiscal status helpers (Wave 2) ───────────────────────────────────────
  // Compact labels for the invoice list column (not the detail panel).
  // Separate from full-label helpers (Wave 4) to keep each wave self-contained.

  const FISCAL_STATUS_LIST_LABELS = {
    PENDING:         '\u23F3 En cola',
    PROCESSING:      '\u23F3 Enviando',
    ACCEPTED:        '\u2713 Aceptada',
    REJECTED:        '\u2717 Rechazada',
    ERROR_RETRYABLE: '\u26A0 Reintentando',
    ERROR_FINAL:     '\u2717 Error final',
  };

  const FISCAL_STATUS_LIST_BADGE_CLASSES = {
    PENDING:         'badge',
    PROCESSING:      'badge badge-info',
    ACCEPTED:        'badge badge-success',
    REJECTED:        'badge badge-danger',
    ERROR_RETRYABLE: 'badge badge-warning',
    ERROR_FINAL:     'badge badge-danger',
  };

  /** Compact label for the invoice list fiscal column. Degrades to raw status for unknown values. */
  function fiscalStatusListLabel(status) {
    return FISCAL_STATUS_LIST_LABELS[status] || status || '\u2014';
  }

  /** Badge CSS class for the invoice list fiscal column. Falls back to plain 'badge'. */
  function fiscalStatusListBadgeClass(status) {
    return FISCAL_STATUS_LIST_BADGE_CLASSES[status] || 'badge';
  }

  rootShell.register('views.billingAdminHelpers', {
    escapeHtml,
    formatCurrency,
    formatDate,
    formatDateTime,
    invoiceStatusBadgeClass,
    invoiceStatusLabel,
    fiscalStatusListBadgeClass,
    fiscalStatusListLabel,
    isOverdue,
    cardTypeLabel,
    paymentMethodLabel,
    paymentStatusLabel,
  });
}(window));
