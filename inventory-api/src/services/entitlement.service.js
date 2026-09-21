const { createHttpError } = require('../lib/errors');
const { recordAuditEventSafelyIfAvailable } = require('../lib/audit');
const entitlementRepository = require('../repositories/entitlement.repository');

const VALIDITY_UNIT_DAYS = {
  DAY: 1,
  MONTH: 30,
  YEAR: 365,
};

function requireCompanyScope(auth) {
  const companyId = auth?.companyId;
  if (!companyId) {
    throw createHttpError(403, 'Se requiere contexto de empresa autenticada', 'forbidden');
  }
  return BigInt(companyId);
}

function getActorUserId(auth) {
  if (!auth?.sub && !auth?.userId) {
    return null;
  }
  return BigInt(auth.userId || auth.sub);
}

function serializeOptionalId(value) {
  return value === null || value === undefined ? null : String(value);
}

function deriveEntitlementStatus(entitlement, now = new Date()) {
  if (entitlement.status === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (entitlement.endDate && entitlement.endDate < now) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

function serializeEntitlement(entitlement, now = new Date()) {
  return {
    id: String(entitlement.id),
    companyId: String(entitlement.companyId),
    clientId: String(entitlement.clientId),
    productId: String(entitlement.productId),
    sourceOrderId: serializeOptionalId(entitlement.sourceOrderId),
    sourceOrderItemId: serializeOptionalId(entitlement.sourceOrderItemId),
    sourceInvoiceId: serializeOptionalId(entitlement.sourceInvoiceId),
    sourceInvoiceItemId: serializeOptionalId(entitlement.sourceInvoiceItemId),
    previousEntitlementId: serializeOptionalId(entitlement.previousEntitlementId),
    status: deriveEntitlementStatus(entitlement, now),
    persistedStatus: entitlement.status,
    entitlementKind: entitlement.entitlementKind,
    startDate: entitlement.startDate ? entitlement.startDate.toISOString() : null,
    endDate: entitlement.endDate ? entitlement.endDate.toISOString() : null,
    activatedAt: entitlement.activatedAt ? entitlement.activatedAt.toISOString() : null,
    activatedByUserId: serializeOptionalId(entitlement.activatedByUserId),
    activationSource: entitlement.activationSource,
    manualActivationReason: entitlement.manualActivationReason || null,
    cancelledAt: entitlement.cancelledAt ? entitlement.cancelledAt.toISOString() : null,
    cancelledByUserId: serializeOptionalId(entitlement.cancelledByUserId),
    cancellationReason: entitlement.cancellationReason || null,
    priceSnapshot: entitlement.priceSnapshot != null ? entitlement.priceSnapshot.toString() : null,
    currencySnapshot: entitlement.currencySnapshot,
    validityCountSnapshot: entitlement.validityCountSnapshot,
    validityUnitSnapshot: entitlement.validityUnitSnapshot,
    billingIntervalSnapshot: entitlement.billingIntervalSnapshot,
    product: entitlement.product ? {
      id: String(entitlement.product.id),
      code: entitlement.product.code || null,
      name: entitlement.product.name,
      commercialBehavior: entitlement.product.commercialBehavior,
      entitlementKind: entitlement.product.entitlementKind,
    } : null,
    client: entitlement.client ? {
      id: String(entitlement.client.id),
      code: entitlement.client.code || null,
      name: entitlement.client.name,
    } : null,
    metadata: entitlement.metadata || null,
    createdAt: entitlement.createdAt ? entitlement.createdAt.toISOString() : null,
    updatedAt: entitlement.updatedAt ? entitlement.updatedAt.toISOString() : null,
  };
}

function parseOptionalBigInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  try {
    return BigInt(value);
  } catch (_error) {
    throw createHttpError(400, `${fieldName} inválido`, 'validation_error');
  }
}

function normalizeCreationInput(input) {
  return {
    clientId: parseOptionalBigInt(input.clientId, 'clientId'),
    productId: parseOptionalBigInt(input.productId, 'productId'),
    sourceOrderId: parseOptionalBigInt(input.sourceOrderId, 'sourceOrderId'),
    sourceOrderItemId: parseOptionalBigInt(input.sourceOrderItemId, 'sourceOrderItemId'),
    sourceInvoiceId: parseOptionalBigInt(input.sourceInvoiceId, 'sourceInvoiceId'),
    sourceInvoiceItemId: parseOptionalBigInt(input.sourceInvoiceItemId, 'sourceInvoiceItemId'),
    previousEntitlementId: parseOptionalBigInt(input.previousEntitlementId, 'previousEntitlementId'),
    startDate: input.startDate || new Date(),
    endDate: input.endDate || null,
    reason: input.reason || null,
    activationSource: input.activationSource,
  };
}

function addValidity(startDate, count, unit) {
  if (!count || !unit) {
    return null;
  }
  const days = VALIDITY_UNIT_DAYS[unit];
  if (!days) {
    return null;
  }
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + (count * days));
  return endDate;
}

