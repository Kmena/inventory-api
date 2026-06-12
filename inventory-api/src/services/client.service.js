const clientRepository = require('../repositories/client.repository');
const regionRepository = require('../repositories/region.repository');
const { createHttpError } = require('../lib/errors');

function assertCompanyUser(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }
}

function serializeClient(client) {
  return {
    ...client,
    storesCount: client._count?.stores ?? client.stores?.length ?? 0,
  };
}

async function listClients() {
  return clientRepository.findAllClients();
}

async function listCompanyClients(auth) {
  assertCompanyUser(auth);
  const clients = await clientRepository.findCompanyClients(BigInt(auth.companyId));
  return clients.map(serializeClient);
}

async function getClient(id) {
  const client = await clientRepository.findClientById(id);
  if (!client) throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  return client;
}

async function createClient(payload) {
  return clientRepository.createClient(payload);
}

async function createCompanyClient(payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  const {
    legalName,
    commercialName,
    ...clientPayload
  } = payload;
  const legalEntity = await clientRepository.findOrCreateLegalEntity(companyId, {
    legalName: legalName || payload.name,
    commercialName: commercialName || payload.name,
    identificationType: payload.documentType,
    identificationNumber: payload.legalId,
    economicActivityCode: payload.economicActivityCode,
    economicActivityName: payload.economicActivityName,
    address: payload.address,
    email: payload.emailBilling,
    phone: payload.phone,
  });

  const client = await clientRepository.createClient({
    ...clientPayload,
    companyId,
    legalEntityId: legalEntity.id,
  });
  return serializeClient(client);
}

async function createCompanyClientStore(clientId, payload, auth) {
  assertCompanyUser(auth);

  const client = await clientRepository.findCompanyClientById(clientId, BigInt(auth.companyId));
  if (!client) {
    throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  }

  if (!payload.regionId) {
    throw createHttpError(400, 'Seleccione una zona para la tienda', 'validation_error');
  }

  const region = await regionRepository.findCompanyRegionById(payload.regionId, BigInt(auth.companyId));
  if (!region) {
    throw createHttpError(404, 'Zona no encontrada', 'not_found');
  }

  if (!region.subregions?.some((subregion) => subregion.id === payload.subregionId)) {
    throw createHttpError(400, 'La tienda debe estar ligada a una subzona valida de la zona seleccionada', 'validation_error');
  }

  try {
    return await clientRepository.createClientStore({
      ...payload,
      clientId,
      legalEntityId: client.legalEntityId,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una tienda con ese codigo para este cliente', 'conflict');
    }
    throw error;
  }
}

async function updateClient(id, payload) {
  await getClient(id);
  return clientRepository.updateClient(id, payload);
}

async function removeClient(id) {
  await getClient(id);
  return clientRepository.deleteClient(id);
}

module.exports = {
  listClients,
  listCompanyClients,
  getClient,
  createClient,
  createCompanyClient,
  createCompanyClientStore,
  updateClient,
  removeClient,
};
