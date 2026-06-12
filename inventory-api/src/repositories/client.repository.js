const prisma = require('../lib/prisma');

function clientInclude() {
  return {
    region: true,
    legalEntity: true,
    stores: { orderBy: { name: 'asc' }, include: { region: true, subregion: true, legalEntity: true } },
    contacts: true,
    references: true,
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

function createClient(data) {
  return prisma.client.create({
    data,
    include: clientInclude(),
  });
}

function updateClient(id, data) {
  return prisma.client.update({ where: { id }, data, include: { region: true, contacts: true, references: true } });
}

function deleteClient(id) {
  return prisma.client.delete({ where: { id } });
}

function createClientStore(data) {
  return prisma.clientStore.create({ data, include: { region: true, subregion: true } });
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
  createClient,
  findOrCreateLegalEntity,
  updateClient,
  deleteClient,
  createClientStore,
};
