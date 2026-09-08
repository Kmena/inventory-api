(function attachRootShellFeedbackApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  const BASE = '/api/feedback';

  async function submitFeedback(session, payload) {
    return inventoryAuth.fetchJson(session, BASE, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo enviar el feedback.',
    });
  }

  async function listFeedback(session, resolvedFilter) {
    const query = resolvedFilter !== undefined && resolvedFilter !== 'all'
      ? `?resolved=${encodeURIComponent(resolvedFilter)}`
      : '';
    return inventoryAuth.fetchJson(session, `${BASE}/admin${query}`, {
      fallbackMessage: 'No se pudo cargar el feedback.',
    });
  }

  async function resolveFeedback(session, id) {
    return inventoryAuth.fetchJson(session, `${BASE}/admin/${encodeURIComponent(id)}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({}),
      fallbackMessage: 'No se pudo marcar como resuelto.',
    });
  }

  rootShell.register('feedbackApi', { submitFeedback, listFeedback, resolveFeedback });
}(window));
