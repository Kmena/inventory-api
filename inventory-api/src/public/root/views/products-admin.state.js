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

  function buildDetailSubtitle(product) {
    if (!product) {
      return 'Selecciona un producto del listado para revisar su detalle contextual.';
    }

    const parts = [];
    if (product?.code) {
      parts.push(`Codigo ${product.code}`);
    }
    if (product?.category?.name) {
      parts.push(product.category.name);
    }

    return parts.join(' · ') || 'Detalle contextual del producto seleccionado.';
  }

  rootShell.register('views.productsAdminState', {
    buildDetailSubtitle,
    resolveSelectedProduct,
    resolveSelectedProductId,
  });
}(window));
