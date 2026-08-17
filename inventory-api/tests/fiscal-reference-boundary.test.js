const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fiscalReferenceRepository = require('../src/repositories/fiscal-reference.repository');
const fiscalReferenceService = require('../src/services/fiscal-reference.service');
const { createFiscalDocumentReferenceSchema } = require('../src/schemas/fiscal-reference.schema');

const auth = { sub: 10, companyId: 7, permissions: ['receipts.confirm'] };

const originals = {
  createFiscalDocumentReference: fiscalReferenceRepository.createFiscalDocumentReference,
  findFiscalReferencesByReceiptForCompany: fiscalReferenceRepository.findFiscalReferencesByReceiptForCompany,
  findReceiptByIdForCompany: fiscalReferenceRepository.findReceiptByIdForCompany,
  listAllFiscalReferencesForCompany: fiscalReferenceRepository.listAllFiscalReferencesForCompany,
};

function patch(overrides) { Object.assign(fiscalReferenceRepository, { ...originals, ...overrides }); }
function restore() { Object.assign(fiscalReferenceRepository, originals); }
async function withPatched(overrides, work) { patch(overrides); try { await work(); } finally { restore(); } }

const confirmedReceipt = { id: 9001n, companyId: 7n, status: 'CONFIRMED' };
const pendingReceipt = { id: 9002n, companyId: 7n, status: 'PENDING_INSPECTION' };

const validPayload = { documentType: '01', simplifiedRegime: false };

// -----------------------------------------------------------------------
// Schema tests
// -----------------------------------------------------------------------

test('fiscal reference schema accepts valid document types', () => {
  for (const type of ['01', '02', '03', '04', '08', '09', '12', '13']) {
    assert.ok(createFiscalDocumentReferenceSchema.safeParse({ documentType: type }).success, `type ${type} should be valid`);
  }
});

test('fiscal reference schema rejects unknown document types', () => {
  assert.ok(!createFiscalDocumentReferenceSchema.safeParse({ documentType: '99' }).success);
  assert.ok(!createFiscalDocumentReferenceSchema.safeParse({ documentType: '' }).success);
});

// -----------------------------------------------------------------------
// Billing/Hacienda boundary tests
// -----------------------------------------------------------------------

test('createFiscalReferenceForReceipt always sets status to PENDING — no external API is called', async () => {
  let capturedData = null;

  await withPatched({
    findReceiptByIdForCompany: async () => confirmedReceipt,
    createFiscalDocumentReference: async (data) => {
      capturedData = data;
      return { id: 1n, ...data, createdAt: new Date(), updatedAt: new Date() };
    },
  }, async () => {
    await fiscalReferenceService.createFiscalReferenceForReceipt(9001n, validPayload, auth);

    assert.equal(capturedData?.status, 'PENDING',
      'Fiscal reference must start as PENDING because Billing/Hacienda API does not exist (DEC-003)');
    assert.equal(capturedData?.externalReference, null,
      'No external Hacienda reference can exist yet');
    assert.equal(capturedData?.documentType, '01');
    assert.equal(capturedData?.purchaseReceiptId, 9001n);
  });
});

test('createFiscalReferenceForReceipt rejects unconfirmed receipts — boundary enforcement', async () => {
  await withPatched({
    findReceiptByIdForCompany: async () => pendingReceipt,
  }, async () => {
    await assert.rejects(
      () => fiscalReferenceService.createFiscalReferenceForReceipt(9002n, validPayload, auth),
      (err) => err?.statusCode === 409,
    );
  });
});

test('createFiscalReferenceForReceipt rejects when receipt not found', async () => {
  await withPatched({
    findReceiptByIdForCompany: async () => null,
  }, async () => {
    await assert.rejects(
      () => fiscalReferenceService.createFiscalReferenceForReceipt(9999n, validPayload, auth),
      (err) => err?.statusCode === 404,
    );
  });
});

test('listFiscalReferencesForReceipt returns references for company-owned receipt', async () => {
  const fakeRef = { id: 1n, purchaseReceiptId: 9001n, status: 'PENDING', documentType: '01' };

  await withPatched({
    findReceiptByIdForCompany: async () => confirmedReceipt,
    findFiscalReferencesByReceiptForCompany: async () => [fakeRef],
  }, async () => {
    const result = await fiscalReferenceService.listFiscalReferencesForReceipt(9001n, auth);
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'PENDING');
  });
});

