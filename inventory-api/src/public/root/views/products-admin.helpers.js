(function attachRootShellProductsAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const DEFAULT_PAGE = 1;
  const DEFAULT_PAGE_SIZE = 10;

  function hasAnyPermission(session, sessionAdapter, permissions) {
    return permissions.some((permission) => sessionAdapter.hasPermission(session, permission));
  }

  function canViewProducts(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['products.view', 'products.manage']);
  }

  function canManageProducts(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['products.manage']);
  }

  function canListCategories(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['products.view', 'products.manage', 'inventory.view', 'inventory.manage']);
  }

  function canCreateCategories(session, sessionAdapter) {
    return hasAnyPermission(session, sessionAdapter, ['products.manage', 'inventory.manage']);
  }

  function createDefaultFilters() {
    return {
      searchTerm: '',
      subcategoryId: '',
    };
  }

  function hasActiveFilters(filters) {
    return Boolean(filters.searchTerm || filters.subcategoryId);
  }

  function normalizeProductsResponse(response) {
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

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function filterProducts(items, filters) {
    const normalizedSearchTerm = normalizeSearchText(filters.searchTerm);
    return (items || []).filter((product) => {
      if (filters.subcategoryId && String(product?.subcategoryId || '') !== String(filters.subcategoryId)) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      const haystack = [
        product?.code,
        product?.name,
        product?.description,
        product?.subcategory?.name,
        product?.category?.name,
      ].map((value) => normalizeSearchText(value)).join(' ');

      return haystack.includes(normalizedSearchTerm);
    });
  }

  function buildVisibleSummary(filteredCount, pageItemsCount, pagination, filters) {
    if (!pagination.totalItems) {
      return hasActiveFilters(filters)
        ? 'No hay resultados con los filtros actuales.'
        : 'Todavia no hay productos registrados para esta empresa.';
    }

    if (hasActiveFilters(filters)) {
      return `Mostrando ${filteredCount} de ${pageItemsCount} productos de esta pagina.`;
    }

    return `Mostrando ${pageItemsCount} producto(s) de ${pagination.totalItems} en la pagina ${pagination.page}.`;
  }

  function formatNumber(value) {
    if (value === undefined || value === null || value === '') {
      return '0';
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value);
    }

    return numericValue.toLocaleString('es-CR', {
      minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  function formatCurrency(value, currency = 'CRC') {
    if (value === undefined || value === null || value === '') {
      return 'Sin precio visible';
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value);
    }

    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: currency || 'CRC',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  function resolveInventoryVisible(product) {
    return typeof product?.quantity !== 'undefined' || typeof product?.reservedQuantity !== 'undefined';
  }

  function buildProductsMetrics(items, categories) {
    const totalSubcategories = (categories || []).reduce(
      (sum, cat) => sum + (cat.subcategories ? cat.subcategories.length : 0),
      0
    );
    const metrics = {
      visibleProducts: items.length,
      visibleCategories: totalSubcategories,
      visibleActiveProducts: items.filter((product) => product?.isActive !== false).length,
      visibleLowStockProducts: items.filter((product) => resolveInventoryVisible(product)
        && Number(product?.minStock || 0) > 0
        && Number(product?.quantity || 0) <= Number(product?.minStock || 0)).length,
    };

    metrics.hasInventoryData = items.some(resolveInventoryVisible);
    return metrics;
  }

  function parseOptionalNumber(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  function buildProductPayload(formData) {
    const subcategoryId = String(formData.get('subcategoryId') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const code = String(formData.get('code') || '').trim();
    const currency = String(formData.get('currency') || '').trim();
    // Los checkboxes HTML solo aparecen en FormData cuando estan marcados ('on').
    // Desmarcado o ausente => null/undefined => false.
    // La casilla viene marcada por defecto en el HTML del formulario.
    const inCatalog = formData.get('inCatalog') === 'on';

    // netContentUnit es el campo de unidad del producto (siempre requerido en el form).
    // Se usa también como `unit` para mantener compatibilidad con el resto del sistema
    // (warehouse SPA, recetas, supplier-quote) que leen product.unit para mostrar labels.
    const rawNetContentUnit = String(formData.get('netContentUnit') || '').trim();

    const payload = {
      name: String(formData.get('name') || '').trim(),
      code: code || undefined,
      description: description || undefined,
      subcategoryId: subcategoryId ? Number(subcategoryId) : null,
      unit: rawNetContentUnit || undefined,
      currency: currency || undefined,
      price: parseOptionalNumber(formData.get('price')),
      minStock: parseOptionalNumber(formData.get('minStock')),
      maxStock: parseOptionalNumber(formData.get('maxStock')),
      inCatalog,
    };

    // netContentUnit siempre se envía (el campo es obligatorio en el form).
    if (rawNetContentUnit) payload.netContentUnit = rawNetContentUnit;

    // TASK-006: campos de presentación comercial para conversión kg.
    // presentationType se envía siempre (null limpia el campo en actualizaciones).
    const rawPresentationType = String(formData.get('presentationType') || '').trim();
    const presentationType = rawPresentationType || null;
    payload.presentationType = presentationType;

    if (presentationType) {
      // netContent es requerido para VOLUME, MASS y LENGTH.
      const netContent = parseOptionalNumber(formData.get('netContent'));
      if (netContent !== undefined) payload.netContent = netContent;

      // density solo aplica a VOLUME.
      if (presentationType === 'VOLUME') {
        const density = parseOptionalNumber(formData.get('density'));
        if (density !== undefined) payload.density = density;
      }

      // kgConversionFactor: requerido en LENGTH, opcional en COUNT.
      if (presentationType === 'LENGTH' || presentationType === 'COUNT') {
        const kgFactor = parseOptionalNumber(formData.get('kgConversionFactor'));
        if (kgFactor !== undefined) payload.kgConversionFactor = kgFactor;
      }
    }

    return payload;
  }

  /**
   * Builds the payload to create a ProductSubcategory.
   * @param {FormData} formData
   */
  function buildSubcategoryPayload(formData) {
    const categoryId = String(formData.get('categoryId') || '').trim();
    const code = String(formData.get('subcategoryCode') || '').trim();
    return {
      name: String(formData.get('name') || '').trim(),
      categoryId: categoryId ? Number(categoryId) : undefined,
      code: code || undefined,
    };
  }

  /**
   * Returns a flat list of all subcategories across all categories.
   * @param {Array} categories - array returned by GET /categories/company
   */
  function getAllSubcategories(categories) {
    return (categories || []).flatMap((category) =>
      (category.subcategories || []).map((sub) => ({
        ...sub,
        categoryType: category.categoryType,
        categoryName: category.name,
      }))
    );
  }

  function getCategoryTypeLabel(categoryType) {
    switch (String(categoryType || '').toUpperCase()) {
      case 'MP':
        return 'Materia prima';
      case 'EM':
        return 'Empaque';
      case 'PT':
      default:
        return 'Producto terminado';
    }
  }

  /**
   * Checks if a subcategory name already exists within the given parent category.
   * Case-insensitive and trim-normalized comparison.
   * Returns a warning message string if duplicate found, null otherwise.
   * Degrades gracefully: returns null if data is unavailable.
   * @param {Array} categories - Array from GET /api/products/categories/company
   * @param {string|number} categoryId - Parent category ID
   * @param {string} name - Subcategory name to check
   * @returns {string|null}
   */
  function checkSubcategoryNameDuplicate(categories, categoryId, name) {
    if (!categories || !categoryId || !name) return null;
    const parentCat = (categories || []).find((c) => String(c.id) === String(categoryId));
    if (!parentCat) return null;
    const normalizedName = String(name).trim().toLowerCase();
    const existing = (parentCat.subcategories || []).find(
      (s) => String(s.name || '').trim().toLowerCase() === normalizedName
    );
    if (existing) {
      return `"${existing.name}" ya existe en ${parentCat.name}. Seleccionala en el formulario de producto.`;
    }
    return null;
  }

  rootShell.register('views.productsAdminHelpers', {
    buildSubcategoryPayload,
    buildProductPayload,
    checkSubcategoryNameDuplicate,
    buildProductsMetrics,
    buildVisibleSummary,
    canCreateCategories,
    canListCategories,
    canManageProducts,
    canViewProducts,
    createDefaultFilters,
    DEFAULT_PAGE_SIZE,
    filterProducts,
    formatCurrency,
    formatNumber,
    getAllSubcategories,
    getCategoryTypeLabel,
    hasActiveFilters,
    normalizeProductsResponse,
    resolveInventoryVisible,
  });
}(window));
