const path = require('path');

const PRIVATE_CLIENT_DOCUMENTS_ROOT = path.resolve(__dirname, '..', '..', 'storage', 'private', 'client-documents');
const LEGACY_PUBLIC_CLIENT_DOCUMENTS_ROOT = path.resolve(__dirname, '..', 'public', 'uploads', 'client-documents');
const LEGACY_PUBLIC_CLIENT_DOCUMENTS_PREFIX = '/uploads/client-documents/';

function sanitizeClientDocumentFileName(name) {
  return String(name || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getClientDocumentExtension(fileName) {
  const extension = path.extname(fileName || '').toLowerCase();
  return extension || '.bin';
}

function buildProtectedClientDocumentUrl(clientId, documentId) {
  return `/api/clients/${clientId}/documents/${documentId}/download`;
}

function buildPrivateClientDocumentPath({ companyId, clientId, documentId, fileName }) {
  const sanitizedFileName = sanitizeClientDocumentFileName(fileName);
  const extension = getClientDocumentExtension(sanitizedFileName);

  return path.join(
    PRIVATE_CLIENT_DOCUMENTS_ROOT,
    String(companyId),
    String(clientId),
    `${String(documentId)}${extension}`,
  );
}

function isLegacyPublicClientDocumentUrl(fileUrl) {
  return typeof fileUrl === 'string' && fileUrl.startsWith(LEGACY_PUBLIC_CLIENT_DOCUMENTS_PREFIX);
}

function buildLegacyPublicClientDocumentPath(fileUrl) {
  const relativePath = String(fileUrl || '')
    .replace(LEGACY_PUBLIC_CLIENT_DOCUMENTS_PREFIX, '')
    .replace(/^\/+/, '');
  const absolutePath = path.resolve(LEGACY_PUBLIC_CLIENT_DOCUMENTS_ROOT, relativePath);

  if (!absolutePath.startsWith(LEGACY_PUBLIC_CLIENT_DOCUMENTS_ROOT)) {
    throw new Error('Legacy client document path is outside the allowed public directory');
  }

  return absolutePath;
}

module.exports = {
  PRIVATE_CLIENT_DOCUMENTS_ROOT,
  LEGACY_PUBLIC_CLIENT_DOCUMENTS_ROOT,
  LEGACY_PUBLIC_CLIENT_DOCUMENTS_PREFIX,
  sanitizeClientDocumentFileName,
  getClientDocumentExtension,
  buildProtectedClientDocumentUrl,
  buildPrivateClientDocumentPath,
  isLegacyPublicClientDocumentUrl,
  buildLegacyPublicClientDocumentPath,
};
