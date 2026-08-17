const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeRootScript(relativePath, context) {
  vm.runInContext(readRootFile(relativePath), context, { filename: relativePath });
}

function createBrowserContext(fetchJsonImplementation = async () => null) {
  const browserWindow = {
    InventoryAuth: {
      fetchJson: fetchJsonImplementation,
    },
  };

  const context = vm.createContext({
    Map,
    URLSearchParams,
    window: browserWindow,
  });

  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

test('recipesApi calls approved recipe endpoints with expected methods and fallback messages', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('recipes-api.js', context);

  const recipesApi = browserWindow.RootShell.require('recipesApi');
  const session = { user: { id: 10 } };

  await recipesApi.listRecipes(session, { page: 2, pageSize: 20, search: '', recipeType: 'BASE' });
  await recipesApi.getRecipe(session, 15);
  await recipesApi.createRecipe(session, { name: 'Base A' });
  await recipesApi.updateRecipe(session, 15, { isActive: true });
  await recipesApi.listRecipeVersions(session, 15);
  await recipesApi.createRecipeVersion(session, 15, { notes: 'draft' });
  await recipesApi.updateRecipeVersion(session, 44, { notes: 'edited' });
  await recipesApi.approveRecipeVersion(session, 44, { approvedAt: '2026-01-01T00:00:00.000Z' });

  assert.equal(calls[0].url, '/api/recipes/?page=2&pageSize=20&recipeType=BASE');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudieron cargar las recetas.');
  assert.equal(calls[1].url, '/api/recipes/15');
  assert.equal(calls[1].options.fallbackMessage, 'No se pudo cargar el detalle de la receta.');
  assert.equal(calls[2].url, '/api/recipes/');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(calls[2].options.body, JSON.stringify({ name: 'Base A' }));
  assert.equal(calls[3].url, '/api/recipes/15');
  assert.equal(calls[3].options.method, 'PUT');
  assert.equal(calls[4].url, '/api/recipes/15/versions');
  assert.equal(calls[5].url, '/api/recipes/15/versions');
  assert.equal(calls[5].options.method, 'POST');
  assert.equal(calls[6].url, '/api/recipes/versions/44');
  assert.equal(calls[6].options.method, 'PUT');
  assert.equal(calls[7].url, '/api/recipes/versions/44/approve');
  assert.equal(calls[7].options.method, 'POST');
  assert.equal(calls[7].options.fallbackMessage, 'No se pudo aprobar la version de la receta.');
});

test('productsApi exposes a dedicated assignRecipeToProduct helper over the real product update contract', async () => {
  const calls = [];
  const { browserWindow, context } = createBrowserContext(async (session, url, options = {}) => {
    calls.push({ session, url, options });
    return { ok: true };
  });

  executeRootScript('registry.js', context);
  executeRootScript('products-api.js', context);

  const productsApi = browserWindow.RootShell.require('productsApi');
  await productsApi.assignRecipeToProduct({ user: { id: 2 } }, 77, 19);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/products/77');
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.body, JSON.stringify({ recipeId: 19 }));
  assert.equal(calls[0].options.fallbackMessage, 'No se pudo actualizar el producto.');
});

test('recipesAdminHelpers reflects permission boundaries and model ambiguity explicitly', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  executeRootScript(path.join('views', 'recipes-admin.helpers.js'), context);

  const helpers = browserWindow.RootShell.require('views.recipesAdminHelpers');
  const sessionAdapter = {
    hasPermission(session, permission) {
      return session.user.permissions.includes(permission);
    },
  };

  const viewerSession = { user: { permissions: ['recipes.view', 'products.view'] } };
  const managerSession = { user: { permissions: ['recipes.manage', 'products.manage'] } };
  const approverSession = { user: { permissions: ['recipes.approve'] } };

  assert.equal(helpers.canViewRecipes(viewerSession, sessionAdapter), true);
  assert.equal(helpers.canManageRecipes(viewerSession, sessionAdapter), false);
  assert.equal(helpers.canApproveRecipes(approverSession, sessionAdapter), true);
  assert.equal(helpers.canViewAssignableProducts(viewerSession, sessionAdapter), true);
  assert.equal(helpers.canAssignRecipesToProducts(managerSession, sessionAdapter), true);
  assert.equal(helpers.buildRecipeAssignmentPayload('25').recipeId, 25);
  assert.equal(helpers.buildRecipeAssignmentPayload('').recipeId, null);
  assert.equal(helpers.resolveAppliedVersionLabel({ recipeVersion: { versionNumber: 3 } }), 'v3');
  assert.equal(helpers.resolveAppliedVersionLabel({}), 'No definida explicitamente');
  assert.equal(helpers.hasExplicitProductRecipeVersion({ recipeVersionId: 9 }), true);
  assert.equal(helpers.hasExplicitProductRecipeVersion({}), false);

  const normalized = helpers.normalizeRecipeListResponse({
    items: [{ id: 1 }],
    pagination: { page: 3, pageSize: 5, totalItems: 12, totalPages: 3 },
  });
  assert.equal(normalized.pagination.page, 3);
  assert.equal(normalized.pagination.totalItems, 12);
});
