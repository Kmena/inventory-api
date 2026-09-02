const { createHttpError } = require('../lib/errors');
const procurementRepository = require('../repositories/procurement.repository');

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

function calculateQuotationTotal(quotation) {
  return (quotation.items || []).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
}

function getProcurementApprovalThreshold(companyConfig) {
  const rawThreshold = /** @type {any} */ (companyConfig?.settingsJson)?.procurementApprovalThreshold;
  if (rawThreshold === null || rawThreshold === undefined || rawThreshold === '') {
    return null;
  }

  const threshold = Number(rawThreshold);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : null;
}

function serializePurchaseRequest(request) {
  return {
    id: request.id,
    companyId: request.companyId,
    requestedByUserId: request.requestedByUserId,
    title: request.title,
    notes: request.notes,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    items: (request.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes,
      product: item.product,
    })),
    quotations: request.quotations,
    selections: request.selections,
    purchaseOrders: request.purchaseOrders,
  };
}

function calculateProductShortage(product) {
  const minimumStock = Number(product.minStock ?? 0);
  const currentQuantity = Number(product.quantity ?? 0);
  return Math.max(minimumStock - currentQuantity, 0);
}

function serializeQuotableProduct(product) {
  return {
    id: product.id,
    companyId: product.companyId,
    sku: product.sku,
    name: product.name,
    inventoryType: product.inventoryType,
    sourcingMethod: product.sourcingMethod,
    quantity: product.quantity,
    minStock: product.minStock,
    shortage: calculateProductShortage(product),
    supplierCount: (product.supplierLinks || []).length,
    supplierIds: (product.supplierLinks || []).map((link) => link.supplierId),
  };
}

function serializeSupplierPricingLink(link) {
  return {
    supplierId: link.supplierId,
    supplierName: link.supplier?.name ?? null,
    supplierEmail: link.supplier?.email ?? null,
    supplierPhone: link.supplier?.phone ?? null,
    supplierCountry: link.supplier?.country ?? null,
    isPreferred: link.isPreferred,
    supplierSku: link.supplierSku,
    unitPrice: link.unitPrice != null ? Number(link.unitPrice) : null,
    currency: link.currency ?? 'CRC',
    leadTimeDays: link.leadTimeDays,
    minimumOrderQuantity: link.minimumOrderQuantity != null ? Number(link.minimumOrderQuantity) : null,
    notes: link.notes,
    createdAt: link.createdAt,
  };
}

function serializeSupplierQuotation(quotation) {
  return {
    id: quotation.id,
    companyId: quotation.companyId,
    purchaseRequestId: quotation.purchaseRequestId,
    supplierId: quotation.supplierId,
    createdByUserId: quotation.createdByUserId,
    reference: quotation.reference,
    currency: quotation.currency,
    notes: quotation.notes,
    evidence: quotation.evidence,
    status: quotation.status,
    submittedAt: quotation.submittedAt,
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
    supplier: quotation.supplier,
    items: (quotation.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      leadTimeDays: item.leadTimeDays,
      availabilityNotes: item.availabilityNotes,
      notes: item.notes,
      product: item.product,
    })),
    totalAmount: calculateQuotationTotal(quotation),
  };
}

function serializeSupplierSelection(selection) {
  return {
    id: selection.id,
    companyId: selection.companyId,
    purchaseRequestId: selection.purchaseRequestId,
    quotationId: selection.quotationId,
    selectedByUserId: selection.selectedByUserId,
    approvedByUserId: selection.approvedByUserId,
    approvalStatus: selection.approvalStatus,
    approvalRequired: selection.approvalRequired,
    totalAmount: selection.totalAmount,
    currency: selection.currency,
    justification: selection.justification,
    approvedAt: selection.approvedAt,
    createdAt: selection.createdAt,
    updatedAt: selection.updatedAt,
    quotation: selection.quotation ? serializeSupplierQuotation(selection.quotation) : null,
  };
}

