const inventoryService = require('./inventory.service');

function hasPermission(auth, ...allowedPermissions) {
  const permissions = auth?.permissions || [];
  return allowedPermissions.some((permission) => permissions.includes(permission));
}

function decorateWarehouseLotStock(stock) {
  if (!stock?.lot) return stock;
  return {
    ...stock,
    lot: {
      ...stock.lot,
      derivedUsability: inventoryService.deriveLotUsability(stock.lot),
    },
  };
}

/**
 * Adds the derived `inventoryApplicability` field required by the master plan
 * so the frontend can safely render "No aplica" for products that do not
 * control inventory. See
 * specs/non-physical-products-mvp/api-contracts.md §1 and
 * specs/inventori-product-inventory-master-plan/integration-gates.md
 * CHECKPOINT A / CHECKPOINT I.
 *
 * The field is derived — never persisted — so it can be recomputed safely on
 * every read without a migration.
 *
 * @param {any} product - Product row already enriched with warehouseLotStocks.
 * @returns {any} Product with `inventoryApplicability` populated.
 */
function withInventoryApplicability(product) {
  if (!product) return product;
  if (Object.prototype.hasOwnProperty.call(product, 'inventoryApplicability')) {
    return product;
  }
  const controlsInventory = product.controlsInventory !== false;
  return {
    ...product,
    inventoryApplicability: controlsInventory ? 'APPLIES' : 'NOT_APPLICABLE',
  };
}

function serializeProductForPermissions(product, auth) {
  if (!product) return product;
  const enrichedProduct = Array.isArray(product.warehouseLotStocks)
    ? {
        ...product,
        warehouseLotStocks: product.warehouseLotStocks.map(decorateWarehouseLotStock),
      }
    : product;
  const productWithApplicability = withInventoryApplicability(enrichedProduct);
  if (hasPermission(auth, 'inventory.view', 'inventory.manage')) return productWithApplicability;
  const {
    quantity: _quantity,
    reservedQuantity: _reservedQuantity,
    minStock: _minStock,
    maxStock: _maxStock,
    standbyStock: _standbyStock,
    warehouseStocks: _warehouseStocks,
    warehouseLotStocks: _warehouseLotStocks,
    ...catalogProduct
  } = productWithApplicability;
  return catalogProduct;
}

module.exports = {
  hasPermission,
  serializeProductForPermissions,
};
