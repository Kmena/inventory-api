'use strict';

/**
 * Service: inventory-requests
 *
 * Implements the async admin→warehouse movement-request lifecycle:
 *   PENDING → IN_PROGRESS (pickup, TRANSFER only) → COMPLETED
 *   PENDING → CANCELLED
 *
 * R-001 (partial transfer): The existing `transferInventory` service does not
 * accept a separate destinationLotId. `_executePartialTransfer` replicates the
 * required logic using the shared transaction-support helpers, keeping the
 * existing inventory routes untouched.
 */

const { randomUUID } = require('crypto');

const prisma = require('../lib/prisma');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const inventoryRequestsRepository = require('../repositories/inventory-requests.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const inventoryService = require('./inventory.service');
const {
  authScope,
  getInventoryContext,
  changeWarehouseStock,
  changeLotStock,
  createMovement,
} = require('./inventory-transaction-support.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map BigInt fields to strings for safe JSON serialization.
 * @param {object} request
 */
function serializeRequest(request) {
  if (!request) return null;
  return {
    ...request,
    id: request.id?.toString(),
    companyId: request.companyId?.toString(),
    lotId: request.lotId?.toString(),
    productId: request.productId?.toString(),
    sourceWarehouseId: request.sourceWarehouseId?.toString(),
    destinationWarehouseId: request.destinationWarehouseId?.toString() ?? null,
    requestedByUserId: request.requestedByUserId?.toString(),
    assignedToUserId: request.assignedToUserId?.toString() ?? null,
    resultOperationId: request.resultOperationId?.toString() ?? null,
    lot: request.lot
      ? {
          ...request.lot,
          id: request.lot.id?.toString(),
          companyId: request.lot.companyId?.toString(),
          warehouseLotStocks: (request.lot.warehouseLotStocks ?? []).map((ws) => ({
            ...ws,
            warehouseId: ws.warehouseId?.toString(),
          })),
        }
      : null,
    product: request.product
      ? { ...request.product, id: request.product.id?.toString() }
      : null,
    sourceWarehouse: request.sourceWarehouse
      ? { ...request.sourceWarehouse, id: request.sourceWarehouse.id?.toString() }
      : null,
    destinationWarehouse: request.destinationWarehouse
      ? { ...request.destinationWarehouse, id: request.destinationWarehouse.id?.toString() }
      : null,
    requestedByUser: request.requestedByUser
      ? { ...request.requestedByUser, id: request.requestedByUser.id?.toString() }
      : null,
    assignedToUser: request.assignedToUser
      ? { ...request.assignedToUser, id: request.assignedToUser.id?.toString() }
      : null,
  };
}

/**
 * Execute a partial or complete inventory transfer inside an already-open
 * Prisma transaction (`tx`). This is the R-001 internal helper: the public
 * `transferInventory` service does not accept a separate destinationLotId.
 *
 * @param {any} tx  - Prisma transaction client (typed as any to satisfy transaction callback constraint)
 * @param {{
 *   sourceLotId: bigint,
 *   destinationLotId: bigint,
 *   sourceWarehouseId: bigint,
 *   destinationWarehouseId: bigint,
 *   productId: bigint,
 *   quantity: number,
 *   reasonCode: string,
 *   note: string,
 *   clearReservation?: boolean,
 * }} params
 * @param {object} auth  - req.auth (contains companyId / sub)
 */
async function _executePartialTransfer(tx, params, auth) {
  const {
    sourceLotId,
    destinationLotId,
    sourceWarehouseId,
    destinationWarehouseId,
    productId,
    quantity,
    reasonCode,
    note,
  } = params;

  const sourceContext = await getInventoryContext(tx, auth, sourceWarehouseId, productId);
  await inventoryRepository.acquireCompanyInventoryAdvisoryLock(sourceContext.companyId, tx);
  const destinationContext = await getInventoryContext(tx, auth, destinationWarehouseId, productId);

  const movementGroupId = randomUUID();
  const operation = await inventoryRepository.createInventoryOperation({
    companyId: sourceContext.companyId,
    operationType: 'TRANSFER',
    idempotencyKey: randomUUID(),
    productId: sourceContext.product.id,
    sourceWarehouseId: sourceContext.warehouse.id,
    destinationWarehouseId: destinationContext.warehouse.id,
    movementGroupId,
    reasonCode,
    note: note || null,
    createdByUserId: sourceContext.userId,
    metadata: {
      quantity,
      sourceLotId: sourceLotId.toString(),
      destinationLotId: destinationLotId.toString(),
      requestSource: 'inventory_request',
    },
  }, tx);

  // Load lot records
  const sourceLot = await tx.lot.findFirst({ where: { id: sourceLotId, companyId: sourceContext.companyId } });
  if (!sourceLot) throw createHttpError(404, 'Lote origen no encontrado', 'not_found');

  const destinationLot = await tx.lot.findFirst({ where: { id: destinationLotId, companyId: sourceContext.companyId } });
  if (!destinationLot) throw createHttpError(404, 'Lote destino no encontrado', 'not_found');

  // When the transfer went through the pickup→deliver cascade, the quantity
  // was already reserved at pickup time. Pass -quantity as reservedDelta so
  // the reservation is atomically released as the stock is moved.
  const reservedDelta = params.clearReservation ? -quantity : 0;

  // Update warehouse-level stocks
  const sourceWarehouseStock = await changeWarehouseStock(tx, sourceContext, -quantity, reservedDelta);
  const destinationWarehouseStock = await changeWarehouseStock(tx, destinationContext, quantity, 0);

  // Update lot-level stocks
  const sourceLotStock = await changeLotStock(tx, sourceContext, sourceLot, -quantity, reservedDelta);
  const destinationLotStock = await changeLotStock(tx, destinationContext, destinationLot, quantity, 0);

  // Update lot totals (same-lot transfers skip this; partial always differs)
  if (sourceLotId !== destinationLotId) {
    await inventoryRepository.updateLotById(sourceLotId, { quantity: { decrement: quantity } }, tx);
    await inventoryRepository.updateLotById(destinationLotId, { quantity: { increment: quantity } }, tx);
  }

  // Movements
  const outMovement = await createMovement(tx, sourceContext, {
    lotId: sourceLotId,
    movementType: 'TRANSFER_OUT',
    quantity,
    quantityBefore: sourceWarehouseStock.before,
    quantityAfter: sourceWarehouseStock.after,
    reasonCode,
    movementGroupId,
    sourceType: 'inventory_operation',
    sourceId: operation.id,
    note: note || 'Traslado por solicitud de inventario',
  });

  const inMovement = await createMovement(tx, destinationContext, {
    lotId: destinationLotId,
    movementType: 'TRANSFER_IN',
    quantity,
    quantityBefore: destinationWarehouseStock.before,
    quantityAfter: destinationWarehouseStock.after,
    reasonCode,
    movementGroupId,
    sourceType: 'inventory_operation',
    sourceId: operation.id,
    note: note || 'Traslado por solicitud de inventario',
  });

  return {
    operation,
    sourceLot,
    destinationLot,
    sourceLotStock: sourceLotStock.record,
    destinationLotStock: destinationLotStock.record,
    sourceWarehouseStock: sourceWarehouseStock.record,
    destinationWarehouseStock: destinationWarehouseStock.record,
    movements: [outMovement, inMovement],
  };
}

// ── Public use cases ──────────────────────────────────────────────────────────

/**
 * Create a new inventory movement request (admin → warehouse async flow).
 */
async function createInventoryRequest(body, auth, req) {
  const { companyId, userId } = authScope(auth);

  const lot = await prisma.lot.findFirst({ where: { id: body.lotId, companyId } });
  if (!lot) throw createHttpError(404, 'Lote no encontrado para esta empresa', 'not_found');

  if (lot.productId !== body.productId) {
    throw createHttpError(400, 'El lote no corresponde al producto indicado', 'validation_error');
  }

  if (body.type === 'TRANSFER') {
    if (body.sourceWarehouseId === body.destinationWarehouseId) {
      throw createHttpError(400, 'Origen y destino no pueden ser la misma bodega', 'validation_error');
    }
    const lotQty = Number(lot.quantity);
    if (body.quantity <= 0 || body.quantity > lotQty) {
      throw createHttpError(400, `La cantidad debe estar entre 0 y ${lotQty} (existencia del lote)`, 'validation_error');
    }
  }

  // Fast-path duplicate check (uses prisma directly so unit tests can mock it).
  const preExisting = await prisma.inventoryRequest.findFirst({
    where: { lotId: body.lotId, companyId, status: { in: ['PENDING', 'IN_PROGRESS', 'DELIVERED'] } },
  });
  if (preExisting) throw createHttpError(409, 'Ya existe una solicitud activa para este lote', 'conflict');

  // Advisory lock + re-check + create are atomic to prevent races on concurrent
  // submissions (e.g. the user clicks multiple source-warehouse buttons at once).
  const created = await prisma.$transaction(async (tx) => {
    const db = /** @type {any} */ (tx);
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, db);

    const raceExisting = await db.inventoryRequest.findFirst({
      where: { lotId: body.lotId, companyId, status: { in: ['PENDING', 'IN_PROGRESS', 'DELIVERED'] } },
    });
    if (raceExisting) throw createHttpError(409, 'Ya existe una solicitud activa para este lote', 'conflict');

    return db.inventoryRequest.create({
      data: {
        companyId,
        type: body.type,
        status: 'PENDING',
        lotId: body.lotId,
        productId: body.productId,
        sourceWarehouseId: body.sourceWarehouseId,
        destinationWarehouseId: body.destinationWarehouseId ?? null,
        quantity: body.quantity ?? null,
        requestedByUserId: userId,
        requestedAt: new Date(),
        note: body.note ?? null,
      },
    });
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.request.create',
    resourceType: 'inventory_request',
    resourceId: created.id,
    outcome: 'SUCCESS',
    afterState: { type: body.type, lotId: body.lotId?.toString(), status: 'PENDING' },
  });

  return serializeRequest(created);
}

/**
 * List all inventory requests for the authenticated company, with optional filters.
 */
async function listInventoryRequests(auth, filters = {}, pagination = null) {
  const { companyId } = authScope(auth);

  const result = /** @type {any} */ (await inventoryRequestsRepository.findAllRequests(companyId, filters, pagination));

  if (pagination && result.total !== undefined) {
    const serialized = (result.items || []).map(serializeRequest);
    return buildPaginatedResponse(serialized, pagination, result.total);
  }

  return Array.isArray(result) ? result.map(serializeRequest) : result;
}

/**
 * Get a single inventory request by id.
 */
async function getInventoryRequest(id, auth) {
  const { companyId } = authScope(auth);
  const request = await inventoryRequestsRepository.findRequestById(BigInt(id), companyId);
  if (!request) throw createHttpError(404, 'Solicitud no encontrada', 'not_found');
  return serializeRequest(request);
}

/**
 * Cancel a PENDING inventory request.
 */
async function cancelInventoryRequest(id, body, auth, req) {
  const { companyId } = authScope(auth);

  const request = await inventoryRequestsRepository.findRequestById(BigInt(id), companyId);
  if (!request) throw createHttpError(404, 'Solicitud no encontrada', 'not_found');

  const cancellableStatuses = ['PENDING', 'IN_PROGRESS', 'DELIVERED'];
  if (!cancellableStatuses.includes(request.status)) {
    throw createHttpError(409, 'Solo se pueden cancelar solicitudes que no hayan sido completadas', 'conflict');
  }

  // If pickup was already confirmed (stock reserved), release the reservation
  // before cancelling so the stock becomes available again.
  const updated = await prisma.$transaction(async (tx) => {
    const db = /** @type {any} */ (tx);
    if (request.type === 'TRANSFER' && (request.status === 'IN_PROGRESS' || request.status === 'DELIVERED')) {
      await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, db);
      const sourceCtx = await getInventoryContext(db, auth, request.sourceWarehouseId, request.productId);
      const sourceLot = await db.lot.findFirst({ where: { id: request.lotId, companyId } });
      if (sourceLot) {
        const qty = Number(request.quantity);
        await changeWarehouseStock(db, sourceCtx, 0, -qty);
        await changeLotStock(db, sourceCtx, sourceLot, 0, -qty);
      }
    }
    return inventoryRequestsRepository.updateRequestStatus(BigInt(id), companyId, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledReason: body.cancelledReason ?? null,
    }, db);
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.request.cancel',
    resourceType: 'inventory_request',
    resourceId: BigInt(id),
    outcome: 'SUCCESS',
    afterState: { status: 'CANCELLED', reason: body.cancelledReason ?? null },
  });

  return serializeRequest(updated);
}