function validateEntitlementProduct(product) {
  if (!product) {
    throw createHttpError(404, 'Producto de derecho comercial no encontrado', 'entitlement_not_found');
  }
  if (product.commercialBehavior !== 'ENTITLEMENT' || product.controlsInventory) {
    throw createHttpError(400, 'El producto no habilita derechos comerciales', 'manual_activation_not_allowed');
  }
  if (!product.entitlementKind) {
    throw createHttpError(400, 'El producto no define tipo de derecho comercial', 'invalid_product_configuration');
  }
}

function assertReferenceFound(value, fieldName) {
  if (!value) {
    throw createHttpError(400, `${fieldName} no pertenece a la empresa autenticada`, 'cross_company_reference');
  }
}

function validateCreationContext(input, context) {
  assertReferenceFound(context.client, 'clientId');
  validateEntitlementProduct(context.product);

  if (input.sourceOrderId) {
    assertReferenceFound(context.sourceOrder, 'sourceOrderId');
    if (context.sourceOrder.clientId !== input.clientId) {
      throw createHttpError(400, 'La orden pertenece a otro cliente', 'cross_company_reference');
    }
  }
  if (input.sourceOrderItemId) {
    assertReferenceFound(context.sourceOrderItem, 'sourceOrderItemId');
    if (context.sourceOrderItem.productId !== input.productId) {
      throw createHttpError(400, 'La linea de orden pertenece a otro producto', 'cross_company_reference');
    }
    if (context.sourceOrderItem.order.clientId !== input.clientId) {
      throw createHttpError(400, 'La linea de orden pertenece a otro cliente', 'cross_company_reference');
    }
  }
  if (input.sourceInvoiceId) {
    assertReferenceFound(context.sourceInvoice, 'sourceInvoiceId');
    if (context.sourceInvoice.clientId !== input.clientId) {
      throw createHttpError(400, 'La factura pertenece a otro cliente', 'cross_company_reference');
    }
  }
  if (input.sourceInvoiceItemId) {
    assertReferenceFound(context.sourceInvoiceItem, 'sourceInvoiceItemId');
    if (context.sourceInvoiceItem.productId !== input.productId) {
      throw createHttpError(400, 'La linea de factura pertenece a otro producto', 'cross_company_reference');
    }
    if (context.sourceInvoiceItem.invoice.clientId !== input.clientId) {
      throw createHttpError(400, 'La linea de factura pertenece a otro cliente', 'cross_company_reference');
    }
  }
}

function buildEntitlementData(companyId, input, context, actorUserId) {
  const startDate = input.startDate;
  const product = context.product;
  const endDate = input.endDate || addValidity(
    startDate,
    product.defaultValidityCount,
    product.defaultValidityUnit,
  );
  const priceSnapshot = context.sourceInvoiceItem?.total ?? product.price ?? 0;

  return {
    companyId,
    clientId: input.clientId,
    productId: input.productId,
    sourceOrderId: input.sourceOrderId,
    sourceOrderItemId: input.sourceOrderItemId,
    sourceInvoiceId: input.sourceInvoiceId,
    sourceInvoiceItemId: input.sourceInvoiceItemId,
    previousEntitlementId: input.previousEntitlementId,
    status: 'ACTIVE',
    entitlementKind: product.entitlementKind,
    startDate,
    endDate,
    activatedAt: new Date(),
    activatedByUserId: actorUserId,
    activationSource: input.activationSource,
    manualActivationReason: input.activationSource === 'MANUAL' ? input.reason : null,
    priceSnapshot,
    currencySnapshot: product.currency || 'CRC',
    validityCountSnapshot: product.defaultValidityCount,
    validityUnitSnapshot: product.defaultValidityUnit,
    billingIntervalSnapshot: product.billingInterval,
    metadata: input.activationSource === 'RENEWAL'
      ? { renewal: true }
      : null,
  };
}

