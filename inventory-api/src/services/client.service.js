const fs = require('fs/promises');
const path = require('path');

const clientRepository = require('../repositories/client.repository');
const regionRepository = require('../repositories/region.repository');
const { createHttpError } = require('../lib/errors');
const { CLIENT_DOCUMENT_TYPES } = require('../lib/client-document-types');
const {
  sanitizeClientDocumentFileName,
  getClientDocumentExtension,
  buildProtectedClientDocumentUrl,
  buildPrivateClientDocumentPath,
} = require('../lib/client-document-storage');

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const EXTENSION_MIME_MAP = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function assertCompanyUser(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }
}

function serializeClientDocument(document) {
  return {
    ...document,
    fileUrl: buildProtectedClientDocumentUrl(document.clientId, document.id),
  };
}

function serializeClient(client) {
  const serializedClient = {
    ...client,
    storesCount: client._count?.stores ?? client.stores?.length ?? 0,
  };

  if (Array.isArray(client.documents)) {
    serializedClient.documents = client.documents.map(serializeClientDocument);
  }

  return serializedClient;
}

async function listClients(auth) {
  assertCompanyUser(auth);
  const clients = await clientRepository.findCompanyClients(BigInt(auth.companyId));
  return clients.map(serializeClient);
}

async function listCompanyClients(auth) {
  assertCompanyUser(auth);
  const clients = await clientRepository.findCompanyClients(BigInt(auth.companyId));
  return clients.map(serializeClient);
}

function validateClientDocumentPayload(payload) {
  const safeName = sanitizeClientDocumentFileName(payload.fileName);
  const extension = getClientDocumentExtension(safeName);
  const mimeType = payload.mimeType || EXTENSION_MIME_MAP[extension] || 'application/octet-stream';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw createHttpError(400, 'El documento debe ser PDF, imagen o archivo Word compatible', 'validation_error');
  }

  let buffer;
  try {
    buffer = Buffer.from(payload.fileContentBase64, 'base64');
  } catch (_error) {
    throw createHttpError(400, 'El archivo adjunto no es valido', 'validation_error');
  }

  if (!buffer.length) {
    throw createHttpError(400, 'El archivo adjunto esta vacio', 'validation_error');
  }

  if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    throw createHttpError(400, 'Cada documento debe pesar 5 MB o menos', 'validation_error');
  }

  return {
    buffer,
    fileName: safeName,
    mimeType,
  };
}

async function persistPrivateClientDocumentFile({ companyId, clientId, documentId, fileName, buffer }) {
  const absolutePath = buildPrivateClientDocumentPath({ companyId, clientId, documentId, fileName });
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return absolutePath;
}

async function listCompanyClassifications(auth) {
  assertCompanyUser(auth);
  return clientRepository.findCompanyClassifications(BigInt(auth.companyId));
}

function listClientDocumentTypes() {
  return CLIENT_DOCUMENT_TYPES;
}

