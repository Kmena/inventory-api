const prisma = require('../lib/prisma');

function findAllOrders() {
  return prisma.order.findMany({
    orderBy: { id: 'asc' },
    include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
  });
}

function findOrderById(id) {
  return prisma.order.findUnique({
    where: { id },
    include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
  });
}

function createOrder(data) {
  return prisma.order.create({
    data,
    include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
  });
}

function updateOrder(id, data) {
  return prisma.order.update({
    where: { id },
    data,
    include: { client: true, user: true, approvedBy: true, items: { include: { product: true } } },
  });
}

function deleteOrder(id) {
  return prisma.order.delete({ where: { id } });
}

module.exports = { findAllOrders, findOrderById, createOrder, updateOrder, deleteOrder };