async function recordEntitlementAudit(req, action, entitlement, metadata = {}) {
  await recordAuditEventSafelyIfAvailable({
    req,
    action,
    resourceType: 'CustomerEntitlement',
    resourceId: entitlement.id,
    outcome: 'success',
    afterState: serializeEntitlement(entitlement),
    metadata,
  });
}

function isUniqueCommercialSourceConflict(error) {
  return error?.code === 'P2002'
    && Array.isArray(error?.meta?.target)
    && (
      error.meta.target.includes('source_order_item_id')
      || error.meta.target.includes('source_invoice_item_id')
      || error.meta.target.includes('sourceOrderItemId')
      || error.meta.target.includes('sourceInvoiceItemId')
    );
}

async function createActiveEntitlement(companyId, input, actorUserId, db) {
  const existing = await entitlementRepository.findExistingByCommercialSource(companyId, input, db);
  if (existing) {
    return existing;
  }
  const context = await entitlementRepository.getCreationContext(companyId, input, db);
  validateCreationContext(input, context);
  try {
    return await entitlementRepository.createEntitlement(
      buildEntitlementData(companyId, input, context, actorUserId),
      db,
    );
  } catch (error) {
    if (!isUniqueCommercialSourceConflict(error)) {
      throw error;
    }
    const retryExisting = await entitlementRepository.findExistingByCommercialSource(companyId, input, db);
    if (retryExisting) {
      return retryExisting;
    }
    throw error;
  }
}

function buildAutomaticActivationInput(invoiceItem, activationSource) {
  return {
    clientId: invoiceItem.invoice.clientId,
    productId: invoiceItem.productId,
    sourceOrderId: invoiceItem.invoice.orderId,
    sourceOrderItemId: invoiceItem.orderItemId,
    sourceInvoiceId: invoiceItem.invoiceId,
    sourceInvoiceItemId: invoiceItem.id,
    previousEntitlementId: null,
    startDate: new Date(),
    endDate: null,
    reason: null,
    activationSource,
  };
}

async function activateEntitlementsForInvoice(companyId, invoiceId, activationSource, actorUserId, db) {
  const invoiceItems = await entitlementRepository.listEntitlementInvoiceItemsForInvoice(companyId, invoiceId, db);
  const entitlements = [];
  for (const invoiceItem of invoiceItems) {
    entitlements.push(await createActiveEntitlement(
      companyId,
      buildAutomaticActivationInput(invoiceItem, activationSource),
      actorUserId,
      db,
    ));
  }
  return entitlements;
}

function buildListFilters(query = {}) {
  return {
    status: ['ACTIVE', 'CANCELLED', 'EXPIRED'].includes(query.status) ? query.status : undefined,
    productId: parseOptionalBigInt(query.productId, 'productId'),
    kind: query.kind || undefined,
    now: new Date(),
  };
}

async function listCompanyEntitlements(auth, pagination, query = {}) {
  const companyId = requireCompanyScope(auth);
  const { skip, take } = pagination;
  const { items, total } = await entitlementRepository.listByCompany(companyId, {
    skip,
    take,
    filters: buildListFilters(query),
  });
  return {
    items: items.map((item) => serializeEntitlement(item)),
    total,
  };
}

async function listClientEntitlements(clientId, auth, pagination, query = {}) {
  const companyId = requireCompanyScope(auth);
  const filters = {
    ...buildListFilters(query),
    clientId,
  };
  const { items, total } = await entitlementRepository.listByCompany(companyId, {
    skip: pagination.skip,
    take: pagination.take,
    filters,
  });
  return {
    items: items.map((item) => serializeEntitlement(item)),
    total,
  };
}

async function getCompanyEntitlement(id, auth) {
  const companyId = requireCompanyScope(auth);
  const entitlement = await entitlementRepository.getByIdForCompany(id, companyId);
  if (!entitlement) {
    throw createHttpError(404, 'Derecho comercial no encontrado', 'entitlement_not_found');
  }
  return serializeEntitlement(entitlement);
}