/**
 * Operator picks up a TRANSFER request: marks it IN_PROGRESS, records the
 * operator's identity via assignedToUserId, and reserves the requested
 * quantity so it is not double-allocated by other operations.
 */
async function pickupTransferRequest(id, body, auth, req) {
  const { companyId, userId } = authScope(auth);

  const request = await inventoryRequestsRepository.findRequestById(BigInt(id), companyId);
  if (!request) throw createHttpError(404, 'Solicitud no encontrada', 'not_found');

  if (request.type !== 'TRANSFER') {
    throw createHttpError(409, 'Solo las solicitudes de traslado requieren confirmación de pickup', 'conflict');
  }
  if (request.status !== 'PENDING') {
    throw createHttpError(409, 'La solicitud no está pendiente', 'conflict');
  }

  const requestQty = Number(request.quantity);

  const updated = await prisma.$transaction(async (tx) => {
    const db = /** @type {any} */ (tx);
    await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, db);

    // Reserve stock in source warehouse so it cannot be consumed elsewhere.
    const sourceCtx = await getInventoryContext(db, auth, request.sourceWarehouseId, request.productId);
    const sourceLot  = await db.lot.findFirst({ where: { id: request.lotId, companyId } });
    if (!sourceLot) throw createHttpError(404, 'Lote origen no encontrado', 'not_found');

    await changeWarehouseStock(db, sourceCtx, 0, requestQty);
    await changeLotStock(db, sourceCtx, sourceLot, 0, requestQty);

    return inventoryRequestsRepository.updateRequestStatus(BigInt(id), companyId, {
      status: 'IN_PROGRESS',
      pickedUpAt: new Date(),
      assignedToUserId: userId,
      operatorNote: body.operatorNote ?? null,
    }, db);
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.request.pickup',
    resourceType: 'inventory_request',
    resourceId: BigInt(id),
    outcome: 'SUCCESS',
    afterState: { status: 'IN_PROGRESS', assignedToUserId: userId?.toString() },
  });

  return serializeRequest(updated);
}

