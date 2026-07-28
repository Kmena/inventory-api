const fs = require('fs/promises');
const path = require('path');

const clientRepository = require('../repositories/client.repository');
const regionRepository = require('../repositories/region.repository');
const { createHttpError } = require('../lib/errors');
const { CLIENT_DOCUMENT_TYPES } = require('../lib/client-document-types');
const {
  sanitizeClientDocumentFileName,
  buildProtectedClientDocumentUrl,
  buildPrivateClientDocumentPath,
} = require('../lib/client-document-storage');
const {
  CLIENT_DOCUMENT_MAX_FILE_SIZE_BYTES,
  CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
  CLIENT_DOCUMENT_EXTENSION_MIME_MAP,
  GovernedFileValidationError,
  validateGovernedBase64FilePayload,
} = require('../lib/sensitive-file-governance');
const { buildPaginatedResponse } = require('../lib/pagination');

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

async function listClients(auth, pagination = null) {
  assertCompanyUser(auth);
  const clients = await clientRepository.findCompanyClients(BigInt(auth.companyId), pagination);
  if (pagination) {
    const paginatedClients = /** @type {{ items: Array<any>, totalItems: number }} */ (clients);
    return buildPaginatedResponse(paginatedClients.items.map(serializeClient), pagination, paginatedClients.totalItems);
  }
  const clientRows = /** @type {Array<any>} */ (clients);
  return clientRows.map(serializeClient);
}

async function listCompanyClients(auth, pagination = null) {
  assertCompanyUser(auth);
  const clients = await clientRepository.findCompanyClients(BigInt(auth.companyId), pagination);
  if (pagination) {
    const paginatedClients = /** @type {{ items: Array<any>, totalItems: number }} */ (clients);
    return buildPaginatedResponse(paginatedClients.items.map(serializeClient), pagination, paginatedClients.totalItems);
  }
  const clientRows = /** @type {Array<any>} */ (clients);
  return clientRows.map(serializeClient);
}

function validateClientDocumentPayload(payload) {
  const safeName = sanitizeClientDocumentFileName(payload.fileName);

  try {
    const { buffer, mimeType } = validateGovernedBase64FilePayload({
      fileName: safeName,
      mimeType: payload.mimeType,
      fileContentBase64: payload.fileContentBase64,
      maxFileSizeBytes: CLIENT_DOCUMENT_MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
      extensionMimeMap: CLIENT_DOCUMENT_EXTENSION_MIME_MAP,
      allowMimeTypeInference: true,
      invalidMimeTypeMessage: 'El documento debe ser PDF, imagen o archivo Word compatible',
      mimeExtensionMismatchMessage: 'El tipo MIME del documento no coincide con la extension del archivo',
      maxFileSizeMessage: 'Cada documento debe pesar 5 MB o menos',
    });

    return {
      buffer,
      fileName: safeName,
      mimeType,
    };
  } catch (error) {
    if (error instanceof GovernedFileValidationError) {
      throw createHttpError(400, error.message, 'validation_error');
    }
    throw error;
  }
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
  const documentId = await clientRepository.reserveClientDocumentId();
  const createdDocument = await clientRepository.createClientDocument({
    id: documentId,
    clientId,
    documentType: payload.documentType,
    documentNumber: payload.documentNumber,
    fileName: file.fileName,
    mimeType: file.mimeType,
    fileUrl: buildProtectedClientDocumentUrl(clientId, documentId),
    status: 'ACTIVE',
    notes: payload.notes,
  });

  try {
    await persistPrivateClientDocumentFile({
      companyId,
      clientId,
      documentId,
      fileName: file.fileName,
      buffer: file.buffer,
    });
  } catch {
    try {
      await clientRepository.deleteClientDocument(documentId, clientId, companyId);
    } catch (_cleanupError) {
      throw createHttpError(
        500,
        'No se pudo guardar el documento del cliente ni revertir su registro',
        'internal_server_error',
      );
    }

    throw createHttpError(500, 'No se pudo guardar el documento del cliente', 'internal_server_error');
  }

  return serializeClientDocument(createdDocument);
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

  return clientRepository.softDeleteCompanyClient(id, companyId);
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
