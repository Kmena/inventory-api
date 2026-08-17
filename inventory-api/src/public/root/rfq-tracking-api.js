(function attachRootRfqTrackingApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listTracking(session) {
    return inventoryAuth.fetchJson(session, '/api/procurement/rfq-tracking', {
      fallbackMessage: 'No se pudo cargar el seguimiento de cotizaciones RFQ.',
    });
  }

  async function submitManualResponse(session, invitationId, payload) {
    return inventoryAuth.fetchJson(session, `/api/procurement/rfq-invitations/${invitationId}/manual-response`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo registrar la respuesta manual del proveedor.',
    });
  }

  async function cancelRequest(session, purchaseRequestId) {
    return inventoryAuth.fetchJson(session, `/api/procurement/requests/${purchaseRequestId}/cancel`, {
      method: 'POST',
      fallbackMessage: 'No se pudo cancelar la solicitud de cotización.',
    });
  }

  rootShell.register('rfqTrackingApi', {
    listTracking,
    submitManualResponse,
    cancelRequest,
  });
}(window));
