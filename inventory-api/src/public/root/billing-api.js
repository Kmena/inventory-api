// TASK-010: Frontend root shell — billing API module
// Provides access to invoice, payment and client ledger endpoints.
(function attachRootShellBillingApi(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  const BASE_INVOICES = '/api/invoices';
  const BASE_PAYMENTS = '/api/payments';
  const BASE_CLIENTS  = '/api/clients';

  async function parseJsonSafely(response) {
    try {
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  function buildApiError(data, fallbackMessage, statusCode) {
    const error = /** @type {Error & { statusCode?: number, fieldErrors?: Record<string, string[]> | null }} */ (
      new Error(data?.message || fallbackMessage)
    );
    error.statusCode = statusCode;
    error.fieldErrors = data?.details?.fieldErrors || null;
    return error;
  }

  async function sendJson(session, url, options = {}) {
    const response = await globalScope.fetch(url, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: inventoryAuth.buildHeaders(session, {
        includeJsonContentType: Boolean(options.body),
        headers: options.headers,
      }),
      body: options.body,
    });

    const data = response.status === 204 ? null : await parseJsonSafely(response);
    if (!response.ok) {
      if (response.status === 401) {
        inventoryAuth.handleUnauthorized(options.storageKey);
      }
      throw buildApiError(data, options.fallbackMessage || 'No se pudo completar la operacion.', response.status);
    }

    return data;
  }

  /**
   * Fetch invoices with PENDING or PARTIAL status (accounts receivable).
   * @param {any} session
   * @returns {Promise<any>}
   */
  async function fetchReceivables(session) {
    return inventoryAuth.fetchJson(session, `${BASE_INVOICES}?status=PENDING,PARTIAL`, {
      fallbackMessage: 'No se pudieron cargar las cuentas por cobrar.',
    });
  }

  /**
   * Fetch payments pending admin approval.
   * @param {any} session
   * @returns {Promise<any>}
   */
  async function fetchPendingPayments(session) {
    return inventoryAuth.fetchJson(session, `${BASE_PAYMENTS}?status=PENDING_APPROVAL`, {
      fallbackMessage: 'No se pudieron cargar los cobros pendientes.',
    });
  }

  /**
   * Fetch client invoice ledger (invoices + payments history).
   * @param {any} session
   * @param {string|number} clientId
   * @returns {Promise<any>}
   */
  async function fetchClientLedger(session, clientId) {
    return inventoryAuth.fetchJson(session, `${BASE_CLIENTS}/${encodeURIComponent(clientId)}/ledger`, {
      fallbackMessage: 'No se pudo cargar el historial del cliente.',
    });
  }

  /**
   * Fetch the list of clients for the ledger selector.
   * @param {any} session
   * @returns {Promise<any>}
   */
  async function fetchClientsForLedger(session) {
    return inventoryAuth.fetchJson(session, `${BASE_CLIENTS}/company`, {
      fallbackMessage: 'No se pudieron cargar los clientes.',
    });
  }

  /**
   * Approve a payment (collections.payments.approve required).
   * @param {any} session
   * @param {string|number} paymentId
   * @param {string} [note]
   * @returns {Promise<any>}
   */
  async function approvePayment(session, paymentId, note) {
    return sendJson(session, `${BASE_PAYMENTS}/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note: note || null }),
      fallbackMessage: 'No se pudo aprobar el pago.',
    });
  }

  /**
   * Reject a payment (collections.payments.approve required).
   * @param {any} session
   * @param {string|number} paymentId
   * @param {string} reason
   * @returns {Promise<any>}
   */
  async function rejectPayment(session, paymentId, reason) {
    return sendJson(session, `${BASE_PAYMENTS}/${encodeURIComponent(paymentId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
      fallbackMessage: 'No se pudo rechazar el pago.',
    });
  }

  /**
   * Create a payment for an invoice.
   * Office-registered payments (FR-016, DEC-010) are created and then immediately approved.
   * @param {any} session
   * @param {string|number} invoiceId
   * @param {{ paymentMethod: string, amount: number, reference?: string, note?: string }} paymentData
   * @returns {Promise<any>}
   */
  async function createPayment(session, invoiceId, paymentData) {
    return sendJson(session, BASE_PAYMENTS, {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        paymentMethod: paymentData.paymentMethod,
        amount:        paymentData.amount,
        reference:     paymentData.reference || null,
        note:          paymentData.note || null,
      }),
      fallbackMessage: 'No se pudo registrar el pago.',
    });
  }

  rootShell.register('billingApi', {
    approvePayment,
    createPayment,
    fetchClientLedger,
    fetchClientsForLedger,
    fetchPendingPayments,
    fetchReceivables,
    rejectPayment,
  });
}(window));
