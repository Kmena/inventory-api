const test = require('node:test');
const assert = require('node:assert/strict');

const { uploadClientDocumentSchema } = require('../src/schemas/client.schema');

test('uploadClientDocumentSchema accepts governed client documents with inferred MIME type', () => {
  const parsed = uploadClientDocumentSchema.parse({
    documentType: 'IDENTIFICACION',
    fileName: 'contrato.pdf',
    fileContentBase64: Buffer.from('documento privado').toString('base64'),
  });

  assert.equal(parsed.fileName, 'contrato.pdf');
  assert.equal(parsed.mimeType, undefined);
});

test('uploadClientDocumentSchema rejects mismatched MIME type and file extension', () => {
  const result = uploadClientDocumentSchema.safeParse({
    documentType: 'IDENTIFICACION',
    fileName: 'contrato.pdf',
    mimeType: 'image/png',
    fileContentBase64: Buffer.from('documento privado').toString('base64'),
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /MIME|extension/i);
});

test('uploadClientDocumentSchema rejects invalid base64 payloads', () => {
  const result = uploadClientDocumentSchema.safeParse({
    documentType: 'IDENTIFICACION',
    fileName: 'contrato.pdf',
    fileContentBase64: '%%%base64-invalido%%%',
  });

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /base64/i);
});
