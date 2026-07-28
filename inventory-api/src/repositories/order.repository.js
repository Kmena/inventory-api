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

function findAllOrders(companyId) {
  return prisma.order.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    include: includeOrder(),
  });
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

module.exports = {
  findAllOrders,
  findOrderById,
  findWarehouse,
  findCompanyClientStore,
  countCompanyProducts,
  createOrder,
  updateOrder,
  deleteOrder,
};
