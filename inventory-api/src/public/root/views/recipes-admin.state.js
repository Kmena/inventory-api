(function attachRootShellRecipesAdminState(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function createDefaultFilters() {
    return {
      searchTerm: '',
      recipeType: '',
      sharedOnly: '',
      status: '',
    };
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function buildRecipeTypeOptions(recipes) {
    return [...new Set((recipes || []).map((recipe) => String(recipe?.recipeType || '').trim()).filter(Boolean))].sort();
  }

  function buildAssociatedProductsByRecipeId(products, recipesHelpers) {
    return (products || []).reduce((groups, product) => {
      const recipeId = product?.recipeId ?? product?.recipe?.id;
      if (!recipeId) {
        return groups;
      }

      const normalizedProduct = {
        ...product,
        appliedVersionLabel: recipesHelpers.resolveAppliedVersionLabel(product),
        hasExplicitRecipeVersion: recipesHelpers.hasExplicitProductRecipeVersion(product),
      };

      const key = String(recipeId);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(normalizedProduct);
      return groups;
    }, {});
  }

  function decorateRecipes(recipes, associatedProductsByRecipeId) {
    return (recipes || []).map((recipe) => {
      const associatedProducts = associatedProductsByRecipeId[String(recipe?.id)] || [];
      return {
        ...recipe,
        associatedProductsCount: associatedProducts.length,
      };
    });
  }

  function filterRecipes(recipes, filters) {
    const normalizedSearchTerm = normalizeSearchText(filters.searchTerm);
    return (recipes || []).filter((recipe) => {
      if (filters.recipeType && String(recipe?.recipeType || '') !== String(filters.recipeType)) {
        return false;
      }

      if (filters.status === 'active' && recipe?.isActive === false) {
        return false;
      }
      if (filters.status === 'inactive' && recipe?.isActive !== false) {
        return false;
      }

      if (filters.sharedOnly === 'yes' && Number(recipe?.associatedProductsCount || 0) < 2) {
        return false;
      }
      if (filters.sharedOnly === 'no' && Number(recipe?.associatedProductsCount || 0) > 1) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      const haystack = [recipe?.code, recipe?.name, recipe?.recipeType]
        .map(normalizeSearchText)
        .join(' ');
      return haystack.includes(normalizedSearchTerm);
    });
  }

  function resolveSelectedRecipeId(recipes, preferredRecipeId = null) {
    if (!Array.isArray(recipes) || !recipes.length) {
      return null;
    }

    const preferredRecipe = recipes.find((recipe) => String(recipe?.id) === String(preferredRecipeId));
    return preferredRecipe ? preferredRecipe.id : recipes[0].id;
  }

  function resolveSelectedRecipe(recipes, selectedRecipeId) {
    return (recipes || []).find((recipe) => String(recipe?.id) === String(selectedRecipeId)) || null;
  }

  function buildRecipeMetrics(recipes) {
    return {
      totalRecipes: (recipes || []).length,
      activeRecipes: (recipes || []).filter((recipe) => recipe?.isActive !== false).length,
      recipesWithDraft: (recipes || []).filter((recipe) => (recipe?.versions || []).some((version) => version?.status !== 'APPROVED')).length,
      sharedRecipes: (recipes || []).filter((recipe) => Number(recipe?.associatedProductsCount || 0) > 1).length,
    };
  }

  function serializeVersionPayloadFromForm(rawValues) {
    const payload = {
      stages: rawValues.stages,
    };

    // TASK-006: 'quantityBasis' agregado al conjunto de campos serializables.
    for (const fieldName of ['effectiveFrom', 'effectiveTo', 'expectedYield', 'expectedWaste', 'yieldTolerancePercent', 'wasteTolerancePercent', 'instructions', 'notes', 'quantityBasis']) {
      if (rawValues[fieldName] !== undefined) {
        payload[fieldName] = rawValues[fieldName];
      }
    }

    return payload;
  }

  rootShell.register('views.recipesAdminState', {
    buildAssociatedProductsByRecipeId,
    buildRecipeMetrics,
    buildRecipeTypeOptions,
    createDefaultFilters,
    decorateRecipes,
    filterRecipes,
    resolveSelectedRecipe,
    resolveSelectedRecipeId,
    serializeVersionPayloadFromForm,
  });
}(window));
