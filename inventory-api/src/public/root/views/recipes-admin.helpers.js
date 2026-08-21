(function attachRootShellRecipesAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  function hasAnyPermission(session, sessionAdapter, permissions) {
    return permissions.some((permission) => sessionAdapter.hasPermission(session, permission));
  }

  function canViewRecipes(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['recipes.view', 'recipes.manage', 'recipes.approve']);
  }

  function canManageRecipes(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['recipes.manage']);
  }

  function canApproveRecipes(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['recipes.approve']);
  }

  function canViewAssignableProducts(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['products.view', 'products.manage']);
  }

  function canAssignRecipesToProducts(session, sessionAdapter) {
    return canManageRecipes(session, sessionAdapter)
      && hasAnyPermission(session, sessionAdapter, ['products.manage']);
  }

  function normalizeRecipeListResponse(response) {
    if (Array.isArray(response)) {
      return {
        items: response,
        pagination: {
          page: DEFAULT_PAGE,
          pageSize: response.length || DEFAULT_PAGE_SIZE,
          totalItems: response.length,
          totalPages: response.length ? 1 : 0,
        },
      };
    }

    const items = Array.isArray(response?.items) ? response.items : [];
    const pagination = response?.pagination && typeof response.pagination === 'object'
      ? response.pagination
      : {};

    return {
      items,
      pagination: {
        page: Number(pagination.page) || DEFAULT_PAGE,
        pageSize: Number(pagination.pageSize) || DEFAULT_PAGE_SIZE,
        totalItems: Number(pagination.totalItems) || items.length,
        totalPages: Number(pagination.totalPages) || (items.length ? 1 : 0),
      },
    };
  }

  function buildRecipeAssignmentPayload(recipeId) {
    if (recipeId === undefined || recipeId === null || recipeId === '') {
      return { recipeId: null };
    }

    return { recipeId: Number(recipeId) };
  }

  function resolveAppliedVersionLabel(product) {
    const appliedVersion = product?.recipeVersion || product?.activeRecipeVersion || product?.assignedRecipeVersion || null;
    if (appliedVersion?.versionNumber) {
      return `v${appliedVersion.versionNumber}`;
    }

    return 'No definida explicitamente';
  }

  function hasExplicitProductRecipeVersion(product) {
    return Boolean(
      product?.recipeVersionId
      || product?.recipeVersion?.id
      || product?.activeRecipeVersion?.id
      || product?.assignedRecipeVersion?.id
    );
  }

  /**
   * Builds a patch for a stage-input row when the user selects a product.
   * Returns `{ unit, unitReadonly }` to apply to the row's unit field.
   */
  function buildStageInputPatchFromProduct(product) {
    if (!product || !product.unit) {
      return { unit: '', unitReadonly: false };
    }
    return { unit: String(product.unit), unitReadonly: true };
  }

  /** Returns a blank QA parameter template for the editor. */
  function buildDefaultQaParameter() {
    return { name: '', unit: '', expectedValue: '', minTolerance: '0', maxTolerance: '0' };
  }

  rootShell.register('views.recipesAdminHelpers', {
    buildDefaultQaParameter,
    buildRecipeAssignmentPayload,
    buildStageInputPatchFromProduct,
    canApproveRecipes,
    canAssignRecipesToProducts,
    canManageRecipes,
    canViewAssignableProducts,
    canViewRecipes,
    hasExplicitProductRecipeVersion,
    normalizeRecipeListResponse,
    resolveAppliedVersionLabel,
  });
}(window));
