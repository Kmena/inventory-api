(function attachRootReceiptsApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listReceipts(session) {
    return inventoryAuth.fetchJson(session, '/api/receipts', {
      fallbackMessage: 'No se pudieron cargar los documentos de recepción.',
    });
  }

  async function getReceipt(session, id) {
    return inventoryAuth.fetchJson(session, `/api/receipts/${id}`, {
      fallbackMessage: 'No se pudo cargar el detalle de la recepción.',
    });
  }

  async function listFiscalReferences(session) {
    return inventoryAuth.fetchJson(session, '/api/fiscal-references', {
      fallbackMessage: 'No se pudieron cargar las referencias fiscales.',
    });
  }

  async function listFiscalReferencesForReceipt(session, receiptId) {
    return inventoryAuth.fetchJson(session, `/api/receipts/${receiptId}/fiscal-references`, {
      fallbackMessage: 'No se pudieron cargar las referencias fiscales de la recepción.',
    });
  }

  rootShell.register('receiptsApi', {
    listReceipts,
    getReceipt,
    listFiscalReferences,
    listFiscalReferencesForReceipt,
  });
}(window));
