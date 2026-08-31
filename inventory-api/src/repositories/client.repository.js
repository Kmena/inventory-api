const prisma = require('../lib/prisma');

/** @type {[{ isPrimaryContact: 'desc' }, { fullName: 'asc' }]} */
const clientRepresentativeOrderBy = [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }];

/** @type {[{ createdAt: 'desc' }, { id: 'desc' }]} */
const clientDocumentOrderBy = [{ createdAt: 'desc' }, { id: 'desc' }];

/** @type {[{ name: 'asc' }, { id: 'asc' }]} */
const clientListOrderBy = [{ name: 'asc' }, { id: 'asc' }];

/** @type {[{ name: 'asc' }, { id: 'asc' }]} */
const clientClassificationOrderBy = [{ name: 'asc' }, { id: 'asc' }];

/** @returns {import('@prisma/client').Prisma.ClientInclude} */
function clientInclude() {
  return {
    classification: true,
    legalEntity: true,
    stores: {
      orderBy: /** @type {{ name: 'asc' }} */ ({ name: 'asc' }),
      include: {
        subregion: { include: { region: true } },
        legalEntity: true,
        representatives: { where: { isActive: true }, orderBy: clientRepresentativeOrderBy },
      },
    },
    contacts: true,
    references: true,
    documents: { orderBy: clientDocumentOrderBy },
    _count: { select: { stores: true } },
  };
}

function buildDefaultClientWhere(where = {}) {
  return {
    ...where,
    deletedAt: null,
  };
}

function findAllClients() {
  /** @type {{ id: 'asc' }} */
  const orderBy = { id: 'asc' };
  return prisma.client.findMany({
    where: buildDefaultClientWhere(),
    orderBy,
    include: clientInclude(),
  });
}