async function manuallyActivateEntitlement(input, auth, req = null) {
  const companyId = requireCompanyScope(auth);
  const actorUserId = getActorUserId(auth);
  const normalizedInput = {
    ...normalizeCreationInput(input),
    activationSource: 'MANUAL',
  };

  const entitlement = await entitlementRepository.transaction((db) => createActiveEntitlement(
    companyId,
    normalizedInput,
    actorUserId,
    db,
  ));
  await recordEntitlementAudit(req, 'entitlements.activate.manual', entitlement, {
    reason: normalizedInput.reason,
    clientId: normalizedInput.clientId,
    productId: normalizedInput.productId,
    sourceOrderId: normalizedInput.sourceOrderId,
    sourceInvoiceId: normalizedInput.sourceInvoiceId,
  });
  return serializeEntitlement(entitlement);
}

async function cancelEntitlement(id, input, auth, req = null) {
  const companyId = requireCompanyScope(auth);
  const existing = await entitlementRepository.getByIdForCompany(id, companyId);
  if (!existing) {
    throw createHttpError(404, 'Derecho comercial no encontrado', 'entitlement_not_found');
  }
  if (existing.status === 'CANCELLED') {
    throw createHttpError(409, 'El derecho comercial ya esta cancelado', 'entitlement_already_cancelled');
  }

  const entitlement = await entitlementRepository.updateEntitlementForCompany(id, companyId, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelledByUserId: getActorUserId(auth),
    cancellationReason: input.reason,
  });
  await recordEntitlementAudit(req, 'entitlements.cancel', entitlement, { reason: input.reason });
  return serializeEntitlement(entitlement);
}

async function renewEntitlement(id, input, auth, req = null) {
  const companyId = requireCompanyScope(auth);
  const existing = await entitlementRepository.getByIdForCompany(id, companyId);
  if (!existing) {
    throw createHttpError(404, 'Derecho comercial no encontrado', 'entitlement_not_found');
  }

  const normalizedInput = {
    ...normalizeCreationInput({
      ...input,
      clientId: existing.clientId,
      productId: existing.productId,
      previousEntitlementId: existing.id,
    }),
    activationSource: 'RENEWAL',
  };
  const entitlement = await entitlementRepository.transaction((db) => createActiveEntitlement(
    companyId,
    normalizedInput,
    getActorUserId(auth),
    db,
  ));
  await recordEntitlementAudit(req, 'entitlements.renew', entitlement, {
    previousEntitlementId: existing.id,
  });
  return serializeEntitlement(entitlement);
}

async function activateEntitlementsForApprovedPayment(payment, auth, req = null, db = null) {
  const companyId = requireCompanyScope(auth);
  if (payment.status !== 'APPROVED') {
    return [];
  }
  const entitlements = await activateEntitlementsForInvoice(
    companyId,
    payment.invoiceId,
    'PAYMENT_APPROVAL',
    getActorUserId(auth),
    db,
  );
  for (const entitlement of entitlements) {
    await recordEntitlementAudit(req, 'entitlements.activate', entitlement, {
      activationSource: 'PAYMENT_APPROVAL',
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
    });
  }
  return entitlements.map((entitlement) => serializeEntitlement(entitlement));
}

async function activateEntitlementsForApprovedCreditInvoice(invoice, auth, req = null, db = null) {
  const companyId = requireCompanyScope(auth);
  const entitlements = await activateEntitlementsForInvoice(
    companyId,
    invoice.id,
    'CREDIT_APPROVAL',
    getActorUserId(auth),
    db,
  );
  for (const entitlement of entitlements) {
    await recordEntitlementAudit(req, 'entitlements.activate', entitlement, {
      activationSource: 'CREDIT_APPROVAL',
      invoiceId: invoice.id,
      orderId: invoice.orderId || null,
    });
  }
  return entitlements.map((entitlement) => serializeEntitlement(entitlement));
}

module.exports = {
  activateEntitlementsForApprovedCreditInvoice,
  activateEntitlementsForApprovedPayment,
  cancelEntitlement,
  getCompanyEntitlement,
  listClientEntitlements,
  listCompanyEntitlements,
  manuallyActivateEntitlement,
  renewEntitlement,
  serializeEntitlement,
};
