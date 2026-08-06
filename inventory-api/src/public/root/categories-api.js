(function attachRootCategoriesApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listCategories(session) {
    return inventoryAuth.fetchJson(session, '/api/products/categories/company', {
      fallbackMessage: 'No se pudieron cargar las categorias de inventario.',
    });
  }

  async function createCategory(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/products/categories/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la categoria.',
    });
  }

  rootShell.register('categoriesApi', {
    createCategory,
    listCategories,
  });
}(window));
