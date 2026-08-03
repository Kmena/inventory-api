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

function serializeProductForPermissions(product, auth) {
  if (!product) return product;
  const enrichedProduct = Array.isArray(product.warehouseLotStocks)
    ? {
        ...product,
        warehouseLotStocks: product.warehouseLotStocks.map(decorateWarehouseLotStock),
      }
    : product;
  if (hasPermission(auth, 'inventory.view', 'inventory.manage')) return enrichedProduct;
  const {
    quantity: _quantity,
    reservedQuantity: _reservedQuantity,
    minStock: _minStock,
    maxStock: _maxStock,
    standbyStock: _standbyStock,
    warehouseStocks: _warehouseStocks,
    warehouseLotStocks: _warehouseLotStocks,
    ...catalogProduct
  } = enrichedProduct;
  return catalogProduct;
}

module.exports = {
  hasPermission,
  serializeProductForPermissions,
};