function serializePurchaseOrder(order) {
  return {
    id: order.id,
    companyId: order.companyId,
    purchaseRequestId: order.purchaseRequestId,
    quotationId: order.quotationId,
    selectionId: order.selectionId,
    supplierId: order.supplierId,
    createdByUserId: order.createdByUserId,
    status: order.status,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    supplier: order.supplier,
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
      product: item.product,
    })),
  };
}

async function validateRequestProducts(companyId, items) {
  for (const item of items) {
    const product = await procurementRepository.findProductByIdForCompany(item.productId, companyId);
    if (!product) {
      throw createHttpError(404, 'Producto no encontrado para la empresa autenticada', 'not_found');
    }
  }
}

async function createPurchaseRequest(payload, auth) {
  const scope = assertCompanyScope(auth);
  await validateRequestProducts(scope.companyId, payload.items);

  const createdRequest = await procurementRepository.createPurchaseRequest({
    companyId: scope.companyId,
    requestedByUserId: scope.actorUserId,
    title: payload.title.trim(),
    notes: normalizeOptionalText(payload.notes),
    items: {
      create: payload.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: normalizeOptionalText(item.notes),
      })),
    },
  });

  return serializePurchaseRequest(createdRequest);
}

async function listPurchaseRequests(auth) {
  const scope = assertCompanyScope(auth);
  const requests = await procurementRepository.listPurchaseRequests(scope.companyId);
  return requests.map(serializePurchaseRequest);
}

async function getPurchaseRequest(id, auth) {
  const scope = assertCompanyScope(auth);
  const request = await procurementRepository.findPurchaseRequestByIdForCompany(id, scope.companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }

  return serializePurchaseRequest(request);
}

async function listQuotableProducts(auth) {
  const scope = assertCompanyScope(auth);
  const products = await procurementRepository.listQuotableProductsForCompany(scope.companyId);
  return products
    .map(serializeQuotableProduct)
    .sort((left, right) => {
      if (right.shortage !== left.shortage) {
        return right.shortage - left.shortage;
      }
      const leftQuantity = Number(left.quantity ?? 0);
      const rightQuantity = Number(right.quantity ?? 0);
      if (leftQuantity !== rightQuantity) {
        return leftQuantity - rightQuantity;
      }
      return String(left.name || '').localeCompare(String(right.name || ''), 'es');
    });
}

async function getProductSuppliersPricing(productId, auth) {
  const scope = assertCompanyScope(auth);
  const product = await procurementRepository.findProductSupplierPricingByProductIdForCompany(productId, scope.companyId);
  if (!product) {
    throw createHttpError(404, 'Producto no encontrado para la empresa autenticada o sin proveedores asociados', 'not_found');
  }

  return {
    productId: product.id,
    companyId: product.companyId,
    sku: product.sku,
    productName: product.name,
    quantity: product.quantity,
    minStock: product.minStock,
    shortage: calculateProductShortage(product),
    suppliers: (product.supplierLinks || []).map(serializeSupplierPricingLink),
  };
}

