const prisma = require('../lib/prisma');

function includeOrder() {
  return {
    client: true,
    clientStore: {
      include: {
        subregion: {
          include: { region: true },
        },
      },
    },
    user: true,
    approvedBy: true,
    warehouse: true,
    items: { include: { product: true } },
  };
}

function findAllOrders(companyId, pagination = null) {
  const where = { companyId };
  const orderBy = /** @type {import('@prisma/client').Prisma.OrderOrderByWithRelationInput} */ ({ id: 'asc' });
  const include = includeOrder();

  if (!pagination) {
    return prisma.order.findMany({
      where,
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findOrderById(id, companyId) {
  return prisma.order.findFirst({
    where: { id, companyId },
    include: includeOrder(),
  });
}

function findWarehouse(id, companyId) {
  return prisma.warehouse.findFirst({ where: { id, companyId, isActive: true } });
}

function findCompanyClientStore(id, companyId) {
  return prisma.clientStore.findFirst({
    where: {
      id,
      isActive: true,
      client: { companyId },
    },
    include: {
      client: true,
    },
  });
}

function countCompanyProducts(ids, companyId) {
  return prisma.product.count({ where: { id: { in: ids }, companyId } });
}

function createOrder(data) {
  return prisma.order.create({ data, include: includeOrder() });
}

async function updateOrder(id, companyId, data) {
  const result = await prisma.order.updateMany({
    where: { id, companyId },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.order.findFirst({
    where: { id, companyId },
    include: includeOrder(),
  });
}

async function deleteOrder(id, companyId) {
  return prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: { id, companyId },
      include: includeOrder(),
    });

    if (!existingOrder) {
      return null;
    }

    const result = await tx.order.deleteMany({
      where: { id, companyId },
    });

    if (result.count === 0) {
      return null;
    }

    return existingOrder;
  });
}

/** @param {bigint} companyId */
function findApprovedOrdersForDispatch(companyId) {
  return prisma.order.findMany({
    where: { companyId, status: 'APPROVED' },
    orderBy: /** @type {any} */ ({ approvedAt: 'asc' }),
    include: {
      client:      true,
      clientStore: { include: { subregion: { include: { region: true } } } },
      user:        true,
      approvedBy:  true,
      warehouse:   true,
      items: {
        include: {
          product: { select: { id: true, name: true, code: true, lotStrategy: true } },
        },
      },
    },
  });
}

/**
 * Single order for warehouse dispatch view — includes RESERVE stock movements (lot allocations).
 * @param {bigint} id
 * @param {bigint} companyId
 */
async function findOrderWithAllocations(id, companyId) {
  const order = await prisma.order.findFirst({
    where: { id, companyId },
    include: {
      client:      true,
      clientStore: { include: { subregion: { include: { region: true } } } },
      user:        true,
      approvedBy:  true,
      warehouse:   true,
      items: {
        include: {
          product: { select: { id: true, name: true, code: true, lotStrategy: true } },
        },
      },
    },
  });
  if (!order) return null;

  // Attach lot allocation info from RESERVE stock movements
  const allocations = await prisma.stockMovement.findMany({
    where: {
      companyId,
      sourceType: 'order',
      sourceId: id,
      movementType: 'RESERVE',
    },
    include: {
      lot: { select: { id: true, code: true, expiresAt: true } },
    },
    orderBy: /** @type {any} */ ({ id: 'asc' }),
  });

  return { ...order, allocations };
}

module.exports = {
  findAllOrders,
  findOrderById,
  findWarehouse,
  findCompanyClientStore,
  countCompanyProducts,
  createOrder,
  updateOrder,
  deleteOrder,
  findApprovedOrdersForDispatch,
  findOrderWithAllocations,
};
