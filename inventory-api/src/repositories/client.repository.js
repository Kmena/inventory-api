// @ts-nocheck -- Prisma nested orderBy literals require repository-specific typing not introduced in this P0 gate.
const prisma = require('../lib/prisma');

function clientInclude() {
  return {
    classification: true,
    legalEntity: true,
    stores: {
      orderBy: { name: 'asc' },
      include: {
        subregion: { include: { region: true } },
        legalEntity: true,
        representatives: { where: { isActive: true }, orderBy: [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }] },
      },
    },
    contacts: true,
    references: true,
    documents: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    _count: { select: { stores: true } },
  };
}

function findAllClients() {
  return prisma.client.findMany({
    orderBy: { id: 'asc' },
    include: clientInclude(),
  });
}

function findCompanyClients(companyId) {
  return prisma.client.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: clientInclude(),
  });
}

function findClientById(id) {
  return prisma.client.findUnique({
    where: { id },
    include: clientInclude(),
  });
}

function findCompanyClientById(id, companyId) {
  return prisma.client.findFirst({
    where: { id, companyId },
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
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
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
    where: { id, companyId },
    include: {
      classification: true,
      legalEntity: true,
      contacts: true,
      references: true,
      documents: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    },
  });
}

function deleteCompanyClient(id, companyId) {
  return prisma.client.deleteMany({
    where: { id, companyId },
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
    include: {
      subregion: { include: { region: true } },
      legalEntity: true,
      representatives: { where: { isActive: true }, orderBy: [{ isPrimaryContact: 'desc' }, { fullName: 'asc' }] },
    },
  });
}

function createClientDocument(data) {
  return prisma.clientDocument.create({
    data,
  });
}

function updateClientDocument(id, data) {
  return prisma.clientDocument.update({
    where: { id },
    data,
  });
}

function deleteClientDocument(id) {
  return prisma.clientDocument.delete({
    where: { id },
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
      return prisma.clientLegalEntity.update({
        where: { id: existing.id },
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
  deleteCompanyClient,
  createClientStore,
  createClientDocument,
  updateClientDocument,
  deleteClientDocument,
  findCompanyClientDocumentById,
  createClientReference,
};