async function createAssistedQuotationRequest(payload, auth) {
  const scope = assertCompanyScope(auth);

  const validatedProducts = [];
  for (const selectedProduct of payload.products) {
    const product = await procurementRepository.findProductSupplierPricingByProductIdForCompany(selectedProduct.productId, scope.companyId);
    if (!product) {
      throw createHttpError(404, 'Producto no encontrado para la empresa autenticada o sin proveedores asociados', 'not_found');
    }

    const supplierLinksById = new Map((product.supplierLinks || []).map((link) => [String(link.supplierId), link]));
    const validatedSuppliers = [];

    for (const selectedSupplier of selectedProduct.suppliers) {
      const supplierLink = supplierLinksById.get(String(selectedSupplier.supplierId));
      if (!supplierLink) {
        throw createHttpError(400, 'El proveedor seleccionado no está asociado al producto indicado', 'validation_error');
      }

      validatedSuppliers.push({
        supplierId: selectedSupplier.supplierId,
        unitPrice: selectedSupplier.unitPrice,
        currency: selectedSupplier.currency?.trim() || supplierLink.currency || 'CRC',
        leadTimeDays: selectedSupplier.leadTimeDays ?? supplierLink.leadTimeDays ?? null,
        availabilityNotes: normalizeOptionalText(selectedSupplier.availabilityNotes),
        notes: normalizeOptionalText(selectedSupplier.notes),
      });
    }

    validatedProducts.push({
      productId: selectedProduct.productId,
      quantity: selectedProduct.quantity,
      notes: normalizeOptionalText(selectedProduct.notes),
      product,
      suppliers: validatedSuppliers,
    });
  }

  const groupedBySupplier = new Map();
  for (const product of validatedProducts) {
    for (const supplier of product.suppliers) {
      const supplierKey = String(supplier.supplierId);
      if (!groupedBySupplier.has(supplierKey)) {
        groupedBySupplier.set(supplierKey, {
          supplierId: supplier.supplierId,
          currency: supplier.currency || 'CRC',
          items: [],
        });
      }

      groupedBySupplier.get(supplierKey).items.push({
        productId: product.productId,
        quantity: product.quantity,
        unitPrice: supplier.unitPrice,
        leadTimeDays: supplier.leadTimeDays,
        availabilityNotes: supplier.availabilityNotes,
        notes: supplier.notes ?? product.notes,
      });
    }
  }

  const requestTitle = normalizeOptionalText(payload.title) || `Cotización asistida ${new Date().toISOString().slice(0, 10)}`;
  const requestNotes = normalizeOptionalText(payload.notes);

  const result = await procurementRepository.transaction(async (tx) => {
    const createdRequest = await procurementRepository.createAssistedPurchaseRequest({
      companyId: scope.companyId,
      requestedByUserId: scope.actorUserId,
      title: requestTitle,
      notes: requestNotes,
      items: {
        create: validatedProducts.map((product) => ({
          productId: product.productId,
          quantity: product.quantity,
          notes: product.notes,
        })),
      },
    }, tx);

    const quotations = [];
    for (const groupedSupplier of groupedBySupplier.values()) {
      const quotation = await procurementRepository.createSupplierQuotation({
        companyId: scope.companyId,
        purchaseRequestId: createdRequest.id,
        supplierId: groupedSupplier.supplierId,
        createdByUserId: scope.actorUserId,
        reference: null,
        currency: groupedSupplier.currency || 'CRC',
        notes: requestNotes,
        evidence: null,
        items: {
          create: groupedSupplier.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            leadTimeDays: item.leadTimeDays,
            availabilityNotes: item.availabilityNotes,
            notes: item.notes,
          })),
        },
      }, tx);
      quotations.push(serializeSupplierQuotation(quotation));
    }

    return {
      purchaseRequest: serializePurchaseRequest(createdRequest),
      quotations,
    };
  });

  return result;
}

async function createSupplierQuotation(purchaseRequestId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const request = await procurementRepository.findPurchaseRequestByIdForCompany(purchaseRequestId, scope.companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }
  if (request.status !== 'OPEN') {
    throw createHttpError(409, 'La solicitud de compra no acepta nuevas cotizaciones en su estado actual', 'conflict');
  }

  const supplier = await procurementRepository.findSupplierByIdForCompany(payload.supplierId, scope.companyId);
  if (!supplier) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  await validateRequestProducts(scope.companyId, payload.items);
  const requestedProductIds = new Set((/** @type {any} */ (request).items || []).map((item) => String(item.productId)));
  for (const item of payload.items) {
    if (!requestedProductIds.has(String(item.productId))) {
      throw createHttpError(400, 'La cotización contiene productos que no pertenecen a la solicitud de compra', 'validation_error');
    }
  }

  const quotation = await procurementRepository.createSupplierQuotation({
    companyId: scope.companyId,
    purchaseRequestId: request.id,
    supplierId: supplier.id,
    createdByUserId: scope.actorUserId,
    reference: normalizeOptionalText(payload.reference),
    currency: payload.currency?.trim() || 'CRC',
    notes: normalizeOptionalText(payload.notes),
    evidence: toSnapshotValue(payload.evidence),
    items: {
      create: payload.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        leadTimeDays: item.leadTimeDays ?? null,
        availabilityNotes: normalizeOptionalText(item.availabilityNotes),
        notes: normalizeOptionalText(item.notes),
      })),
    },
  });

  return serializeSupplierQuotation(quotation);
}

