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
   * Returns canonical product-derived fields so the editor does not duplicate
   * user input that already exists in the selected catalog item.
   */
  function buildStageInputPatchFromProduct(product) {
    if (!product) {
      return {
        name: '',
        unit: '',
        unitReadonly: false,
      };
    }
    return {
      name: String(product.name || ''),
      unit: String(product.unit || ''),
      unitReadonly: Boolean(product.unit),
    };
  }

  const QUANTITY_BASIS_LABELS = {
    PER_OUTPUT_KG: 'Por kg de producto terminado',
    PER_FINISHED_UNIT: 'Por unidad terminada',
  };

  const QUANTITY_BASIS_HINTS = {
    PER_OUTPUT_KG: 'Esta version calcula los insumos por cada 1 kg de producto terminado. Usala cuando la receta se controle por peso de salida.',
    PER_FINISHED_UNIT: 'Esta version calcula los insumos por cada 1 unidad terminada. Usala cuando cada unidad final consume una cantidad fija de insumos, por ejemplo 1 tapa por producto terminado.',
  };

  function getQuantityBasisLabel(quantityBasis) {
    return QUANTITY_BASIS_LABELS[quantityBasis] || QUANTITY_BASIS_LABELS.PER_OUTPUT_KG;
  }

  function getQuantityBasisHint(quantityBasis) {
    return QUANTITY_BASIS_HINTS[quantityBasis] || QUANTITY_BASIS_HINTS.PER_OUTPUT_KG;
  }

  function isUnitEach(unit) {
    return String(unit || '').trim().toUpperCase() === 'UN';
  }

  function isCountLikeProduct(product) {
    return String(product?.presentationType || '').trim().toUpperCase() === 'COUNT'
      || isUnitEach(product?.unit)
      || isUnitEach(product?.netContentUnit);
  }

  function buildStageInputOptionLabel(product) {
    const parts = [product?.name || 'Producto'];
    if (product?.code) {
      parts.push(product.code);
    }
    if (product?.unit) {
      parts.push(product.unit);
    }
    if (isCountLikeProduct(product)) {
      parts.push('COUNT/UN');
    }
    return parts.join(' · ');
  }

  function getProductCategoryKey(product) {
    const categoryId = product?.category?.id;
    if (categoryId === undefined || categoryId === null || categoryId === '') {
      return '';
    }
    return String(categoryId);
  }

  function getProductSubcategoryKey(product) {
    const subcategoryId = product?.subcategory?.id;
    if (subcategoryId === undefined || subcategoryId === null || subcategoryId === '') {
      return '';
    }
    return String(subcategoryId);
  }

  function buildStageInputFilterCatalog(products) {
    const categoriesById = new Map();

    (products || []).forEach((product) => {
      const categoryId = getProductCategoryKey(product);
      if (!categoryId) {
        return;
      }
      if (!categoriesById.has(categoryId)) {
        categoriesById.set(categoryId, {
          id: categoryId,
          name: String(product?.category?.name || 'Sin categoria'),
          subcategoriesById: new Map(),
        });
      }
      const category = categoriesById.get(categoryId);
      const subcategoryId = getProductSubcategoryKey(product);
      if (!subcategoryId) {
        return;
      }
      if (!category.subcategoriesById.has(subcategoryId)) {
        category.subcategoriesById.set(subcategoryId, {
          id: subcategoryId,
          name: String(product?.subcategory?.name || 'Sin subcategoria'),
        });
      }
    });

    return Array.from(categoriesById.values())
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
      .map((category) => ({
        id: category.id,
        name: category.name,
        subcategories: Array.from(category.subcategoriesById.values()).sort((left, right) => left.name.localeCompare(right.name, 'es')),
      }));
  }

  function filterProductsForStageSelector(products, filters = {}) {
    const normalizedTerm = String(filters.searchTerm || '').trim().toLowerCase();
    const categoryId = String(filters.categoryId || '');
    const subcategoryId = String(filters.subcategoryId || '');
    const countOnly = Boolean(filters.countOnly);

    return (products || []).filter((product) => {
      if (countOnly && !isCountLikeProduct(product)) {
        return false;
      }
      if (categoryId && getProductCategoryKey(product) !== categoryId) {
        return false;
      }
      if (subcategoryId && getProductSubcategoryKey(product) !== subcategoryId) {
        return false;
      }
      if (!normalizedTerm) {
        return true;
      }
      const haystack = [
        product?.name || '',
        product?.code || '',
        product?.category?.name || '',
        product?.subcategory?.name || '',
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }

  /** Returns a blank QA parameter template for the editor. */
  function buildDefaultQaParameter() {
    return { name: '', unit: '', expectedValue: '', minTolerance: '0', maxTolerance: '0' };
  }

  /**
   * Returns the effective scaling basis for a single stage input.
   * FR-005, BR-002: inputQuantityBasis overrides versionQuantityBasis when set.
   * @param {string|null|undefined} inputQuantityBasis
   * @param {string|null|undefined} versionQuantityBasis
   * @returns {'PER_OUTPUT_KG'|'PER_FINISHED_UNIT'}
   */
  function getEffectiveInputBasis(inputQuantityBasis, versionQuantityBasis) {
    return /** @type {any} */ (inputQuantityBasis ?? versionQuantityBasis ?? 'PER_OUTPUT_KG');
  }

  /**
   * Whether the per-unit checkbox should be shown for a given stage input row.
   * FR-003, FR-008, FR-009, BR-003, D-004.
   * Hidden when: version already is PER_FINISHED_UNIT, or input is not COUNT/UN.
   * @param {any} product
   * @param {string} unitValue
   * @param {string|null|undefined} versionQuantityBasis
   * @returns {boolean}
   */
  function shouldShowPerUnitCheckbox(product, unitValue, versionQuantityBasis) {
    if (versionQuantityBasis === 'PER_FINISHED_UNIT') return false;
    return isCountLikeProduct(product) || isUnitEach(String(unitValue || '').trim().toUpperCase());
  }

  rootShell.register('views.recipesAdminHelpers', {
    buildDefaultQaParameter,
    buildRecipeAssignmentPayload,
    buildStageInputFilterCatalog,
    buildStageInputOptionLabel,
    buildStageInputPatchFromProduct,
    filterProductsForStageSelector,
    getProductCategoryKey,
    getProductSubcategoryKey,
    getQuantityBasisHint,
    getQuantityBasisLabel,
    getEffectiveInputBasis,
    isCountLikeProduct,
    isUnitEach,
    shouldShowPerUnitCheckbox,
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
