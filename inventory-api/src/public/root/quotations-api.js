(function attachRootQuotationsApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listQuotableProducts(session) {
    return inventoryAuth.fetchJson(session, '/api/procurement/quotable-products', {
      fallbackMessage: 'No se pudieron cargar los productos cotizables.',
    });
  }

  async function getProductSuppliersPricing(session, productId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/products/${productId}/suppliers-pricing`, {
      fallbackMessage: 'No se pudo cargar el detalle de proveedores del producto.',
    });
  }

  async function requestGroupedQuotations(session, payload) {
    const products = Array.isArray(payload?.products) ? payload.products : [];
    if (!products.length || products[0]?.productId === undefined || products[0]?.productId === null) {
      throw new Error('Debes seleccionar al menos un producto para generar la cotización.');
    }

    return inventoryAuth.fetchJson(session, `/api/procurement/products/${products[0].productId}/request-quotations`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo generar la solicitud de cotización agrupada.',
    });
  }

  async function listRfqInvitations(session, purchaseRequestId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/rfq-invitations`, {
      fallbackMessage: 'No se pudieron cargar las invitaciones RFQ.',
    });
  }

  async function createRfqInvitations(session, purchaseRequestId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/rfq-invitations`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudieron generar las invitaciones RFQ.',
    });
  }

  async function refreshInvitationTemplate(session, invitationId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/rfq-invitations/${invitationId}/refresh-template`, {
      method: 'POST',
      fallbackMessage: 'No se pudo refrescar el template de la invitación.',
    });
  }

  async function cancelRfqInvitation(session, invitationId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/rfq-invitations/${invitationId}/cancel`, {
      method: 'POST',
      fallbackMessage: 'No se pudo cancelar la invitación.',
    });
  }

  async function submitManualResponse(session, invitationId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/rfq-invitations/${invitationId}/manual-response`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar la respuesta manual.',
    });
  }

  async function getRfqTrackingSummary(session) {
    return inventoryAuth.fetchJson(session, '/api/procurement/rfq-tracking', {
      fallbackMessage: 'No se pudo cargar el resumen de seguimiento RFQ.',
    });
  }

  async function listPurchaseRequests(session) {
    return inventoryAuth.fetchJson(session, '/api/procurement/requests', {
      fallbackMessage: 'No se pudieron cargar las solicitudes de compra.',
    });
  }

  async function getComparisonData(session, purchaseRequestId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/comparison`, {
      fallbackMessage: 'No se pudo cargar la comparación de cotizaciones.',
    });
  }

  /**
   * Selección mixta: cada línea de producto se asigna a un proveedor distinto.
   * POST /api/procurement/requests/:id/select-items
   * payload: { justification?, items: [{ productId, quotationId, quantity, unitPrice }] }
   */
  async function selectMixedItems(session, purchaseRequestId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/select-items`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo confirmar la selección mixta de proveedores.',
    });
  }

  async function selectQuotation(session, purchaseRequestId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/select-quotation`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo confirmar la selección del proveedor.',
    });
  }

  async function approveSelection(session, selectionId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/selections/${selectionId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo aprobar la selección.',
    });
  }

  async function createPurchaseOrder(session, purchaseRequestId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/purchase-orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la orden de compra.',
    });
  }

  /**
   * Crea una cotizacion de proveedor directamente en una solicitud de compra,
   * sin pasar por el flujo de invitacion RFQ.
   * POST /api/procurement/requests/:id/quotations
   * Requiere: procurement.manage
   */
  async function createDirectQuotation(session, purchaseRequestId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/quotations`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar la cotizacion del proveedor.',
    });
  }

  /**
   * Lista los proveedores activos de la empresa.
   * GET /api/suppliers/company
   * Requiere: suppliers.view o suppliers.manage
   */
  async function listSuppliers(session) {
    return inventoryAuth.fetchJson(session, '/api/suppliers/company', {
      fallbackMessage: 'No se pudieron cargar los proveedores.',
    });
  }

  rootShell.register('quotationsApi', {
    listQuotableProducts,
    getProductSuppliersPricing,
    requestGroupedQuotations,
    listRfqInvitations,
    createRfqInvitations,
    refreshInvitationTemplate,
    cancelRfqInvitation,
    submitManualResponse,
    getRfqTrackingSummary,
    listPurchaseRequests,
    getComparisonData,
    selectMixedItems,
    selectQuotation,
    approveSelection,
    createPurchaseOrder,
    createDirectQuotation,
    listSuppliers,
  });
}(window));
