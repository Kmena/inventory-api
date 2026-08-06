(function attachRootProductsApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  function buildQueryString(query = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      searchParams.set(key, String(value));
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  async function listProducts(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/products/${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar los productos.',
    });
  }

  async function getProduct(session, productId) {
    return inventoryAuth.fetchJson(session, `/api/products/${encodeURIComponent(productId)}`, {
      fallbackMessage: 'No se pudo cargar el detalle del producto.',
    });
  }

  async function createProduct(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/products/', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el producto.',
    });
  }

  async function updateProduct(session, productId, payload) {
    return inventoryAuth.fetchJson(session, `/api/products/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar el producto.',
    });
  }

  async function deactivateProduct(session, productId) {
    return inventoryAuth.fetchJson(session, `/api/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      fallbackMessage: 'No se pudo desactivar el producto.',
    });
  }

  rootShell.register('productsApi', {
    createProduct,
    deactivateProduct,
    getProduct,
    listProducts,
    updateProduct,
  });
}(window));
