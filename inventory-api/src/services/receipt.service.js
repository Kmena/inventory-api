const { randomUUID } = require('crypto');

const { createHttpError } = require('../lib/errors');
const inventoryRepository = require('../repositories/inventory.repository');
const inventoryTxSupport = require('./inventory-transaction-support.service');
const receiptRepository = require('../repositories/receipt.repository');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
    actorUserId: auth.sub ? BigInt(auth.sub) : null,
  };
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toSnapshotValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry)));
}

function serializeReceipt(receipt) {
  return {
    id: receipt.id,
    companyId: receipt.companyId,
    purchaseOrderId: receipt.purchaseOrderId,
    supplierId: receipt.supplierId,
    warehouseId: receipt.warehouseId,
    status: receipt.status,
    receivedAt: receipt.receivedAt,
    notes: receipt.notes,
    evidence: receipt.evidence,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    supplier: receipt.supplier,
    warehouse: receipt.warehouse,
    purchaseOrder: receipt.purchaseOrder,
    items: (receipt.items || []).map((item) => ({
      id: item.id,
      purchaseOrderItemId: item.purchaseOrderItemId,
      productId: item.productId,
      substituteProductId: item.substituteProductId,
      requestedQuantity: item.requestedQuantity,
      receivedQuantity: item.receivedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      lotNumber: item.lotNumber,
      expirationDate: item.expirationDate,
      unitCost: item.unitCost,
      observations: item.observations,
      product: item.product,
      substituteProduct: item.substituteProduct,
      inspections: item.inspections,
    })),
    inspections: receipt.inspections,
  };
}

async function validateReceiptReferences(scope, payload) {
  if (payload.purchaseOrderId) {
    const purchaseOrder = await receiptRepository.findPurchaseOrderByIdForCompany(payload.purchaseOrderId, scope.companyId);
    if (!purchaseOrder) {
      throw createHttpError(404, 'Orden de compra no encontrada', 'not_found');
    }
  }

  const supplier = await receiptRepository.findSupplierByIdForCompany(payload.supplierId, scope.companyId);
  if (!supplier) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  const warehouse = await receiptRepository.findWarehouseByIdForCompany(payload.warehouseId, scope.companyId);
  if (!warehouse) {
    throw createHttpError(404, 'Bodega no encontrada para la empresa autenticada', 'not_found');
  }

  for (const item of payload.items) {
    const product = await receiptRepository.findProductByIdForCompany(item.productId, scope.companyId);
    if (!product) {
      throw createHttpError(404, 'Producto no encontrado para la empresa autenticada', 'not_found');
    }

    if ((product.requiresExpiration || product.requiresLot) && item.receivedQuantity > 0) {
      if (product.requiresLot && !item.lotNumber) {
        // capture warning-like validation as foundation rule when actual arrival exists
        throw createHttpError(400, 'Los productos con control de lote deben registrar lotNumber en el documento de recepción', 'validation_error');
      }
      if (product.requiresExpiration && !item.expirationDate) {
        throw createHttpError(400, 'Los productos expirables deben registrar expirationDate en el documento de recepción', 'validation_error');
      }
    }
  }
}

async function createPurchaseReceipt(payload, auth) {
  const scope = assertCompanyScope(auth);
  await validateReceiptReferences(scope, payload);

  const receipt = await receiptRepository.createPurchaseReceipt({
    companyId: scope.companyId,
    purchaseOrderId: payload.purchaseOrderId ?? null,
    supplierId: payload.supplierId,
    warehouseId: payload.warehouseId,
    status: 'PENDING_INSPECTION',
    receivedAt: payload.receivedAt ?? new Date(),
    notes: normalizeOptionalText(payload.notes),
    evidence: toSnapshotValue(payload.evidence),
    items: {
      create: payload.items.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId ?? null,
        productId: item.productId,
        substituteProductId: item.substituteProductId ?? null,
        requestedQuantity: item.requestedQuantity,
        receivedQuantity: item.receivedQuantity,
        rejectedQuantity: item.rejectedQuantity ?? 0,
        lotNumber: normalizeOptionalText(item.lotNumber),
        expirationDate: item.expirationDate ?? null,
        unitCost: item.unitCost ?? null,
        observations: normalizeOptionalText(item.observations),
      })),
    },
  });

  return serializeReceipt(receipt);
}

async function listPurchaseReceipts(auth, statusFilter = null) {
  const scope = assertCompanyScope(auth);
  const receipts = await receiptRepository.listPurchaseReceipts(scope.companyId, statusFilter);
  return receipts.map(serializeReceipt);
}

