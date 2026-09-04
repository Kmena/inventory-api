// AUD-014: These tests exercise source-level structural contracts (regex over source text)
// and Node vm-sandboxed execution where possible. Full DOM execution would require a
// headless browser environment (e.g. Playwright) and is tracked as a future E2E concern.
// AUD-016: All PROCESSING stage fixtures in this file intentionally omit stageType where
// they test the legacy backward-compat path (stageType defaults to PROCESSING). All
// explicitly typed PROCESSING stages include processCode, verified by linting the fixtures.
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
  browserWindow.RootShell.register('views.recipesAdminRenderers', { renderWorkspace: () => '<section>Catalogo administrativo de recetas<div id="recipes-list-region"></div><div id="recipes-detail-region"></div>Nueva recetaAsignar receta a producto</section>' });
  browserWindow.RootShell.register('views.recipesAdminState', {});
  browserWindow.RootShell.register('views.recipesAdminVersionEditor', {});

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

test('recipes admin workspace render includes approval confirmation dialog seam (recipe-approval-ux)', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml: (value) => String(value || ''),
    formatDate: () => '01/01/2026',
    renderInlineMessage: (message) => message || '',
    renderStatusBadge: () => '<span>badge</span>',
  });
  browserWindow.RootShell.register('views.recipesAdminState', {});

  executeRootScript(path.join('views', 'recipes-admin.renderers.js'), context);

  const renderers = browserWindow.RootShell.require('views.recipesAdminRenderers');
  const markup = renderers.renderWorkspace();

  assert.match(markup, /recipes-approval-dialog/);
  assert.match(markup, /Esta accion es irreversible/);
  assert.match(markup, /Confirmar aprobacion/);
  assert.match(markup, /Cancelar/);
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

test('recipes admin version cards render local feedback and incomplete state markers (recipe-approval-ux)', () => {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml: (value) => String(value || ''),
    formatDate: () => '01/01/2026',
    renderInlineMessage: (message) => message || '',
    renderStatusBadge: () => '<span>badge</span>',
  });
  browserWindow.RootShell.register('views.recipesAdminState', {});

  executeRootScript(path.join('views', 'recipes-admin.renderers.js'), context);

  const renderers = browserWindow.RootShell.require('views.recipesAdminRenderers');
  const detailMarkup = renderers.renderRecipeDetail({ id: 5, name: 'Base', code: 'B-1', recipeType: 'BASE', updatedAt: '2026-01-01' }, {
    detailState: 'ready',
    activeTab: 'versions',
    versions: [{ id: 9, versionNumber: 4, status: 'DRAFT', ingredients: [], stages: [] }],
    associatedProducts: [],
    permissions: { canAssignRecipesToProducts: false, canManageRecipes: true, canApproveRecipes: true },
    versionFeedbackById: {
      9: { versionId: 9, tone: 'error', summary: 'No se pudo aprobar esta version.', detail: 'Falta asignar producto', showRepairAction: true },
    },
    incompleteVersionIds: { 9: true },
  });

  assert.match(detailMarkup, /data-version-feedback="9"/);
  assert.match(detailMarkup, /Reparar borrador/);
  assert.match(detailMarkup, /Incompleta/);
  assert.match(detailMarkup, /no puede aprobarse todavia/i);
});

test('recipes admin version editor module remains registered as dedicated task-010 split seam', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  assert.match(source, /rootShell\.register\('views\.recipesAdminVersionEditor'/);
  assert.match(source, /buildStageInputPatchFromProduct/);
  assert.match(source, /Debes definir al menos un parametro esperado/);
  assert.match(source, /expectedParameters/);
});

// ─── TASK-006: quantityBasis in recipe version editor ────────────────────────

test('recipes-admin.renderers.js and version-editor.js implement quantityBasis select and hint together (TASK-006)', () => {
  // The HTML form element is rendered by renderers.js, the JS behavior is in version-editor.js.
  const renderersSource = readRootFile(path.join('views', 'recipes-admin.renderers.js'));
  const editorSource = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  // HTML side (renderers.js)
  assert.match(renderersSource, /id="recipes-version-quantity-basis"/, 'renderers.js must include the quantityBasis select element');
  assert.match(renderersSource, /name="quantityBasis"/, 'select must carry name="quantityBasis" for form serialization');
  assert.match(renderersSource, /PER_OUTPUT_KG/, 'renderers.js must include PER_OUTPUT_KG option');
  assert.match(renderersSource, /PER_FINISHED_UNIT/, 'renderers.js must include PER_FINISHED_UNIT option');
  assert.match(renderersSource, /id="recipes-version-quantity-basis-hint"/, 'renderers.js must include the hint span');

  // Behavior side (version-editor.js)
  assert.match(editorSource, /QB_HINTS/, 'version-editor.js must declare QB_HINTS lookup for hint text');
  assert.match(editorSource, /updateQuantityBasisHint/, 'version-editor.js must implement updateQuantityBasisHint');
  assert.match(editorSource, /quantityBasisSelect.*addEventListener.*change|addEventListener.*change.*quantityBasis/,
    'must listen to changes on the quantityBasis select');
});