function findCompanyClients(companyId, pagination = null) {
  const where = buildDefaultClientWhere({ companyId });
  const orderBy = clientListOrderBy;

  if (!pagination) {
    return prisma.client.findMany({
      where,
      orderBy,
      include: clientInclude(),
    });
  }

  return prisma.$transaction([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: clientInclude(),
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findClientById(id) {
  return prisma.client.findFirst({
    where: buildDefaultClientWhere({ id }),
    include: clientInclude(),
  });
}

function findCompanyClientById(id, companyId) {
  return prisma.client.findFirst({
    where: buildDefaultClientWhere({ id, companyId }),
    include: clientInclude(),
  });
}

function findCompanyClassificationById(id, companyId) {
  return prisma.clientClassification.findFirst({
    where: { id, companyId, isActive: true },
  });
}

function findCompanyClassifications(companyId) {
  return prisma.clientClassification.findMany({
    where: { companyId, isActive: true },
    orderBy: clientClassificationOrderBy,
  });
}

function countClientStores(clientId) {
  return prisma.clientStore.count({ where: { clientId } });
}

function createClient(data) {
  return prisma.client.create({
    data,
    include: clientInclude(),
  });
}

async function updateCompanyClient(id, companyId, data) {
  const result = await prisma.client.updateMany({
    where: { id, companyId },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.client.findFirst({
    where: buildDefaultClientWhere({ id, companyId }),
    include: /** @type {import('@prisma/client').Prisma.ClientInclude} */ ({
      classification: true,
      legalEntity: true,
      contacts: true,
      references: true,
      documents: { orderBy: clientDocumentOrderBy },
    }),
  });
}

function softDeleteCompanyClient(id, companyId, deletedAt = new Date()) {
  return prisma.client.updateMany({
    where: buildDefaultClientWhere({ id, companyId }),
    data: {
      isActive: false,
      deletedAt,
    },
  });
}

function createClientStore(data) {
  const { representatives, ...storeData } = data;
  const primaryRepresentativeIndex = representatives?.findIndex((representative) => representative.isPrimaryContact) ?? -1;
  return prisma.clientStore.create({
    data: {
      ...storeData,
      representatives: representatives?.length
        ? {
            create: representatives.map((representative, index) => ({
              ...representative,
              isPrimaryContact: primaryRepresentativeIndex >= 0 ? index === primaryRepresentativeIndex : index === 0,
              isActive: true,
            })),
          }
        : undefined,
    },
    include: /** @type {import('@prisma/client').Prisma.ClientStoreInclude} */ ({
      subregion: { include: { region: true } },
      legalEntity: true,
      representatives: { where: { isActive: true }, orderBy: clientRepresentativeOrderBy },
    }),
  });
}

async function reserveClientDocumentId() {
  const rows = await prisma.$queryRaw`
    SELECT nextval(pg_get_serial_sequence('client_documents', 'id')) AS id
  `;
  return BigInt(rows[0].id);
}

function createClientDocument(data) {
  return prisma.clientDocument.create({
    data,
  });
}

async function updateClientDocument(id, clientId, companyId, data, prismaClient = prisma) {
  const result = await prismaClient.clientDocument.updateMany({
    where: {
      id,
      clientId,
      client: { companyId },
    },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return prismaClient.clientDocument.findFirst({
    where: {
      id,
      clientId,
      client: { companyId },
    },
  });
}

async function deleteClientDocument(id, clientId, companyId, prismaClient = prisma) {
  return prismaClient.$transaction(async (tx) => {
    const existingDocument = await tx.clientDocument.findFirst({
      where: {
        id,
        clientId,
        client: { companyId },
      },
    });

    if (!existingDocument) {
      return null;
    }

    const result = await tx.clientDocument.deleteMany({
      where: {
        id,
        clientId,
        client: { companyId },
      },
    });

    if (result.count === 0) {
      return null;
    }

    return existingDocument;
  });
}

function findCompanyClientDocumentById(documentId, clientId, companyId) {
  return prisma.clientDocument.findFirst({
    where: {
      id: documentId,
      clientId,
      client: { companyId },
    },
    include: {
      client: {
        select: {
          id: true,
          companyId: true,
        },
      },
    },
  });
}

function createClientReference(data) {
  return prisma.clientReference.create({
    data,
  });
}

async function findOrCreateLegalEntity(companyId, payload) {
  const identificationNumber = payload.identificationNumber || payload.taxIdentifier;
  if (identificationNumber) {
    const existing = await prisma.clientLegalEntity.findFirst({
      where: { companyId, identificationNumber },
    });
    if (existing) {
      const result = await prisma.clientLegalEntity.updateMany({
        where: { id: existing.id, companyId },
        data: {
          legalName: payload.legalName || existing.legalName,
          commercialName: payload.commercialName ?? existing.commercialName,
          identificationType: payload.identificationType ?? existing.identificationType,
          economicActivityCode: payload.economicActivityCode ?? existing.economicActivityCode,
          economicActivityName: payload.economicActivityName ?? existing.economicActivityName,
          address: payload.address ?? existing.address,
          email: payload.email ?? existing.email,
          phone: payload.phone ?? existing.phone,
          isActive: true,
        },
      });

      if (result.count === 0) {
        return null;
      }

      return prisma.clientLegalEntity.findFirst({
        where: { id: existing.id, companyId },
      });
    }
  }

  return prisma.clientLegalEntity.create({
    data: {
      companyId,
      legalName: payload.legalName,
      commercialName: payload.commercialName,
      identificationType: payload.identificationType,
      identificationNumber,
      economicActivityCode: payload.economicActivityCode,
      economicActivityName: payload.economicActivityName,
      province: payload.province,
      canton: payload.canton,
      district: payload.district,
      neighborhood: payload.neighborhood,
      address: payload.address,
      email: payload.email,
      phone: payload.phone,
      isActive: true,
    },
  });
}

function findClientLedger(clientId, companyId, options = {}, db = prisma) {
  const { take = 100, skip = 0, since } = options;
  const invoiceWhere = since ? { issuedAt: { gte: new Date(since) } } : {};
  return db.client.findFirst({
    where: { id: clientId, companyId, deletedAt: null },
    include: {
      stores: {
        where: { isActive: true },
        select: { id: true, name: true, creditLimit: true, creditBalance: true },
      },
      invoices: {
        where: invoiceWhere,
        take: Math.min(take, 500),
        skip,
        orderBy: /** @type {any} */ ([{ issuedAt: 'desc' }, { id: 'desc' }]),
        include: {
          payments: {
            orderBy: /** @type {any} */ ([{ createdAt: 'desc' }, { id: 'desc' }]),
          },
          order: { select: { id: true, status: true } },
        },
      },
    },
  });
}

module.exports = {
  findAllClients,
  findCompanyClients,
  findClientById,
  findCompanyClientById,
  findCompanyClassificationById,
  findCompanyClassifications,
  countClientStores,
  createClient,
  findOrCreateLegalEntity,
  updateCompanyClient,
  softDeleteCompanyClient,
  createClientStore,
  reserveClientDocumentId,
  createClientDocument,
  updateClientDocument,
  deleteClientDocument,
  findCompanyClientDocumentById,
  createClientReference,
  findClientLedger,
};
