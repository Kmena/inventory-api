const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';

const clientRepository = require('../src/repositories/client.repository');
const clientService = require('../src/services/client.service');
const authLib = require('../src/lib/auth');
const userRepository = require('../src/repositories/user.repository');
const app = require('../src/app');
const {
  buildPrivateClientDocumentPath,
  PRIVATE_CLIENT_DOCUMENTS_ROOT,
} = require('../src/lib/client-document-storage');

function withModuleStubs(stubsByModule, run) {
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

async function withHttpServer(run) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

function buildClientDocumentPayload(overrides = {}) {
  return {
    documentType: 'IDENTIFICACION',
    documentNumber: 'ABC-123',
    fileName: 'cedula.pdf',
    mimeType: 'application/pdf',
    fileContentBase64: Buffer.from('documento privado').toString('base64'),
    notes: 'Expediente inicial',
    ...overrides,
  };
}

test('createCompanyClientDocument persists files outside the public directory and returns a protected fileUrl', async () => {
  const payload = buildClientDocumentPayload();

  const createdDocument = await withModuleStubs(
    [[clientRepository, {
      findCompanyClientById: async () => ({ id: 5n, companyId: 9n }),
      createClientDocument: async (documentPayload) => ({
        id: 12n,
        clientId: 5n,
        ...documentPayload,
      }),
      updateClientDocument: async (documentId, updatePayload) => ({
        id: documentId,
        clientId: 5n,
        fileName: 'cedula.pdf',
        mimeType: 'application/pdf',
        documentType: 'IDENTIFICACION',
        fileUrl: updatePayload.fileUrl,
        status: 'ACTIVE',
      }),
      deleteClientDocument: async () => {
        throw new Error('deleteClientDocument should not be called on successful writes');
      },
    }]],
    () => clientService.createCompanyClientDocument(5n, payload, { companyId: '9' }),
  );

  const privateFilePath = buildPrivateClientDocumentPath({
    companyId: 9n,
    clientId: 5n,
    documentId: 12n,
    fileName: 'cedula.pdf',
  });

  const storedContent = await fs.readFile(privateFilePath, 'utf8');
  assert.equal(storedContent, 'documento privado');
  assert.equal(createdDocument.fileUrl, '/api/clients/5/documents/12/download');
  assert.equal(privateFilePath.includes(path.join('src', 'public', 'uploads')), false);

  await fs.rm(path.join(PRIVATE_CLIENT_DOCUMENTS_ROOT, '9'), { recursive: true, force: true });
});

test('createCompanyClientDocument removes the DB record when file persistence fails before any private artifact is stored', async () => {
  const payload = buildClientDocumentPayload({ fileName: 'fallo-escritura.pdf' });
  const operations = [];
  let deleteDocumentId = null;

  await withModuleStubs(
    [
      [clientRepository, {
        findCompanyClientById: async () => ({ id: 5n, companyId: 9n }),
        createClientDocument: async (documentPayload) => {
          operations.push({ step: 'create-db-record', fileUrl: documentPayload.fileUrl });
          return {
            id: 13n,
            clientId: 5n,
            ...documentPayload,
          };
        },
        updateClientDocument: async () => {
          throw new Error('updateClientDocument should not be called after a file write failure');
        },
        deleteClientDocument: async (documentId) => {
          deleteDocumentId = documentId;
          operations.push({ step: 'delete-db-record', documentId });
        },
      }],
      [fs, {
        writeFile: async () => {
          operations.push({ step: 'write-file-failed' });
          throw new Error('disk full');
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => clientService.createCompanyClientDocument(5n, payload, { companyId: '9' }),
        (error) => {
          assert.equal(error.statusCode, 500);
          assert.equal(error.code, 'internal_server_error');
          assert.equal(error.message, 'No se pudo guardar el documento del cliente');
          return true;
        },
      );
    },
  );

  assert.equal(deleteDocumentId, 13n);
  assert.deepEqual(operations, [
    { step: 'create-db-record', fileUrl: 'pending://client-document' },
    { step: 'write-file-failed' },
    { step: 'delete-db-record', documentId: 13n },
  ]);

  const privateFilePath = buildPrivateClientDocumentPath({
    companyId: 9n,
    clientId: 5n,
    documentId: 13n,
    fileName: payload.fileName,
  });
  await assert.rejects(() => fs.access(privateFilePath), /ENOENT/);
});

test('createCompanyClientDocument reports cleanup failure when file persistence and DB rollback both fail', async () => {
  const payload = buildClientDocumentPayload({ fileName: 'fallo-rollback.pdf' });
  const operations = [];

  await withModuleStubs(
    [
      [clientRepository, {
        findCompanyClientById: async () => ({ id: 5n, companyId: 9n }),
        createClientDocument: async (documentPayload) => {
          operations.push({ step: 'create-db-record', fileUrl: documentPayload.fileUrl });
          return {
            id: 14n,
            clientId: 5n,
            ...documentPayload,
          };
        },
        updateClientDocument: async () => {
          throw new Error('updateClientDocument should not be called after a file write failure');
        },
        deleteClientDocument: async () => {
          operations.push({ step: 'delete-db-record-failed' });
          throw new Error('rollback unavailable');
        },
      }],
      [fs, {
        writeFile: async () => {
          operations.push({ step: 'write-file-failed' });
          throw new Error('permission denied');
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => clientService.createCompanyClientDocument(5n, payload, { companyId: '9' }),
        (error) => {
          assert.equal(error.statusCode, 500);
          assert.equal(error.code, 'internal_server_error');
          assert.equal(error.message, 'No se pudo guardar el documento del cliente ni revertir su registro');
          return true;
        },
      );
    },
  );

  assert.deepEqual(operations, [
    { step: 'create-db-record', fileUrl: 'pending://client-document' },
    { step: 'write-file-failed' },
    { step: 'delete-db-record-failed' },
  ]);

  const privateFilePath = buildPrivateClientDocumentPath({
    companyId: 9n,
    clientId: 5n,
    documentId: 14n,
    fileName: payload.fileName,
  });
  await assert.rejects(() => fs.access(privateFilePath), /ENOENT/);
});

test('createCompanyClientDocument currently leaves the private file and pending DB record when the final DB update fails', async () => {
  const payload = buildClientDocumentPayload({ fileName: 'fallo-update-final.pdf' });
  const operations = [];
  let createdDocumentSnapshot = null;

  await fs.rm(path.join(PRIVATE_CLIENT_DOCUMENTS_ROOT, '9'), { recursive: true, force: true });

  await withModuleStubs(
    [[clientRepository, {
      findCompanyClientById: async () => ({ id: 5n, companyId: 9n }),
      createClientDocument: async (documentPayload) => {
        createdDocumentSnapshot = {
          id: 15n,
          clientId: 5n,
          ...documentPayload,
        };
        operations.push({ step: 'create-db-record', fileUrl: documentPayload.fileUrl });
        return createdDocumentSnapshot;
      },
      updateClientDocument: async () => {
        operations.push({ step: 'update-db-record-failed' });
        throw new Error('db update failed');
      },
      deleteClientDocument: async () => {
        operations.push({ step: 'delete-db-record-unexpected' });
      },
    }]],
    async () => {
      await assert.rejects(
        () => clientService.createCompanyClientDocument(5n, payload, { companyId: '9' }),
        /db update failed/,
      );
    },
  );

  const privateFilePath = buildPrivateClientDocumentPath({
    companyId: 9n,
    clientId: 5n,
    documentId: 15n,
    fileName: payload.fileName,
  });
  const storedContent = await fs.readFile(privateFilePath, 'utf8');

  assert.equal(storedContent, 'documento privado');
  assert.equal(createdDocumentSnapshot.fileUrl, 'pending://client-document');
  assert.deepEqual(operations, [
    { step: 'create-db-record', fileUrl: 'pending://client-document' },
    { step: 'update-db-record-failed' },
  ]);

  await fs.rm(path.join(PRIVATE_CLIENT_DOCUMENTS_ROOT, '9'), { recursive: true, force: true });
});

test('getCompanyClientDocumentDownload rejects documents outside the authenticated tenant', async () => {
  await withModuleStubs(
    [[clientRepository, {
      findCompanyClientDocumentById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => clientService.getCompanyClientDocumentDownload(5n, 12n, { companyId: '44' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('document download route rejects unauthenticated access', async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/clients/5/documents/12/download`);
    const result = await response.json();

    assert.equal(response.status, 401);
    assert.equal(result.error, 'unauthorized');
  });
});

test('document download route returns an attachment for the authenticated tenant', async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'inventory-client-document-'));
  const tempFilePath = path.join(tempDirectory, 'contrato.pdf');
  await fs.writeFile(tempFilePath, 'archivo seguro');

  await withModuleStubs(
    [
      [userRepository, {
        findAuthenticatedUserById: async () => ({
          id: 7n,
          username: 'admin-demo',
          status: 'ACTIVE',
          companyId: 9n,
          company: { isActive: true },
          role: { code: 'admin', isActive: true, rolePermissions: [] },
        }),
      }],
      [clientService, {
        getCompanyClientDocumentDownload: async () => ({
          absolutePath: tempFilePath,
          fileName: 'contrato.pdf',
          mimeType: 'application/pdf',
        }),
      }],
    ],
    async () => {
      await withHttpServer(async (baseUrl) => {
        const accessToken = authLib.signAccessToken({
          id: 7n,
          username: 'admin-demo',
          companyId: 9n,
          role: { code: 'admin', rolePermissions: [] },
        });

        const response = await fetch(`${baseUrl}/api/clients/5/documents/12/download`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const content = await response.text();

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-disposition') || '', /attachment; filename="?contrato\.pdf"?/i);
        assert.equal(response.headers.get('content-type'), 'application/pdf');
        assert.equal(content, 'archivo seguro');
      });
    },
  );

  await fs.rm(tempDirectory, { recursive: true, force: true });
});