async function getPurchaseReceipt(id, auth) {
  const scope = assertCompanyScope(auth);
  const receipt = await receiptRepository.findPurchaseReceiptByIdForCompany(id, scope.companyId);
  if (!receipt) {
    throw createHttpError(404, 'Documento de recepción no encontrado', 'not_found');
  }

  return serializeReceipt(receipt);
}

async function inspectPurchaseReceiptItem(receiptId, itemId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const receipt = await receiptRepository.findPurchaseReceiptByIdForCompany(receiptId, scope.companyId);
  if (!receipt) {
    throw createHttpError(404, 'Documento de recepción no encontrado', 'not_found');
  }
  if (!['PENDING_INSPECTION', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'REJECTED'].includes(receipt.status)) {
    throw createHttpError(409, 'El documento de recepción no admite inspecciones en su estado actual', 'conflict');
  }

  const receiptItem = (receipt.items || []).find((item) => String(item.id) === itemId.toString());
  if (!receiptItem) {
    throw createHttpError(404, 'Ítem de recepción no encontrado', 'not_found');
  }

  const inspection = await receiptRepository.createReceiptInspection({
    receiptId: receipt.id,
    receiptItemId: receiptItem.id,
    productId: receiptItem.productId,
    inspectorUserId: scope.actorUserId,
    result: payload.result,
    quantityAccepted: payload.quantityAccepted,
    quantityRejected: payload.quantityRejected ?? 0,
    observations: normalizeOptionalText(payload.observations),
    evidence: toSnapshotValue(payload.evidence),
    inspectedAt: payload.inspectedAt ?? new Date(),
  });

  let nextStatus = receipt.status;
  if (payload.result === 'REJECTED') {
    nextStatus = 'REJECTED';
  } else if (payload.result === 'PARTIALLY_ACCEPTED') {
    nextStatus = 'PARTIALLY_ACCEPTED';
  } else if (payload.result === 'ACCEPTED' && receipt.status === 'PENDING_INSPECTION') {
    nextStatus = 'ACCEPTED';
  }

  if (nextStatus !== receipt.status) {
    await receiptRepository.updatePurchaseReceipt(receipt.id, { status: nextStatus });
  }

  return inspection;
}

async function confirmPurchaseReceiptInTransaction(tx, receipt, auth) {
  const { companyId } = inventoryTxSupport.authScope(auth);
  await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, tx);

  const movementGroupId = randomUUID();

  for (const item of receipt.items || []) {
    const acceptedQuantity = inventoryTxSupport.number(item.receivedQuantity) - inventoryTxSupport.number(item.rejectedQuantity);
    if (acceptedQuantity <= 0) {
      continue;
    }

    const context = await inventoryTxSupport.getInventoryContext(tx, auth, receipt.warehouseId, item.productId);
    const rawLotNumber = normalizeOptionalText(item.lotNumber) || `PR-${receipt.id}-ITEM-${item.id}`;
    const lotNumberResolution = await inventoryTxSupport.resolveUniqueInternalLotNumber(tx, companyId, rawLotNumber);

    const isQuarantineWarehouse = context.warehouse.warehouseType === 'QUARANTINE';
    const lotStatus = isQuarantineWarehouse ? 'QUARANTINED' : 'AVAILABLE';
    const qaStatus = isQuarantineWarehouse ? 'PENDING' : 'APPROVED';

    const lot = await inventoryRepository.createLot({
      companyId,
      productId: item.productId,
      supplierId: receipt.supplierId,
      lotNumber: lotNumberResolution.assigned,
      internalLotNumber: lotNumberResolution.assigned,
      manufacturerLotNumber: normalizeOptionalText(item.lotNumber),
      expirationDate: item.expirationDate ?? null,
      entryDate: new Date(),
      quantity: acceptedQuantity,
      originalQuantity: acceptedQuantity,
      status: lotStatus,
      qaStatus,
    }, tx);

    await inventoryTxSupport.changeLotStock(tx, context, lot, acceptedQuantity, 0);
    const warehouseStock = await inventoryTxSupport.changeWarehouseStock(tx, context, acceptedQuantity, 0);

    await inventoryRepository.updateProductById(
      context.product.id,
      companyId,
      { quantity: { increment: acceptedQuantity } },
      tx,
    );

    await inventoryTxSupport.createMovement(tx, context, {
      lotId: lot.id,
      movementType: 'IN',
      quantity: acceptedQuantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode: 'PURCHASE_RECEIPT',
      movementGroupId,
      sourceType: 'purchase_receipt',
      sourceId: receipt.id,
      note: `Confirmación de recepción de compra #${receipt.id} — ítem #${item.id}`,
    });

    await receiptRepository.updatePurchaseReceiptItemConfirmedLot(item.id, lot.id, tx);
  }

  return receiptRepository.updatePurchaseReceiptInTransaction(receipt.id, { status: 'CONFIRMED' }, tx);
}

