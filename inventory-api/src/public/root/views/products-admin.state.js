(function attachRootShellProductsAdminState(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function resolveSelectedProductId(items, preferredProductId = null) {
    if (!Array.isArray(items) || !items.length) {
      return null;
    }

    const preferredItem = items.find((item) => String(item?.id) === String(preferredProductId));
    return preferredItem ? preferredItem.id : items[0].id;
  }

  function resolveSelectedProduct(items, selectedProductId) {
    return (items || []).find((item) => String(item?.id) === String(selectedProductId)) || null;
  }

  rootShell.register('views.productsAdminState', {
    resolveSelectedProduct,
    resolveSelectedProductId,
  });
}(window));