/**
 * Operator confirms physical delivery of a TRANSFER request: marks it DELIVERED.
 * No stock movement yet — that happens in executeInventoryRequest (Finalizar).
 */
async function confirmDeliveryRequest(id, body, auth, req) {
  const { companyId } = authScope(auth);

  const request = await inventoryRequestsRepository.findRequestById(BigInt(id), companyId);
  if (!request) throw createHttpError(404, 'Solicitud no encontrada', 'not_found');

  if (request.type !== 'TRANSFER') {
    throw createHttpError(409, 'Solo las solicitudes de traslado tienen etapa de entrega', 'conflict');
  }
  if (request.status !== 'IN_PROGRESS') {
    throw createHttpError(409, 'La solicitud debe estar en progreso (pickup confirmado)', 'conflict');
  }

  const updated = await inventoryRequestsRepository.updateRequestStatus(BigInt(id), companyId, {
    status: 'DELIVERED',
    deliveredAt: new Date(),
    operatorNote: body.operatorNote ?? null,
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.request.confirm_delivery',
    resourceType: 'inventory_request',
    resourceId: BigInt(id),
    outcome: 'SUCCESS',
    afterState: { status: 'DELIVERED' },
  });

  return serializeRequest(updated);
}

/**
 * Execute an inventory request.
 *
 * ADJUSTMENT: calls the existing `adjustStock` service (its own transaction),
 * then marks the request COMPLETED.
 *
 * TRANSFER: uses a single Prisma transaction. When the requested quantity is
 * less than the lot's current total, a new child lot is created with suffix
 * `-TNNN` (R-001).
 */
