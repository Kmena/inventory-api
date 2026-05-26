const prisma = require('../lib/prisma');

function transaction(work) {
  return prisma.$transaction(work);
}

function findAllMovements() {
  return prisma.stockMovement.findMany({
    orderBy: { id: 'desc' },
    include: { product: true, lot: true },
  });
}

module.exports = {
  transaction,
  findAllMovements,
};
