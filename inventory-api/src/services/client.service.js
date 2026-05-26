const clientRepository = require('../repositories/client.repository');
const { createHttpError } = require('../lib/errors');

async function listClients() {
  return clientRepository.findAllClients();
}

async function getClient(id) {
  const client = await clientRepository.findClientById(id);
  if (!client) throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  return client;
}

async function createClient(payload) {
  return clientRepository.createClient(payload);
}

async function updateClient(id, payload) {
  await getClient(id);
  return clientRepository.updateClient(id, payload);
}

async function removeClient(id) {
  await getClient(id);
  return clientRepository.deleteClient(id);
}

module.exports = { listClients, getClient, createClient, updateClient, removeClient };