test('fiscal reference boundary: no external HTTP client or Billing service is imported', () => {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../src/services/fiscal-reference.service.js'),
    'utf8',
  );
  // Ensure no external API calls exist in the service
  assert.ok(!serviceSource.includes('axios'), 'No HTTP client (axios) should be used in fiscal-reference service');
  assert.ok(!serviceSource.includes('fetch('), 'No fetch() calls should exist in fiscal-reference service');
  assert.ok(!serviceSource.includes('haciendaApiClient'), 'No hacienda API client should be called');
  assert.ok(!serviceSource.includes('billingService'), 'No billing service calls should exist');
  assert.ok(serviceSource.includes("status: 'PENDING'"), 'Default status must be PENDING');
  assert.ok(serviceSource.includes('DEC-003'), 'Service must reference the DEC-003 decision for auditability');
});

// -----------------------------------------------------------------------
// Migration and schema tests
// -----------------------------------------------------------------------

test('fiscal reference migration creates fiscal_document_references table with correct structure', () => {
  const MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/20260818040000_add_fiscal_document_reference/migration.sql');
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assert.ok(sql.includes('CREATE TYPE "FiscalReferenceStatus"'));
  assert.ok(sql.includes('CREATE TABLE "fiscal_document_references"'));
  assert.ok(sql.includes("DEFAULT 'PENDING'"), 'Default status must be PENDING in migration');
  assert.ok(sql.includes('REFERENCES "companies"("id")'));
  assert.ok(sql.includes('REFERENCES "purchase_receipts"("id")'));
  assert.ok(sql.includes('REFERENCES "purchase_orders"("id")'));
});

test('listAllFiscalReferences enforces company scope and returns empty array when no references exist', async () => {
  await withPatched({
    listAllFiscalReferencesForCompany: async (companyId) => {
      assert.equal(String(companyId), String(auth.companyId), 'must be called with authenticated company scope');
      return [];
    },
  }, async () => {
    const result = await fiscalReferenceService.listAllFiscalReferences(auth);
    assert.deepEqual(result, []);
  });
});

test('listAllFiscalReferences serializes references with purchaseReceipt and supplier', async () => {
  const fakeRef = {
    id: 5001n,
    companyId: 7n,
    purchaseReceiptId: 9001n,
    documentType: '01',
    status: 'PENDING',
    simplifiedRegime: false,
    externalReference: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseReceipt: {
      id: 9001n,
      status: 'CONFIRMED',
      supplierId: 3001n,
      supplier: { id: 3001n, name: 'Proveedor CR S.A.' },
    },
  };

  await withPatched({
    listAllFiscalReferencesForCompany: async () => [fakeRef],
  }, async () => {
    const result = await fiscalReferenceService.listAllFiscalReferences(auth);
    assert.equal(result.length, 1);
    assert.equal(result[0].documentType, '01');
    assert.equal(result[0].purchaseReceipt.supplier.name, 'Proveedor CR S.A.');
  });
});

test('listAllFiscalReferences throws 403 when companyId is absent', async () => {
  const unauthAuth = { sub: 1, companyId: null, permissions: ['receipts.view'] };
  await assert.rejects(
    () => fiscalReferenceService.listAllFiscalReferences(unauthAuth),
    /empresa/,
  );
});

test('fiscal-reference.routes.js declares GET / route guarded by receipt.view policy', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const routeSource = fs.readFileSync(
    path.join(__dirname, '../src/routes/fiscal-reference.routes.js'),
    'utf8',
  );
  assert.ok(routeSource.includes("authorizeAccessPolicy('receipt.view')"), 'GET / must require receipt.view');
  assert.ok(routeSource.includes('listAllFiscalReferences'), 'route must call listAllFiscalReferences');
  assert.ok(routeSource.includes('authenticate'), 'route must use authenticate middleware');
});

test('prisma schema exposes FiscalDocumentReference model with correct boundary fields', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  assert.ok(schema.includes('model FiscalDocumentReference'));
  assert.ok(schema.includes('enum FiscalReferenceStatus'));
  assert.ok(schema.includes('status            FiscalReferenceStatus @default(PENDING)'));
  assert.ok(schema.includes('externalReference String?'));
  assert.ok(schema.includes('simplifiedRegime  Boolean'));
});
