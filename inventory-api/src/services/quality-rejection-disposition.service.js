/**
 * quality-rejection-disposition.service.js
 *
 * Feature: qa-rejection-disposition-and-continuation (TASK-003)
 *
 * Encapsulates all material-disposition logic for the QA rejection flow:
 *   - RETURN  → stock IN movement + ProductionReturn record
 *   - DISCARD → ProductionStageLoss record (no stock movement, BR-006)
 *   - RECOLLECT → collects items for ProductionRecolectionStage
 *
 * DEC-004: disposición fina is used for INVALIDATED executions too —
 * NOT auto-DISCARD. The inspector declares dispositions per execution.
 *
 * BR-001: sum(RETURN qty + DISCARD qty) ≤ consumed per (productId, lotId)
 * BR-002: RECOLLECT has no quantity restriction
 * BR-005: RETURN items require advisory lock (acquired by caller)
 * BR-006: DISCARD does NOT move stock
 */

'use strict';

const { createHttpError } = require('../lib/errors');
const productionRepository = require('../repositories/production.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const inventoryTransactionSupport = require('./inventory-transaction-support.service');
const { randomUUID } = require('node:crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Validation — BR-001
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that RETURN + DISCARD quantities do not exceed consumed per (productId, lotId).
 * RECOLLECT and REUSE are excluded from this check (BR-002).
 *
 * When the execution has no direct consumptions and optionAConsumptions is provided,
 * validation falls back to the Option A scope (all prior non-INVALIDATED executions up
 * to and including the failed stage). This supports rejection flows where the failed
 * stage itself has no direct inventory movements but upstream stages did.
 *
 * @param {bigint} stageExecutionId
 * @param {Array<{productId:bigint, lotId:bigint, disposition:string, quantity?:number|null}>} dispositions
 * @param {Array<{productId:string|bigint, lotId:string|bigint, quantity:number}>|null} [optionAConsumptions]
 */
async function validateDispositions(stageExecutionId, dispositions, optionAConsumptions = null) {
  if (!dispositions || dispositions.length === 0) {
    return;
  }

  const accountableDispositions = dispositions.filter(
    (d) => d.disposition === 'RETURN' || d.disposition === 'DISCARD',
  );

  if (accountableDispositions.length === 0) {
    return;
  }

  // Use direct execution consumptions first; fall back to Option A scope when empty.
  let consumptions = await productionRepository.findConsumptionsByExecutionId(stageExecutionId);
  if (consumptions.length === 0 && Array.isArray(optionAConsumptions) && optionAConsumptions.length > 0) {
    consumptions = /** @type {any} */ (optionAConsumptions.map((e) => ({
      productId: e.productId,
      lotId: e.lotId,
      quantity: e.quantity,
    })));
  }

  const consumedMap = new Map();
  for (const c of consumptions) {
    const key = `${c.productId}:${c.lotId}`;
    consumedMap.set(key, (consumedMap.get(key) || 0) + Number(c.quantity));
  }

  const declaredMap = new Map();
  for (const d of accountableDispositions) {
    const key = `${d.productId}:${d.lotId}`;
    declaredMap.set(key, (declaredMap.get(key) || 0) + Number(d.quantity || 0));
  }

  const violations = [];
  for (const [key, declaredQty] of declaredMap.entries()) {
    const consumed = consumedMap.get(key) || 0;
    if (declaredQty > consumed + 0.0001) {
      const [productId, lotId] = key.split(':');
      violations.push({ productId, lotId, declared: declaredQty, consumed });
    }
  }

  if (violations.length > 0) {
    const detail = violations
      .map((v) => `producto ${v.productId}/lote ${v.lotId}: declarado ${v.declared}, consumido ${v.consumed}`)
      .join('; ');
    throw createHttpError(
      400,
      `La cantidad de disposición declarada supera la cantidad consumida: ${detail}`,
      'validation_error',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN item — stock IN movement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a stock IN movement and ProductionReturn record for a RETURN item.
 * Advisory lock MUST be acquired by the caller before calling this function (BR-005).
 *
 * @param {object} tx - Prisma transaction client
 * @param {object} auth
 * @param {object} order - ProductionOrder (must have originWarehouseId)
 * @param {object} execution - ProductionStageExecution
 * @param {{productId:bigint, lotId:bigint, quantity:number}} item
 * @returns {Promise<{productionReturnId:bigint, productId:bigint, lotId:bigint, quantity:number} | null>}
 */
async function processReturnItem(tx, auth, order, execution, item) {
  if (!item.quantity || item.quantity <= 0) {
    return null;
  }

  if (!order.originWarehouseId) {
    throw createHttpError(
      409,
      'La orden de producción debe tener bodega origen para registrar devoluciones',
      'conflict',
    );
  }

  const context = await inventoryTransactionSupport.getInventoryContext(
    tx,
    auth,
    order.originWarehouseId,
    item.productId,
  );

  const lot = await inventoryRepository.findLotForProduct(item.lotId, context.product.id, tx);
  if (!lot) {
    throw createHttpError(
      404,
      `Lote ${item.lotId} no encontrado para el producto en la devolución`,
      'not_found',
    );
  }

  const movementGroupId = randomUUID();
  const warehouseStock = await inventoryTransactionSupport.changeWarehouseStock(
    tx, context, item.quantity, 0,
  );

  await inventoryRepository.updateProductById(
    context.product.id,
    context.companyId,
    { quantity: { increment: item.quantity } },
    tx,
  );

  await inventoryTransactionSupport.changeLotStock(tx, context, lot, item.quantity, 0);
  await inventoryRepository.updateLotById(
    lot.id,
    { quantity: { increment: item.quantity } },
    tx,
  );

  const createdReturn = await productionRepository.createProductionReturn({
    stageExecutionId: execution.id,
    productionOrderId: order.id,
    warehouseId: context.warehouse.id,
    productId: context.product.id,
    lotId: lot.id,
    responsibleUserId: context.userId,
    quantity: item.quantity,
    reasonCode: 'PRODUCTION_REJECTION_RETURN',
    note: null,
    movementGroupId,
    returnedAt: new Date(),
  }, tx);

  await inventoryTransactionSupport.createMovement(tx, context, {
    lotId: lot.id,
    movementType: 'IN',
    quantity: item.quantity,
    quantityBefore: warehouseStock.before,
    quantityAfter: warehouseStock.after,
    reasonCode: 'PRODUCTION_REJECTION_RETURN',
    movementGroupId,
    sourceType: 'production_return',
    sourceId: createdReturn.id,
    note: null,
  });

  return {
    productionReturnId: createdReturn.id,
    productId: item.productId,
    lotId: item.lotId,
    quantity: item.quantity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCARD item — audit record only, no stock movement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a ProductionStageLoss for a DISCARD item. No stock movement (BR-006).
 *
 * @param {object} tx
 * @param {{companyId:bigint, orderId:bigint, executionId:bigint, item:{productId:bigint, lotId:bigint, quantity:number}, userId:bigint|null}} params
 * @returns {Promise<{stageLossId:bigint, productId:bigint, lotId:bigint, quantity:number} | null>}
 */
async function processDiscardItem(tx, { companyId, orderId, executionId, item, userId }) {
  if (!item.quantity || item.quantity <= 0) {
    return null;
  }

  const record = await productionRepository.createStageLoss({
    companyId,
    productionOrderId: orderId,
    stageExecutionId: executionId,
    productId: BigInt(item.productId),
    lotId: BigInt(item.lotId),
    quantity: item.quantity,
    reasonCode: 'QA_REJECTION_DISCARD',
    note: null,
    registeredByUserId: userId,
  }, tx);

  return {
    stageLossId: record.id,
    productId: item.productId,
    lotId: item.lotId,
    quantity: item.quantity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOLLECT aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collects RECOLLECT items from dispositions into a list for ProductionRecolectionStage.
 * Groups by productId summing quantities.
 *
 * @param {Array<{productId:bigint, lotId:bigint, disposition:string, quantity?:number|null}>} dispositions
 * @param {any[]} [materialRequirements] - For optional productName / unit enrichment
 * @returns {Array<{productId:string, quantity:number, productName:string|null, unit:string|null}>}
 */
function collectRecolectItems(dispositions, materialRequirements) {
  const recolectItems = (dispositions || []).filter((d) => d.disposition === 'RECOLLECT');
  if (recolectItems.length === 0) { return []; }

  const nameMap = new Map();
  for (const req of (materialRequirements || [])) {
    if (req.productId) {
      nameMap.set(String(req.productId), { name: req.product?.name || null, unit: req.product?.unit || null });
    }
  }

  const byProductId = new Map();
  for (const item of recolectItems) {
    const pid = String(item.productId);
    const prev = byProductId.get(pid) || 0;
    byProductId.set(pid, prev + Number(item.quantity || 0));
  }

  return Array.from(byProductId.entries()).map(([pid, qty]) => ({
    productId: pid,
    quantity: qty,
    productName: nameMap.get(pid)?.name || null,
    unit: nameMap.get(pid)?.unit || null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes all dispositions for a single stage execution.
 * Returns a summary of what was processed.
 *
 * The caller is responsible for:
 * - Acquiring the advisory lock if any RETURN items exist (BR-005 / DEC-002).
 * - Calling this function inside a transaction.
 *
 * @param {object} tx - Prisma tx client
 * @param {object} auth
 * @param {object} order
 * @param {object} execution - ProductionStageExecution
 * @param {Array<{productId:bigint, lotId:bigint, disposition:string, quantity?:number|null}>} dispositions
 * @param {any[]} [materialRequirements]
 * @returns {Promise<{returned:any[], discarded:any[], recolectItems:any[]}>}
 */
/**
 * @param {object} tx
 * @param {object} auth
 * @param {object} order
 * @param {object} execution
 * @param {Array<{productId:bigint, lotId:bigint, disposition:string, quantity?:number|null}>} dispositions
 * @param {any[]} [materialRequirements]
 * @param {Array<{productId:string|bigint, lotId:string|bigint, quantity:number}>|null} [optionAConsumptions]
 */
async function processRejectionDispositions(tx, auth, order, execution, dispositions, materialRequirements, optionAConsumptions = null) {
  const companyId = order.companyId;
  const userId = auth?.sub ? BigInt(auth.sub) : null;

  await validateDispositions(execution.id, dispositions || [], optionAConsumptions);

  const returned = [];
  const discarded = [];

  for (const item of (dispositions || [])) {
    if (item.disposition === 'RETURN') {
      if (item.quantity === null || item.quantity === undefined || item.quantity <= 0) {
        throw createHttpError(400, 'RETURN requiere una cantidad positiva', 'validation_error');
      }
      const result = await processReturnItem(tx, auth, order, execution, {
        productId: item.productId,
        lotId: item.lotId,
        quantity: Number(item.quantity),
      });
      if (result) { returned.push(result); }
    } else if (item.disposition === 'DISCARD') {
      if (item.quantity === null || item.quantity === undefined || item.quantity <= 0) {
        throw createHttpError(400, 'DISCARD requiere una cantidad positiva', 'validation_error');
      }
      const result = await processDiscardItem(tx, {
        companyId,
        orderId: order.id,
        executionId: execution.id,
        item: {
          productId: item.productId,
          lotId: item.lotId,
          quantity: Number(item.quantity),
        },
        userId,
      });
      if (result) { discarded.push(result); }
    }
    // RECOLLECT: collected separately via collectRecolectItems
  }

  // Mark lossesAcknowledged on the execution (even for empty dispositions)
  await productionRepository.acknowledgeStageExecutionLosses(execution.id, tx);

  const recolectItems = collectRecolectItems(dispositions, materialRequirements);

  return { returned, discarded, recolectItems };
}

/**
 * Invalidates a stage execution with disposición fina (DEC-004).
 * Sets status=INVALIDATED, processes provided dispositions (RETURN/DISCARD/RECOLLECT),
 * sets lossesAcknowledged=true.
 *
 * Note: 'auto-DISCARD' is NOT used per DEC-004. The inspector declares dispositions
 * explicitly via invalidatedStagesDispositions in the payload.
 *
 * @param {object} tx
 * @param {object} execution - The execution to invalidate
 * @param {Array<{productId:bigint, lotId:bigint, disposition:string, quantity?:number|null}>} dispositions
 * @param {object} auth
 * @param {object} order
 * @param {any[]} [materialRequirements]
 * @returns {Promise<{returned:any[], discarded:any[], recolectItems:any[]}>}
 */
async function invalidateExecution(tx, execution, dispositions, auth, order, materialRequirements) {
  await productionRepository.bulkUpdateStageExecutionStatus([execution.id], 'INVALIDATED', tx);

  return processRejectionDispositions(tx, auth, order, execution, dispositions, materialRequirements);
}

module.exports = {
  validateDispositions,
  collectRecolectItems,
  processRejectionDispositions,
  invalidateExecution,
  // Exported for testing
  __private__: {
    processReturnItem,
    processDiscardItem,
  },
};