async function compareSupplierQuotations(purchaseRequestId, auth) {
  const scope = assertCompanyScope(auth);
  const request = await procurementRepository.findPurchaseRequestByIdForCompany(purchaseRequestId, scope.companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }

  const raw = ((/** @type {any} */ (request).quotations) || []).map(serializeSupplierQuotation);

  // Group by supplierId — a supplier can have multiple quotation records
  // (e.g. one from RFQ invitation + one from direct entry). Merge them into a
  // single comparison row: combined items, summed total, averaged lead time.
  const bySupplier = new Map();
  for (const q of raw) {
    const key = String(q.supplierId);
    if (bySupplier.has(key)) {
      const merged = bySupplier.get(key);
      merged.items = [...merged.items, ...q.items];
      merged.totalAmount += q.totalAmount;
      // Keep the most recent reference if different
      if (q.reference && q.reference !== merged.reference) {
        merged.reference = [merged.reference, q.reference].filter(Boolean).join(' / ');
      }
    } else {
      bySupplier.set(key, { ...q, items: [...q.items] });
    }
  }

  const quotations = [...bySupplier.values()]
    .map((q) => ({
      ...q,
      averageLeadTimeDays: q.items.length > 0
        ? q.items.reduce((sum, item) => sum + Number(item.leadTimeDays ?? 0), 0) / q.items.length
        : null,
    }))
    .sort((left, right) => left.totalAmount - right.totalAmount);

  return {
    purchaseRequestId: request.id,
    requestTitle: request.title,
    quotations,
  };
}

async function selectSupplierQuotation(purchaseRequestId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const request = await procurementRepository.findPurchaseRequestByIdForCompany(purchaseRequestId, scope.companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }
  if (request.status !== 'OPEN') {
    throw createHttpError(409, 'La solicitud de compra no puede seleccionar proveedor en su estado actual', 'conflict');
  }

  const quotation = await procurementRepository.findSupplierQuotationByIdForCompany(payload.quotationId, scope.companyId);
  if (!quotation || quotation.purchaseRequestId !== request.id) {
    throw createHttpError(404, 'Cotización no encontrada para la solicitud indicada', 'not_found');
  }

  const companyConfig = await procurementRepository.findCompanyConfigByCompanyId(scope.companyId);
  const threshold = getProcurementApprovalThreshold(companyConfig);
  const totalAmount = calculateQuotationTotal(quotation);
  const approvalRequired = threshold !== null && totalAmount > threshold;

  const selection = await procurementRepository.createSupplierSelection({
    companyId: scope.companyId,
    purchaseRequestId: request.id,
    quotationId: quotation.id,
    selectedByUserId: scope.actorUserId,
    approvalRequired,
    approvalStatus: approvalRequired ? 'PENDING' : 'APPROVED',
    approvedByUserId: approvalRequired ? null : scope.actorUserId,
    approvedAt: approvalRequired ? null : new Date(),
    totalAmount,
    currency: quotation.currency,
    justification: normalizeOptionalText(payload.justification),
  });

  await procurementRepository.updateSupplierQuotation(quotation.id, scope.companyId, {
    status: 'SELECTED',
  });

  return serializeSupplierSelection(selection);
}

async function approveSupplierSelection(selectionId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const selection = await procurementRepository.findSupplierSelectionByIdForCompany(selectionId, scope.companyId);
  if (!selection) {
    throw createHttpError(404, 'Selección de proveedor no encontrada', 'not_found');
  }
  if (!selection.approvalRequired) {
    throw createHttpError(409, 'La selección indicada no requiere aprobación adicional', 'conflict');
  }
  if (selection.approvalStatus !== 'PENDING') {
    throw createHttpError(409, 'La selección indicada no está pendiente de aprobación', 'conflict');
  }

  const updatedSelection = await procurementRepository.updateSupplierSelection(selection.id, scope.companyId, {
    approvalStatus: 'APPROVED',
    approvedByUserId: scope.actorUserId,
    approvedAt: new Date(),
    justification: normalizeOptionalText(payload.justification) ?? selection.justification,
  });

  return serializeSupplierSelection(updatedSelection);
}

