(function attachRootShellSuppliersAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function escapeHtml(text) {
    return rootShellUi.escapeHtml(text);
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sortSuppliersByName(suppliers) {
    return [...suppliers].sort((leftSupplier, rightSupplier) => {
      const leftName = normalizeSearchText(leftSupplier?.name);
      const rightName = normalizeSearchText(rightSupplier?.name);
      return leftName.localeCompare(rightName, 'es');
    });
  }

  function filterSuppliers(suppliers, searchText) {
    const orderedSuppliers = sortSuppliersByName(Array.isArray(suppliers) ? suppliers : []);
    const term = normalizeSearchText(searchText);
    if (!term) {
      return orderedSuppliers;
    }

    return orderedSuppliers.filter((supplier) => {
      const haystack = String(supplier.name || '').toLowerCase();
      return haystack.includes(term);
    });
  }

  function filterAvailableProducts(products, assignedProducts, searchText) {
    const assignedIds = new Set((assignedProducts || []).map((p) => String(p.productId)));
    const available = (products || []).filter((p) => !assignedIds.has(String(p.id)));
    const term = normalizeSearchText(searchText);

    if (!term) {
      return available;
    }

    return available.filter((p) => {
      const name = normalizeSearchText(p.name);
      const code = normalizeSearchText(p.code);
      return name.includes(term) || code.includes(term);
    });
  }

  function buildSupplierMetrics(suppliers) {
    const total = suppliers.length;
    const withProducts = suppliers.filter((s) => (s.productCount || 0) > 0).length;
    const withoutProducts = total - withProducts;

    return { total, withProducts, withoutProducts };
  }

  function formatDate(dateString) {
    if (!dateString) {
      return 'Sin fecha';
    }

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_error) {
      return 'Sin fecha';
    }
  }

  rootShell.register('views.suppliersAdminHelpers', {
    escapeHtml,
    filterSuppliers,
    filterAvailableProducts,
    sortSuppliersByName,
    buildSupplierMetrics,
    formatDate,
    normalizeSearchText,
  });
}(window));