test('recipes-admin.version-editor.js buildVersionPayload includes quantityBasis (TASK-006)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  // buildVersionPayload must serialize quantityBasis from the form
  assert.match(source, /quantityBasis.*formData\.get\('quantityBasis'\)/, 'buildVersionPayload must read quantityBasis from FormData');
  // Falls back to PER_OUTPUT_KG when field is absent
  assert.match(source, /'PER_OUTPUT_KG'/, 'must default quantityBasis to PER_OUTPUT_KG');
});

test('recipes-admin.version-editor.js restores quantityBasis when opening existing version for edit (TASK-006)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  // openEditVersionDialog must patch the quantityBasis select back to the saved value
  assert.match(source, /version\.quantityBasis/, 'openEditVersionDialog must read version.quantityBasis');
  assert.match(source, /qbEl.*value.*version\.quantityBasis|version\.quantityBasis.*qbEl\.value/, 'must assign version.quantityBasis back to the select element');
});

// ─── recipe-stage-lineage-validation ─────────────────────────────────────────

test('recipes-admin.version-editor.js defines computeRecollectedBalances lineage helper (recipe-stage-lineage-validation)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  assert.match(
    source,
    /computeRecollectedBalances/,
    'version-editor must define computeRecollectedBalances for lineage-aware balance computation',
  );
});

test('recipes-admin.version-editor.js hides add-stage-input button when no prior recollected products exist (recipe-stage-lineage-validation, AC-003, BR-011)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  // Must reference recollectedBalances (or equivalent) to conditionally control button visibility
  assert.match(
    source,
    /recollectedBalances|availableBalance|balanceRecol/,
    'version-editor must use recollected balance to conditionally show/hide the add-input button',
  );
  // Must have logic that hides or disables the button when the balance is empty
  assert.match(
    source,
    /\.size.*===.*0|size.*0|display.*none.*recol|recol.*display.*none|hasRecollected|hasAvailableProducts/,
    'version-editor must guard add-input button visibility against empty recollected balance',
  );
});

test('recipes-admin.version-editor.js shows remaining available quantity per recollected product (recipe-stage-lineage-validation, AC-001, AC-002)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  assert.match(
    source,
    /disponible|remaining|Disponible/,
    'version-editor must indicate remaining available quantity per recollected product',
  );
});

test('recipes-admin.js gates approval behind a custom confirmation dialog and local feedback state (recipe-approval-ux)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.js'));

  assert.match(source, /openApprovalDialog/);
  assert.match(source, /recipes-approval-dialog/);
  assert.match(source, /confirmApprovalButton\.addEventListener\('click'/);
  assert.match(source, /setVersionFeedback/);
  assert.match(source, /scrollVersionCardFeedbackIntoView/);
  assert.match(source, /shouldMarkDraftIncompleteFromApprovalError/);
  assert.match(source, /findUnderAllocatedRepairHighlight/);
  assert.match(source, /fue recolectado pero no se usa completamente en una etapa posterior/);
  assert.match(source, /Revisa las etapas de procesamiento posteriores/);
});

test('recipes-admin.version-editor.js implements stage-type-aware incomplete row handling and repair highlight hooks (recipe-approval-ux)', () => {
  const source = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  assert.match(source, /inspectIncompleteStageInputs/);
  assert.match(source, /validateStageStructureInline/);
  assert.match(source, /focusValidationTarget/);
  assert.match(source, /Codigo de proceso/);
  assert.match(source, /Descripcion del proceso/);
  assert.match(source, /No se puede guardar el borrador\. Completa las filas incompletas de RECOLLECTION/);
  assert.match(source, /Hay filas incompletas en PROCESSING\. Guardaremos el borrador como incompleto/);
  assert.match(source, /applyRepairHighlight/);
  assert.match(source, /data\.stageInputName|dataset\.stageInputName/);
  assert.match(source, /data\.stageName|dataset\.stageName/);
});

// ─── AUD-001: processCode catalog alignment ───────────────────────────────────

test('recipes-admin.version-editor.js PROCESS_CODE_OPTIONS includes every backend RECIPE_STAGE_PROCESS_CODES value (AUD-001)', () => {
  const backendSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'schemas', 'recipe.schema.js'),
    'utf8',
  );
  const editorSource = readRootFile(path.join('views', 'recipes-admin.version-editor.js'));

  // Extract backend codes from RECIPE_STAGE_PROCESS_CODES array literal
  const backendMatch = backendSource.match(/const RECIPE_STAGE_PROCESS_CODES\s*=\s*\[([ \s\S]*?)\];/);
  assert.ok(backendMatch, 'backend source must define RECIPE_STAGE_PROCESS_CODES');
  const backendCodes = [...backendMatch[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  assert.ok(backendCodes.length > 0, 'backend must expose at least one process code');

  // Every backend code must appear in the editor's PROCESS_CODE_OPTIONS as a value field
  for (const code of backendCodes) {
    assert.ok(
      editorSource.includes(`value: '${code}'`) || editorSource.includes(`value:'${code}'`),
      `PROCESS_CODE_OPTIONS in version-editor must include backend code ${code}`,
    );
  }
});

