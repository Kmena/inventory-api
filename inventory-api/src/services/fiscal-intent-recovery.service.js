'use strict';

const prisma = require('../lib/prisma');

function listRecoverableFiscalIntents(companyId, db = prisma) {
  return /** @type {any} */ (db).invoiceFiscalIntent.findMany({
    where: {
      companyId,
      status: { in: ['PENDING', 'ERROR_RETRYABLE'] },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      invoice: { include: { fiscalSnapshot: true } },
    },
  });
}

module.exports = {
  listRecoverableFiscalIntents,
};
