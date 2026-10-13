'use strict';

const { createHttpError } = require('../lib/errors');

const MAX_CERTIFICATE_BYTES = 1_048_576;
const MAX_MULTIPART_BYTES = MAX_CERTIFICATE_BYTES + 64 * 1024;
const MAX_PIN_LENGTH = 200;

function assertMultipartContentType(contentType) {
  if (!/^multipart\/form-data\s*;/i.test(String(contentType || ''))) {
    throw createHttpError(415, 'El certificado debe enviarse como formulario multipart', 'FISCAL_CERTIFICATE_MULTIPART_REQUIRED');
  }
}

async function readBoundedBody(request, maxBytes = MAX_MULTIPART_BYTES) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw createHttpError(413, 'El archivo de certificado excede el límite permitido', 'FISCAL_CERTIFICATE_TOO_LARGE');
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      for (const collected of chunks) collected.fill(0);
      buffer.fill(0);
      throw createHttpError(413, 'El archivo de certificado excede el límite permitido', 'FISCAL_CERTIFICATE_TOO_LARGE');
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks, total);
  for (const collected of chunks) collected.fill(0);
  return body;
}

async function parseFiscalCertificateMultipartBuffer(rawBody, contentType) {
  assertMultipartContentType(contentType);
  let form;
  try {
    form = await new globalThis.Response(rawBody, { headers: { 'Content-Type': contentType } }).formData();
  } catch (_error) {
    throw createHttpError(400, 'No se pudo leer el formulario del certificado', 'FISCAL_CERTIFICATE_MULTIPART_INVALID');
  }

  const certificates = form.getAll('certificate');
  const pins = form.getAll('pin');
  if (certificates.length !== 1 || !(certificates[0] instanceof globalThis.File)) {
    throw createHttpError(400, 'Selecciona un único archivo PKCS#12', 'FISCAL_CERTIFICATE_FILE_REQUIRED');
  }
  if (pins.length !== 1 || typeof pins[0] !== 'string' || !pins[0].trim()) {
    throw createHttpError(400, 'Ingresa el PIN del certificado', 'FISCAL_CERTIFICATE_PIN_REQUIRED');
  }

  const certificate = certificates[0];
  if (certificate.size < 1 || certificate.size > MAX_CERTIFICATE_BYTES) {
    throw createHttpError(413, 'El archivo de certificado excede el límite permitido', 'FISCAL_CERTIFICATE_TOO_LARGE');
  }
  const hasControlCharacter = [...pins[0]].some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (pins[0].length > MAX_PIN_LENGTH || hasControlCharacter) {
    throw createHttpError(400, 'El PIN del certificado no es válido', 'FISCAL_CERTIFICATE_PIN_INVALID');
  }

  return {
    certificateBytes: Buffer.from(await certificate.arrayBuffer()),
    pin: pins[0],
  };
}

async function parseFiscalCertificateUpload(request, _response, next) {
  let rawBody = null;
  try {
    const contentType = request.headers['content-type'];
    assertMultipartContentType(contentType);
    rawBody = await readBoundedBody(request);
    request.fiscalCertificateUpload = await parseFiscalCertificateMultipartBuffer(rawBody, contentType);
    return next();
  } catch (error) {
    return next(error);
  } finally {
    rawBody?.fill(0);
  }
}

module.exports = {
  MAX_CERTIFICATE_BYTES,
  MAX_MULTIPART_BYTES,
  parseFiscalCertificateMultipartBuffer,
  parseFiscalCertificateUpload,
};
