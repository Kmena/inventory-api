const { PrismaClient } = require('@prisma/client');

/**
 * @typedef {import('@prisma/client').PrismaClient & {
 *   checkDatabaseReadiness: (prismaClient?: import('@prisma/client').PrismaClient) => Promise<void>
 * }} PrismaClientWithReadiness
 */

/** @type {import('@prisma/client').PrismaClient | null} */
let prismaClient = null;

function getPrismaClient() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

async function checkDatabaseReadiness(prismaInstance = getPrismaClient()) {
  await prismaInstance.$queryRaw`SELECT 1`;
}

const prisma = /** @type {PrismaClientWithReadiness} */ (new Proxy({ checkDatabaseReadiness }, {
  get(target, property, receiver) {
    if (property === 'checkDatabaseReadiness') {
      return target.checkDatabaseReadiness;
    }

    const activeClient = getPrismaClient();
    const value = Reflect.get(activeClient, property, receiver);
    return typeof value === 'function' ? value.bind(activeClient) : value;
  },
  set(target, property, value) {
    if (property === 'checkDatabaseReadiness') {
      target.checkDatabaseReadiness = value;
      return true;
    }

    const activeClient = getPrismaClient();
    activeClient[property] = value;
    return true;
  },
}));

module.exports = prisma;