async function getClient(id, auth) {
  assertCompanyUser(auth);
  const client = await clientRepository.findCompanyClientById(id, BigInt(auth.companyId));
  if (!client) throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  return serializeClient(client);
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

  if (clientPayload.clientClassificationId) {
    const classification = await clientRepository.findCompanyClassificationById(
      clientPayload.clientClassificationId,
      companyId,
    );
    if (!classification) {
      throw createHttpError(400, 'Seleccione una clasificacion de cliente valida', 'validation_error');
    }
  }

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

  const subregion = await regionRepository.findCompanySubregionById(payload.subregionId, BigInt(auth.companyId));
  if (!subregion) {
    throw createHttpError(400, 'La tienda debe estar ligada a una subzona valida de la empresa', 'validation_error');
  }

  try {
    const existingStores = await clientRepository.countClientStores(clientId);
    return await clientRepository.createClientStore({
      ...payload,
      clientId,
      legalEntityId: client.legalEntityId,
      isPrimary: existingStores === 0,
      isActive: true,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una tienda con ese codigo para este cliente', 'conflict');
    }
    throw error;
  }
}

async function createCompanyClientDocument(clientId, payload, auth) {
  assertCompanyUser(auth);

  const companyId = BigInt(auth.companyId);
  const client = await clientRepository.findCompanyClientById(clientId, companyId);
  if (!client) {
    throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  }

  const file = validateClientDocumentPayload(payload);
  const createdDocument = await clientRepository.createClientDocument({
    clientId,
    documentType: payload.documentType,
    documentNumber: payload.documentNumber,
    fileName: file.fileName,
    mimeType: file.mimeType,
    fileUrl: 'pending://client-document',
    status: 'ACTIVE',
    notes: payload.notes,
  });

  try {
    await persistPrivateClientDocumentFile({
      companyId,
      clientId,
      documentId: createdDocument.id,
      fileName: file.fileName,
      buffer: file.buffer,
    });
  } catch {
    try {
      await clientRepository.deleteClientDocument(createdDocument.id);
    } catch (_cleanupError) {
      throw createHttpError(
        500,
        'No se pudo guardar el documento del cliente ni revertir su registro',
        'internal_server_error',
      );
    }

    throw createHttpError(500, 'No se pudo guardar el documento del cliente', 'internal_server_error');
  }

  const updatedDocument = await clientRepository.updateClientDocument(createdDocument.id, {
    fileUrl: buildProtectedClientDocumentUrl(clientId, createdDocument.id),
  });

  return serializeClientDocument(updatedDocument);
}

async function getCompanyClientDocumentDownload(clientId, documentId, auth) {
  assertCompanyUser(auth);

  const companyId = BigInt(auth.companyId);
  const document = await clientRepository.findCompanyClientDocumentById(documentId, clientId, companyId);
  if (!document) {
    throw createHttpError(404, 'Documento no encontrado', 'not_found');
  }

  const absolutePath = buildPrivateClientDocumentPath({
    companyId,
    clientId,
    documentId: document.id,
    fileName: document.fileName,
  });

  try {
    await fs.access(absolutePath);
  } catch (_error) {
    throw createHttpError(404, 'Documento no disponible para descarga', 'not_found');
  }

  return {
    absolutePath,
    fileName: document.fileName,
    mimeType: document.mimeType || 'application/octet-stream',
  };
}

async function createCompanyClientReference(clientId, payload, auth) {
  assertCompanyUser(auth);

  const client = await clientRepository.findCompanyClientById(clientId, BigInt(auth.companyId));
  if (!client) {
    throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  }

  return clientRepository.createClientReference({
    clientId,
    name: payload.name,
    contact: payload.contact,
    phone1: payload.phone1,
    phone2: payload.phone2,
    termDays: payload.termDays,
    amount: payload.amount,
    approved: Boolean(payload.approved),
    approvedBy: payload.approvedBy,
  });
}

async function updateClient(id, payload, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  const existingClient = await clientRepository.findCompanyClientById(id, companyId);
  if (!existingClient) {
    throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  }

  const { companyId: _ignoredCompanyId, ...safePayload } = payload;
  return clientRepository.updateCompanyClient(id, companyId, safePayload);
}

async function removeClient(id, auth) {
  assertCompanyUser(auth);
  const companyId = BigInt(auth.companyId);
  const existingClient = await clientRepository.findCompanyClientById(id, companyId);
  if (!existingClient) {
    throw createHttpError(404, 'Cliente no encontrado', 'not_found');
  }

  return clientRepository.deleteCompanyClient(id, companyId);
}

module.exports = {
  listClients,
  listCompanyClients,
  listCompanyClassifications,
  listClientDocumentTypes,
  getClient,
  createClient,
  createCompanyClient,
  createCompanyClientStore,
  createCompanyClientDocument,
  createCompanyClientReference,
  getCompanyClientDocumentDownload,
  updateClient,
  removeClient,
};
