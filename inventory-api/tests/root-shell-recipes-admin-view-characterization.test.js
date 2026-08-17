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

function createBrowserContext() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;
  return { browserWindow, context };
}

test('recipesAdmin render exposes administrative workspace instead of introductory placeholder copy', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('recipesApi', {});
  browserWindow.RootShell.register('productsApi', {});
  browserWindow.RootShell.register('ui', { escapeHtml: (v) => String(v || ''), formatDate: () => '01/01/2026', renderInlineMessage: () => '', renderStatusBadge: () => '' });
  browserWindow.RootShell.register('sessionAdapter', {});
  browserWindow.RootShell.register('views.recipesAdminHelpers', {});
  browserWindow.RootShell.register('views.recipesAdminRenderers', {});
  browserWindow.RootShell.register('views.recipesAdminState', {});

  executeRootScript(path.join('views', 'recipes-admin.js'), context);

  const view = browserWindow.RootShell.require('views.recipesAdmin');
  const markup = view.render();

  assert.match(markup, /Catalogo administrativo de recetas/);
  assert.match(markup, /recipes-list-region/);
  assert.match(markup, /recipes-detail-region/);
  assert.match(markup, /Nueva receta/);
  assert.match(markup, /Asignar receta a producto/);
  assert.doesNotMatch(markup, /Siguiente incremento/);
});

test('recipes admin state and renderers keep shared-recipe and version-ambiguity visible', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml: (value) => String(value || ''),
    formatDate: () => '01/01/2026',
    renderInlineMessage: (message) => message || '',
    renderStatusBadge: () => '<span>badge</span>',
  });
  browserWindow.RootShell.register('views.recipesAdminHelpers', {
    resolveAppliedVersionLabel(product) {
      return product.recipeVersion ? `v${product.recipeVersion.versionNumber}` : 'No definida explicitamente';
    },
    hasExplicitProductRecipeVersion(product) {
      return Boolean(product.recipeVersion);
    },
  });

  executeRootScript(path.join('views', 'recipes-admin.state.js'), context);
  executeRootScript(path.join('views', 'recipes-admin.renderers.js'), context);

  const state = browserWindow.RootShell.require('views.recipesAdminState');
  const renderers = browserWindow.RootShell.require('views.recipesAdminRenderers');
  const productsByRecipeId = state.buildAssociatedProductsByRecipeId([
    { id: 10, name: 'Producto A', recipeId: 5 },
    { id: 11, name: 'Producto B', recipeId: 5, recipeVersion: { versionNumber: 3 } },
  ], browserWindow.RootShell.require('views.recipesAdminHelpers'));
  const recipes = state.decorateRecipes([
    { id: 5, name: 'Base A', code: 'BASE-A', recipeType: 'BASE', isActive: true, versions: [{ status: 'DRAFT' }] },
  ], productsByRecipeId);

  const filtered = state.filterRecipes(recipes, { searchTerm: 'base', recipeType: '', sharedOnly: 'yes', status: '' });
  assert.equal(filtered.length, 1);

  const detailMarkup = renderers.renderRecipeDetail(recipes[0], {
    detailState: 'ready',
    activeTab: 'products',
    versions: [{ id: 8, versionNumber: 3, status: 'APPROVED', ingredients: [], stages: [] }],
    associatedProducts: productsByRecipeId['5'],
    permissions: { canAssignRecipesToProducts: true, canManageRecipes: true, canApproveRecipes: true },
  });

  assert.match(detailMarkup, /Compartida por 2 productos/);
  assert.match(detailMarkup, /No definida explicitamente/);
  assert.match(detailMarkup, /Asignar a producto/);
});