async function listPurchaseOrders(auth) {
  const scope = assertCompanyScope(auth);
  const orders = await procurementRepository.listPurchaseOrders(scope.companyId);
  return orders.map(serializePurchaseOrder);
}

async function cancelPurchaseRequest(purchaseRequestId, auth) {
  const { companyId } = assertCompanyScope(auth);
  const request = await procurementRepository.findPurchaseRequestByIdForCompany(purchaseRequestId, companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }
  if (request.status !== 'OPEN') {
    throw createHttpError(409, 'La solicitud de compra ya no está abierta', 'already_closed');
  }

  const updated = await procurementRepository.updatePurchaseRequest(purchaseRequestId, companyId, {
    status: 'CANCELLED',
  });

  return serializePurchaseRequest(updated);
}

async function createPurchaseOrderFromSelection(purchaseRequestId, payload, auth) {
  const scope = assertCompanyScope(auth);
  const request = await procurementRepository.findPurchaseRequestByIdForCompany(purchaseRequestId, scope.companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }
  if (request.status !== 'OPEN') {
    throw createHttpError(409, 'La solicitud de compra no puede generar orden en su estado actual', 'conflict');
  }

  const selection = await procurementRepository.findSupplierSelectionByIdForCompany(payload.selectionId, scope.companyId);
  if (!selection || selection.purchaseRequestId !== request.id) {
    throw createHttpError(404, 'Selección de proveedor no encontrada para la solicitud indicada', 'not_found');
  }
  if (selection.approvalRequired && selection.approvalStatus !== 'APPROVED') {
    throw createHttpError(409, 'La selección de proveedor requiere aprobación antes de crear la orden de compra', 'conflict');
  }

  const quotation = selection.quotation;
  const purchaseOrder = await procurementRepository.createPurchaseOrder({
    companyId: scope.companyId,
    purchaseRequestId: request.id,
    quotationId: quotation.id,
    selectionId: selection.id,
    supplierId: quotation.supplierId,
    createdByUserId: scope.actorUserId,
    notes: normalizeOptionalText(payload.notes),
    items: {
      create: (quotation.items || []).map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: normalizeOptionalText(item.notes),
      })),
    },
  });

  await procurementRepository.updatePurchaseRequest(request.id, scope.companyId, {
    status: 'CLOSED',
  });

  return serializePurchaseOrder(purchaseOrder);
}

async function issuePurchaseOrder(orderId, auth) {
  const scope = assertCompanyScope(auth);
  const order = await procurementRepository.findPurchaseOrderByIdForCompany(BigInt(orderId), scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de compra no encontrada', 'not_found');
  }
  if (order.status !== 'DRAFT') {
    throw createHttpError(409, 'Solo se pueden emitir órdenes en estado borrador', 'conflict');
  }
  const issued = await procurementRepository.issuePurchaseOrder(order.id);
  return serializePurchaseOrder(issued);
}

module.exports = {
  createPurchaseRequest,
  createAssistedQuotationRequest,
  listPurchaseRequests,
  listPurchaseOrders,
  listQuotableProducts,
  getProductSuppliersPricing,
  getPurchaseRequest,
  createSupplierQuotation,
  compareSupplierQuotations,
  selectSupplierQuotation,
  approveSupplierSelection,
  createPurchaseOrderFromSelection,
  cancelPurchaseRequest,
  issuePurchaseOrder,
  __private__: {
    calculateQuotationTotal,
    getProcurementApprovalThreshold,
    calculateProductShortage,
    serializePurchaseOrder,
    serializeQuotableProduct,
    serializeSupplierPricingLink,
    serializeSupplierQuotation,
    serializeSupplierSelection,
  },
};