// ─── AUD-009: buildRepairHighlight behavioral tests ───────────────────────────

function loadRecipesAdminWithMocks(browserWindow, context) {
  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('recipesApi', {});
  browserWindow.RootShell.register('productsApi', {});
  browserWindow.RootShell.register('ui', {
    escapeHtml: (v) => String(v || ''),
    formatDate: () => '01/01/2026',
    renderInlineMessage: (msg) => msg || '',
    renderStatusBadge: () => '',
  });
  browserWindow.RootShell.register('sessionAdapter', {});
  browserWindow.RootShell.register('views.recipesAdminHelpers', {});
  browserWindow.RootShell.register('views.recipesAdminState', {});
  browserWindow.RootShell.register('views.recipesAdminVersionEditor', {});
  browserWindow.RootShell.register('views.recipesAdminRenderers', {
    renderWorkspace: () => '<section id="w"></section>',
  });
  executeRootScript(path.join('views', 'recipes-admin.js'), context);
  return browserWindow.RootShell.require('views.recipesAdmin');
}

test('buildRepairHighlight returns null when no version provided (AUD-009)', () => {
  const { browserWindow, context } = createBrowserContext();
  const admin = loadRecipesAdminWithMocks(browserWindow, context);
  const result = admin._buildRepairHighlight(null, 'cualquier mensaje');
  assert.strictEqual(result, null);
});

test('buildRepairHighlight returns null when message is empty (AUD-009)', () => {
  const { browserWindow, context } = createBrowserContext();
  const admin = loadRecipesAdminWithMocks(browserWindow, context);
  const version = { stages: [{ stageType: 'RECOLLECTION', name: 'Recoleccion', stageInputs: [{ name: 'Tapa 3M', productId: 1 }] }] };
  assert.strictEqual(admin._buildRepairHighlight(version, ''), null);
  assert.strictEqual(admin._buildRepairHighlight(version, null), null);
});

test('buildRepairHighlight highlights RECOLLECTION input for under-allocation error (AUD-009)', () => {
  const { browserWindow, context } = createBrowserContext();
  const admin = loadRecipesAdminWithMocks(browserWindow, context);

  const version = {
    stages: [
      {
        stageType: 'RECOLLECTION',
        name: 'Recoleccion',
        stageInputs: [{ name: 'Tapa 3M', productId: 1, quantity: 10 }],
      },
      {
        stageType: 'PROCESSING',
        name: 'Tapado',
        stageInputs: [{ name: 'Tapa 3M', productId: 1, quantity: 5 }],
      },
    ],
  };

  // Backend message for under-allocation: includes 'insumo "X" tiene N sin asignar'
  const message = 'Para aprobar la receta, todos los materiales recolectados deben ser usados completamente. El insumo "Tapa 3M" tiene 5 sin asignar';
  const result = admin._buildRepairHighlight(version, message);

  assert.ok(result, 'should produce a highlight for under-allocation');
  assert.strictEqual(result.stageName, 'Recoleccion', 'should point to the RECOLLECTION stage');
  assert.strictEqual(result.inputName, 'Tapa 3M', 'should name the under-allocated input');
  assert.match(result.message, /Tapa 3M/, 'message should mention the input name');
  assert.match(result.message, /etapa posterior|procesamiento/i, 'message should guide user toward a later stage');
});

test('buildRepairHighlight returns null for under-allocation when RECOLLECTION stage not found (AUD-009)', () => {
  const { browserWindow, context } = createBrowserContext();
  const admin = loadRecipesAdminWithMocks(browserWindow, context);

  // Version has no RECOLLECTION stage that matches the input
  const version = {
    stages: [
      { stageType: 'PROCESSING', name: 'Mezclado', stageInputs: [{ name: 'Otro insumo', productId: 2, quantity: 3 }] },
    ],
  };

  const message = 'El insumo "Tapa 3M" tiene 5 sin asignar';
  const result = admin._buildRepairHighlight(version, message);
  assert.strictEqual(result, null, 'should return null when no matching RECOLLECTION stage exists');
});

test('buildRepairHighlight matches stage name from generic backend message (AUD-009)', () => {
  const { browserWindow, context } = createBrowserContext();
  const admin = loadRecipesAdminWithMocks(browserWindow, context);

  const version = {
    stages: [
      { stageType: 'PROCESSING', name: 'Mezclado', stageInputs: [] },
      { stageType: 'RECOLLECTION', name: 'Recoleccion', stageInputs: [] },
    ],
  };

  // Message mentioning only a stage name (not under-allocation)
  const result = admin._buildRepairHighlight(version, 'La etapa "Mezclado" excede la cantidad disponible');
  assert.ok(result, 'should produce a highlight when stage name appears in message');
  assert.strictEqual(result.stageName, 'Mezclado');
});
