const { PrismaClient } = require('@prisma/client');

/**
 * @typedef {import('@prisma/client').PrismaClient & {
 *   checkDatabaseReadiness: (prismaClient?: import('@prisma/client').PrismaClient) => Promise<void>
 * }} PrismaClientWithReadiness
 */

const prisma = /** @type {PrismaClientWithReadiness} */ (new PrismaClient());

async function checkDatabaseReadiness(prismaClient = prisma) {
  await prismaClient.$queryRaw`SELECT 1`;
}

prisma.checkDatabaseReadiness = checkDatabaseReadiness;

module.exports = prisma;