async function confirmPurchaseReceipt(receiptId, auth) {
  const { companyId } = inventoryTxSupport.authScope(auth);
  const receipt = await receiptRepository.findPurchaseReceiptByIdForCompany(receiptId, companyId);
  if (!receipt) {
    throw createHttpError(404, 'Documento de recepción no encontrado', 'not_found');
  }
  if (!['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(receipt.status)) {
    throw createHttpError(409, 'Solo se pueden confirmar recepciones en estado ACCEPTED o PARTIALLY_ACCEPTED', 'conflict');
  }

  const hasAnyAcceptedItem = (receipt.items || []).some(
    (item) => inventoryTxSupport.number(item.receivedQuantity) - inventoryTxSupport.number(item.rejectedQuantity) > 0,
  );
  if (!hasAnyAcceptedItem) {
    throw createHttpError(409, 'No hay ítems con cantidad aceptada para confirmar en esta recepción', 'conflict');
  }

  const confirmed = await inventoryRepository.transaction((tx) =>
    confirmPurchaseReceiptInTransaction(tx, receipt, auth));

  return serializeReceipt(confirmed);
}

async function reversePurchaseReceiptInTransaction(tx, receipt, auth) {
  const { companyId } = inventoryTxSupport.authScope(auth);
  await inventoryRepository.acquireCompanyInventoryAdvisoryLock(companyId, tx);

  const movementGroupId = randomUUID();

  for (const item of receipt.items || []) {
    if (!item.confirmedLotId) {
      continue;
    }

    const acceptedQuantity = inventoryTxSupport.number(item.receivedQuantity) - inventoryTxSupport.number(item.rejectedQuantity);
    if (acceptedQuantity <= 0) {
      continue;
    }

    const context = await inventoryTxSupport.getInventoryContext(tx, auth, receipt.warehouseId, item.productId);

    const lot = /** @type {any} */ (item.confirmedLot) ?? { id: item.confirmedLotId };

    await inventoryTxSupport.changeLotStock(tx, context, lot, -acceptedQuantity, 0);
    const warehouseStock = await inventoryTxSupport.changeWarehouseStock(tx, context, -acceptedQuantity, 0);

    await inventoryRepository.updateProductById(
      context.product.id,
      companyId,
      { quantity: { decrement: acceptedQuantity } },
      tx,
    );

    await inventoryTxSupport.createMovement(tx, context, {
      lotId: item.confirmedLotId,
      movementType: 'OUT',
      quantity: acceptedQuantity,
      quantityBefore: warehouseStock.before,
      quantityAfter: warehouseStock.after,
      reasonCode: 'RECEIPT_REVERSAL',
      movementGroupId,
      sourceType: 'purchase_receipt_reversal',
      sourceId: receipt.id,
      note: `Reverso de recepción de compra #${receipt.id} — ítem #${item.id}`,
    });
  }

  return receiptRepository.updatePurchaseReceiptInTransaction(receipt.id, { status: 'REVERSED' }, tx);
}

async function reversePurchaseReceipt(receiptId, auth) {
  const { companyId } = inventoryTxSupport.authScope(auth);
  const receipt = await receiptRepository.findPurchaseReceiptByIdForCompany(receiptId, companyId);
  if (!receipt) {
    throw createHttpError(404, 'Documento de recepción no encontrado', 'not_found');
  }
  if (receipt.status !== 'CONFIRMED') {
    throw createHttpError(409, 'Solo se pueden revertir recepciones en estado CONFIRMED', 'conflict');
  }

  const reversed = await inventoryRepository.transaction((tx) =>
    reversePurchaseReceiptInTransaction(tx, receipt, auth));

  return serializeReceipt(reversed);
}

async function listPurchaseOrdersForReceipt(auth) {
  const scope = assertCompanyScope(auth);
  return receiptRepository.listPurchaseOrdersForReceipt(scope.companyId);
}

module.exports = {
  createPurchaseReceipt,
  listPurchaseReceipts,
  getPurchaseReceipt,
  listPurchaseOrdersForReceipt,
  inspectPurchaseReceiptItem,
  confirmPurchaseReceipt,
  reversePurchaseReceipt,
  __private__: {
    serializeReceipt,
  },
};
