(function attachRootSuppliersApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listCompanySuppliers(session) {
    return inventoryAuth.fetchJson(session, '/api/suppliers/company', {
      fallbackMessage: 'No se pudieron cargar los proveedores.',
    });
  }

  async function createCompanySupplier(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/suppliers/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el proveedor.',
    });
  }

  async function getCompanySupplier(session, id) {
    return inventoryAuth.fetchJson(session, `/api/suppliers/company/${id}`, {
      fallbackMessage: 'No se pudo cargar el detalle del proveedor.',
    });
  }

  async function updateCompanySupplier(session, id, payload) {
    return inventoryAuth.fetchJson(session, `/api/suppliers/company/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo actualizar el proveedor.',
    });
  }

  async function deleteCompanySupplier(session, id) {
    return inventoryAuth.fetchJson(session, `/api/suppliers/company/${id}`, {
      method: 'DELETE',
      fallbackMessage: 'No se pudo eliminar el proveedor.',
    });
  }

  async function addProductToSupplier(session, supplierId, payload) {
    return inventoryAuth.fetchJson(session, `/api/suppliers/company/${supplierId}/products`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo asignar el producto al proveedor.',
    });
  }

  async function removeProductFromSupplier(session, supplierId, productId) {
    return inventoryAuth.fetchJson(session, `/api/suppliers/company/${supplierId}/products/${productId}`, {
      method: 'DELETE',
      fallbackMessage: 'No se pudo remover el producto del proveedor.',
    });
  }

  async function listCompanyProducts(session) {
    return inventoryAuth.fetchJson(session, '/api/products', {
      fallbackMessage: 'No se pudieron cargar los productos.',
    });
  }

  rootShell.register('suppliersApi', {
    listCompanySuppliers,
    createCompanySupplier,
    getCompanySupplier,
    updateCompanySupplier,
    deleteCompanySupplier,
    addProductToSupplier,
    removeProductFromSupplier,
    listCompanyProducts,
  });
}(window));
