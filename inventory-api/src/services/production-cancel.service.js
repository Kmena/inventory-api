/**
 * Production Cancel Service
 *
 * Handles the "cancel with optional material returns" flow.
 * Extracted from production.service.js to respect the ≤ 600-line limit.
 *
 * Exported surface:
 *   processReturns(tx, auth, order, returns, companyId)
 *
 * Called exclusively from production.service.js#cancelProductionOrder.
 */

'use strict';

const { randomUUID } = require('crypto');
const { createHttpError } = require('../lib/errors');
const inventoryRepository = require('../repositories/inventory.repository');
const productRepository = require('../repositories/product.repository');
const inventoryTransactionSupport = require('./inventory-transaction-support.service');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the lot for a return item.
 * Option A — targetLotId present: find and validate the existing lot.
 * Option B — newLotCode present:  create a brand-new lot in the origin warehouse.
 *
 * @param {object}  tx
 * @param {object}  auth
 * @param {object}  order        - production order (needs originWarehouseId)
 * @param {object}  item         - single validated return item
 * @param {bigint}  companyId
 * @param {bigint}  productId
 * @param {number}  quantity
 * @returns {Promise<object>}    resolved lot record
 */
async function resolveLot(tx, auth, order, item, companyId, productId, quantity) {
  if (item.targetLotId) {
    const lotId = BigInt(item.targetLotId);
    const lot = await inventoryRepository.findLotForProduct(lotId, productId, tx);
    if (!lot) {
      throw createHttpError(
        404,
        `Lote ${lotId} no encontrado para el producto ${productId}`,
        'not_found',
      );
    }
    return lot;
  }

  // Create new lot
  const lotCode = String(item.newLotCode || '').trim();
  if (!lotCode) {
    throw createHttpError(
      400,
      'Debe especificar targetLotId (lote existente) o newLotCode (lote nuevo) para cada devolucion con cantidad > 0',
      'validation_error',
    );
  }

  const resolution = await inventoryTransactionSupport.resolveUniqueInternalLotNumber(
    tx,
    companyId,
    lotCode,
  );

  return inventoryRepository.createLot({
    companyId,
    productId,
    lotNumber:          lotCode,
    internalLotNumber:  resolution.assigned,
    entryDate:          new Date(),
    expirationDate:     item.expirationDate ?? null,
    quantity,
    originalQuantity:   quantity,
    status:    'AVAILABLE',
    qaStatus:  'PENDING',
  }, tx);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process material returns as part of order cancellation.
 *
 * All stock movements go to the order's origin warehouse.
 * Items with quantity <= 0 must be filtered out by the caller.
 *
 * @param {object}   tx          Prisma transaction client
 * @param {object}   auth        Auth context (for getInventoryContext)
 * @param {object}   order       Full production order (needs originWarehouseId)
 * @param {Array}    returns     Return items (quantity > 0 guaranteed)
 * @param {bigint}   companyId
 */
async function processReturns(tx, auth, order, returns, companyId) {
  if (!order.originWarehouseId) {
    throw createHttpError(
      409,
      'La orden no tiene bodega origen configurada; no se pueden registrar devoluciones',
      'conflict',
    );
  }

  const movementGroupId = randomUUID();

  for (const item of returns) {
    const productId = BigInt(item.productId);
    const quantity  = Number(item.quantity);

    const product = await productRepository.findProductById(productId, companyId, tx);
    if (!product) {
      throw createHttpError(404, `Producto ${productId} no encontrado`, 'not_found');
    }

    const context = await inventoryTransactionSupport.getInventoryContext(
      tx,
      auth,
      order.originWarehouseId,
      productId,
    );

    const lot = await resolveLot(tx, auth, order, item, companyId, productId, quantity);

    const warehouseStock = await inventoryTransactionSupport.changeWarehouseStock(
      tx, context, quantity, 0,
    );

    await inventoryTransactionSupport.changeLotStock(tx, context, lot, quantity, 0);

    await inventoryRepository.updateProductById(
      productId,
      companyId,
      { quantity: { increment: quantity } },
      tx,
    );

    await inventoryTransactionSupport.createMovement(tx, context, {
      lotId:          lot.id,
      movementType:   'IN',
      quantity,
      quantityBefore: warehouseStock.before,
      quantityAfter:  warehouseStock.after,
      reasonCode:     'PRODUCTION_RETURN',
      movementGroupId,
      sourceType:     'production_order',
      sourceId:       order.id,
      note:           item.note ?? `Devolucion por cancelacion de orden #${order.id}`,
    });
  }
}

module.exports = { processReturns };
