const prisma = require('../lib/prisma');

function findAllClients() {
  return prisma.client.findMany({
    orderBy: { id: 'asc' },
    include: { region: true, contacts: true, references: true },
  });
}

function findClientById(id) {
  return prisma.client.findUnique({
    where: { id },
    include: { region: true, contacts: true, references: true },
  });
}

function createClient(data) {
  return prisma.client.create({ data, include: { region: true, contacts: true, references: true } });
}

function updateClient(id, data) {
  return prisma.client.update({ where: { id }, data, include: { region: true, contacts: true, references: true } });
}

function deleteClient(id) {
  return prisma.client.delete({ where: { id } });
}

module.exports = { findAllClients, findClientById, createClient, updateClient, deleteClient };