async function executeInventoryRequest(id, body, auth, req) {
  const { companyId } = authScope(auth);
  const requestId = BigInt(id);

  // ── Load request ────────────────────────────────────────────────────────────
  const request = await inventoryRequestsRepository.findRequestById(requestId, companyId);
  if (!request) throw createHttpError(404, 'Solicitud no encontrada', 'not_found');

  // ── ADJUSTMENT ──────────────────────────────────────────────────────────────
  if (request.type === 'ADJUSTMENT') {
    if (request.status !== 'PENDING') {
      throw createHttpError(409, 'La solicitud de ajuste no está pendiente', 'conflict');
    }

    const op = await inventoryService.adjustStock({
      warehouseId: request.sourceWarehouseId,
      productId: request.productId,
      lotId: request.lotId,
      quantity: body.actualQuantity,
      direction: body.direction,
      reasonCode: body.reasonCode,
      note: body.operatorNote || `Ejecución de solicitud #${request.id}`,
      idempotencyKey: randomUUID(),
    }, auth, req);

    const updated = await inventoryRequestsRepository.updateRequestStatus(requestId, companyId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      resultOperationId: op.operation.id,
      operatorNote: body.operatorNote ?? null,
    });

    await audit.recordAuditEventIfAvailable({
      req,
      action: 'inventory.request.execute',
      resourceType: 'inventory_request',
      resourceId: requestId,
      outcome: 'SUCCESS',
      afterState: { type: 'ADJUSTMENT', status: 'COMPLETED', operationId: op.operation.id?.toString() },
    });

    return serializeRequest(updated);
  }

  // ── TRANSFER ─────────────────────────────────────────────────────────────────
  if (request.type !== 'TRANSFER') {
    throw createHttpError(409, 'Tipo de solicitud no reconocido', 'conflict');
  }

  if (request.status !== 'DELIVERED' || !request.deliveredAt) {
    throw createHttpError(409, 'El traslado debe estar entregado (confirmar entrega primero)', 'conflict');
  }

  const result = await prisma.$transaction(async (tx) => {
    const db = /** @type {any} */ (tx);
    // Re-read inside transaction for consistency
    const reqTx = await inventoryRequestsRepository.findRequestById(requestId, companyId, db);
    if (!reqTx) throw createHttpError(404, 'Solicitud no encontrada', 'not_found');
    if (reqTx.status !== 'DELIVERED' || !reqTx.deliveredAt) {
      throw createHttpError(409, 'El traslado ya fue procesado o cancelado', 'conflict');
    }

    const lot = await db.lot.findFirst({ where: { id: reqTx.lotId, companyId } });
    if (!lot) throw createHttpError(404, 'Lote no encontrado', 'not_found');

    const requestQty = Number(reqTx.quantity);
    const lotQty = Number(lot.quantity);

    let destinationLotId;

    if (requestQty >= lotQty) {
      // Complete transfer — use the same lot at destination
      destinationLotId = lot.id;
    } else {
      // Partial transfer — create a child lot with sequential suffix
      const maxSuffix = await inventoryRequestsRepository.findMaxTransferSuffixForLot(
        companyId,
        lot.internalLotNumber,
        db,
      );
      const newLotNumber = `${lot.internalLotNumber}-T${String(maxSuffix + 1).padStart(3, '0')}`;

      const newLot = await db.lot.create({
        data: {
          companyId,
          productId: lot.productId,
          internalLotNumber: newLotNumber,
          lotNumber: newLotNumber,
          expirationDate: lot.expirationDate ?? null,
          qaStatus: lot.qaStatus,
          status: lot.status,
          productionDate: lot.productionDate ?? null,
          manufacturerLotNumber: lot.manufacturerLotNumber ?? null,
          supplierId: lot.supplierId ?? null,
          casNumber: lot.casNumber ?? null,
          quantity: 0,
          originalQuantity: requestQty,
        },
      });

      destinationLotId = newLot.id;
    }

    const transferResult = await _executePartialTransfer(db, {
      sourceLotId: reqTx.lotId,
      destinationLotId,
      sourceWarehouseId: reqTx.sourceWarehouseId,
      destinationWarehouseId: reqTx.destinationWarehouseId,
      productId: reqTx.productId,
      quantity: requestQty,
      reasonCode: 'TRANSFER_REQUEST',
      note: body.operatorNote || `Traslado solicitud #${reqTx.id}`,
      clearReservation: true,
    }, auth);

    await inventoryRequestsRepository.updateRequestStatus(requestId, companyId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      deliveredAt: new Date(),
      resultOperationId: transferResult.operation.id,
      operatorNote: body.operatorNote ?? null,
    }, db);

    return transferResult;
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'inventory.request.execute',
    resourceType: 'inventory_request',
    resourceId: requestId,
    outcome: 'SUCCESS',
    afterState: { status: 'COMPLETED', operationId: result.operation.id?.toString() },
  });

  const completed = await inventoryRequestsRepository.findRequestById(requestId, companyId);
  return serializeRequest(completed);
}

module.exports = {
  createInventoryRequest,
  listInventoryRequests,
  getInventoryRequest,
  cancelInventoryRequest,
  pickupTransferRequest,
  confirmDeliveryRequest,
  executeInventoryRequest,
};
