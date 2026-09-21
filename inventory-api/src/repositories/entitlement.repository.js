const prisma = require('../lib/prisma');

// CustomerEntitlement repository.
//
// Every query in this module MUST be anchored to companyId. There is no
// unscoped read or mutation path.

const ENTITLEMENT_SELECT = {
  id: true,
  companyId: true,
  clientId: true,
  productId: true,
  sourceOrderId: true,
  sourceOrderItemId: true,
  sourceInvoiceId: true,
  sourceInvoiceItemId: true,
  previousEntitlementId: true,
  status: true,
  entitlementKind: true,
  startDate: true,
  endDate: true,
  activatedAt: true,
  activatedByUserId: true,
  activationSource: true,
  manualActivationReason: true,
  cancelledAt: true,
  cancelledByUserId: true,
  cancellationReason: true,
  priceSnapshot: true,
  currencySnapshot: true,
  validityCountSnapshot: true,
  validityUnitSnapshot: true,
  billingIntervalSnapshot: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      commercialBehavior: true,
      entitlementKind: true,
    },
  },
  client: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
};

function buildListWhere(companyId, filters = {}) {
  const where = { companyId };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.kind) where.entitlementKind = filters.kind;
  if (filters.status === 'CANCELLED') where.status = 'CANCELLED';
  if (filters.status === 'ACTIVE') {
    where.status = 'ACTIVE';
    where.OR = [{ endDate: null }, { endDate: { gte: filters.now || new Date() } }];
  }
  if (filters.status === 'EXPIRED') {
    where.status = 'ACTIVE';
    where.endDate = { lt: filters.now || new Date() };
  }
  return where;
}

async function listByCompany(companyId, { skip, take, filters = {} }) {
  const where = buildListWhere(companyId, filters);
  const [items, total] = await Promise.all([
    prisma.customerEntitlement.findMany({
      where,
      select: ENTITLEMENT_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    prisma.customerEntitlement.count({ where }),
  ]);
  return { items, total };
}

async function getByIdForCompany(id, companyId, db = prisma) {
  return db.customerEntitlement.findFirst({
    where: { id, companyId },
    select: ENTITLEMENT_SELECT,
  });
}

function transaction(work) {
  return prisma.$transaction(work);
}

async function getCreationContext(companyId, input, db = prisma) {
  const [client, product, sourceOrder, sourceOrderItem, sourceInvoice, sourceInvoiceItem] = await Promise.all([
    db.client.findFirst({ where: { id: input.clientId, companyId }, select: { id: true, companyId: true } }),
    db.product.findFirst({
      where: { id: input.productId, companyId, isActive: true },
      select: {
        id: true,
        companyId: true,
        productNature: true,
        controlsInventory: true,
        commercialBehavior: true,
        entitlementKind: true,
        defaultValidityCount: true,
        defaultValidityUnit: true,
        billingInterval: true,
        price: true,
        currency: true,
      },
    }),
    input.sourceOrderId
      ? db.order.findFirst({ where: { id: input.sourceOrderId, companyId }, select: { id: true, clientId: true } })
      : null,
    input.sourceOrderItemId
      ? db.orderItem.findFirst({
        where: { id: input.sourceOrderItemId, order: { companyId } },
        select: { id: true, orderId: true, productId: true, order: { select: { clientId: true } } },
      })
      : null,
    input.sourceInvoiceId
      ? db.invoice.findFirst({
        where: { id: input.sourceInvoiceId, client: { companyId } },
        select: { id: true, clientId: true },
      })
      : null,
    input.sourceInvoiceItemId
      ? db.invoiceItem.findFirst({
        where: { id: input.sourceInvoiceItemId, companyId },
        select: {
          id: true,
          invoiceId: true,
          productId: true,
          total: true,
          invoice: { select: { clientId: true } },
        },
      })
      : null,
  ]);

  return { client, product, sourceOrder, sourceOrderItem, sourceInvoice, sourceInvoiceItem };
}

async function createEntitlement(data, db = prisma) {
  return db.customerEntitlement.create({
    data,
    select: ENTITLEMENT_SELECT,
  });
}

async function updateEntitlementForCompany(id, companyId, data, db = prisma) {
  const result = await db.customerEntitlement.updateMany({
    where: { id, companyId },
    data,
  });
  if (result.count !== 1) {
    return null;
  }
  return getByIdForCompany(id, companyId, db);
}

async function findExistingByCommercialSource(companyId, source, db = prisma) {
  if (source.sourceInvoiceItemId) {
    return db.customerEntitlement.findFirst({
      where: { companyId, sourceInvoiceItemId: source.sourceInvoiceItemId },
      select: ENTITLEMENT_SELECT,
    });
  }
  if (source.sourceOrderItemId) {
    return db.customerEntitlement.findFirst({
      where: { companyId, sourceOrderItemId: source.sourceOrderItemId },
      select: ENTITLEMENT_SELECT,
    });
  }
  return null;
}

async function listEntitlementInvoiceItemsForInvoice(companyId, invoiceId, db = prisma) {
  if (!db.invoiceItem?.findMany) {
    return [];
  }
  return db.invoiceItem.findMany({
    where: {
      companyId,
      invoiceId,
      lineKind: 'ENTITLEMENT',
      invoice: { client: { companyId } },
      product: {
        companyId,
        commercialBehavior: 'ENTITLEMENT',
        controlsInventory: false,
        isActive: true,
      },
    },
    select: {
      id: true,
      invoiceId: true,
      orderItemId: true,
      productId: true,
      total: true,
      invoice: {
        select: {
          id: true,
          clientId: true,
          orderId: true,
        },
      },
    },
    orderBy: [{ id: 'asc' }],
  });
}

module.exports = {
  createEntitlement,
  findExistingByCommercialSource,
  getByIdForCompany,
  getCreationContext,
  listByCompany,
  listEntitlementInvoiceItemsForInvoice,
  transaction,
  updateEntitlementForCompany,
};
