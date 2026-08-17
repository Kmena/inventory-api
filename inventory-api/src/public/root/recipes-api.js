(function attachRootRecipesApi(globalScope) {
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

  async function listRecipes(session, query = {}) {
    return inventoryAuth.fetchJson(session, `/api/recipes/${buildQueryString(query)}`, {
      fallbackMessage: 'No se pudieron cargar las recetas.',
    });
  }

  async function getRecipe(session, recipeId) {
    return inventoryAuth.fetchJson(session, `/api/recipes/${encodeURIComponent(recipeId)}`, {
      fallbackMessage: 'No se pudo cargar el detalle de la receta.',
    });
  }

  async function createRecipe(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/recipes/', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la receta.',
    });
  }

  async function updateRecipe(session, recipeId, payload) {
    return inventoryAuth.fetchJson(session, `/api/recipes/${encodeURIComponent(recipeId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar la receta.',
    });
  }

  async function listRecipeVersions(session, recipeId) {
    return inventoryAuth.fetchJson(session, `/api/recipes/${encodeURIComponent(recipeId)}/versions`, {
      fallbackMessage: 'No se pudieron cargar las versiones de la receta.',
    });
  }

  async function createRecipeVersion(session, recipeId, payload) {
    return inventoryAuth.fetchJson(session, `/api/recipes/${encodeURIComponent(recipeId)}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la version borrador.',
    });
  }

  async function updateRecipeVersion(session, recipeVersionId, payload) {
    return inventoryAuth.fetchJson(session, `/api/recipes/versions/${encodeURIComponent(recipeVersionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar la version de la receta.',
    });
  }

  async function approveRecipeVersion(session, recipeVersionId, payload = {}) {
    return inventoryAuth.fetchJson(session, `/api/recipes/versions/${encodeURIComponent(recipeVersionId)}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo aprobar la version de la receta.',
    });
  }

  rootShell.register('recipesApi', {
    approveRecipeVersion,
    createRecipe,
    createRecipeVersion,
    getRecipe,
    listRecipes,
    listRecipeVersions,
    updateRecipe,
    updateRecipeVersion,
  });
}(window));
