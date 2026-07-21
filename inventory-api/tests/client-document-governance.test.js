const test = require('node:test');
const assert = require('node:assert/strict');

const clientService = require('../src/services/client.service');
const clientRepository = require('../src/repositories/client.repository');

function withRepositoryStubs(stubsByModule, run) {
  const originals = [];

  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

test('createCompanyClientDocument infers MIME type from the file extension when the payload omits mimeType', async () => {
  let capturedPayload = null;

  const result = await withRepositoryStubs(
    [[clientRepository, {
      findCompanyClientById: async () => ({ id: 15n, companyId: 91n }),
      createClientDocument: async (payload) => {
        capturedPayload = payload;
        return { id: 44n, ...payload };
      },
      updateClientDocument: async (_id, payload) => ({ id: 44n, clientId: 15n, fileName: 'contrato.pdf', mimeType: 'application/pdf', ...payload }),
      deleteClientDocument: async () => ({ count: 1 }),
    }]],
    () => clientService.createCompanyClientDocument(15n, {
      documentType: 'CEDULA',
      fileName: 'contrato.pdf',
      fileContentBase64: Buffer.from('documento privado').toString('base64'),
    }, {
      companyId: '91',
      sub: '7',
    }),
  );

  assert.equal(capturedPayload.mimeType, 'application/pdf');
  assert.equal(result.mimeType, 'application/pdf');
});

test('createCompanyClientDocument rejects mismatched MIME type and file extension', async () => {
  await withRepositoryStubs(
    [[clientRepository, {
      findCompanyClientById: async () => ({ id: 15n, companyId: 91n }),
    }]],
    async () => {
      await assert.rejects(
        () => clientService.createCompanyClientDocument(15n, {
          documentType: 'CEDULA',
          fileName: 'contrato.pdf',
          mimeType: 'image/png',
          fileContentBase64: Buffer.from('documento privado').toString('base64'),
        }, {
          companyId: '91',
          sub: '7',
        }),
        (error) => error?.statusCode === 400 && error?.code === 'validation_error' && /mime|extension/i.test(error.message),
      );
    },
  );
});
