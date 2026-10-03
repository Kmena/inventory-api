'use strict';

/**
 * Wave 1 tests — Browser-safe fiscal DTO
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Verifies:
 *   - buildFiscalDto (list projection)
 *   - buildFiscalDtoDetail (detail projection)
 *   - serializeInvoiceForList
 *   - serializeInvoiceForDetail
 *   - listInvoices / getInvoice integration with stubs
 *   - Explicit absence of all InvoiceFiscalIntent internal fields
 *   - Cross-company isolation (getInvoice → 404 for wrong company)
 *   - acceptedAt null semantics for non-ACCEPTED statuses
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFiscalDto,
  buildFiscalDtoDetail,
  serializeInvoiceForList,
  serializeInvoiceForDetail,
  listInvoices,
  getInvoice,
} = require('../src/services/invoice.service');
const invoiceRepository = require('../src/repositories/invoice.repository');

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Builds a minimal valid invoice stub with optional overrides. */
function makeInvoiceStub(overrides = {}) {
  return {
    id: 1623n,
    number: 'INV-963',
    clientId: 42n,
    orderId: 963n,
    amount: 5000,
    status: 'PENDING',
    issuedAt: new Date('2025-01-15T00:00:00.000Z'),
    dueAt: null,
    paidAt: null,
    client: { id: 42n, name: 'Empresa Test S.A.' },
    order: { id: 963n, clientStoreId: 7n, clientStore: { name: 'Tienda Centro' } },
    payments: [],
    fiscalIntent: null,
    ...overrides,
  };
}

/** Returns an intent with a full set of INTERNAL fields that must NOT reach the browser. */
function makeIntentWithInternals(statusOverrides = {}) {
  return {
    // INTERNAL — must not reach browser
    id: 99n,
    invoiceId: 1623n,
    companyId: 7n,
    billingIntegrationConfigId: 3n,
    idempotencyKey: 'should-never-appear-in-response',
    billingFiscalDocumentId: '353a13aa-dd13-4382-8af3-9bb15280fff6',
    billingStatus: 'HACIENDA_ACCEPTED',
    failureCode: 'SOME_FAILURE_CODE',
    failureMessage: 'INTERNAL: some failure details that must never reach browser',
    attemptCount: 3,
    lastAttemptAt: new Date('2025-01-15T14:25:00.000Z'),
    nextAttemptAt: null,
    lastSyncAt: new Date('2025-01-15T14:30:00.000Z'),
    createdAt: new Date('2025-01-15T00:00:00.000Z'),
    updatedAt: new Date('2025-01-15T14:30:00.000Z'),
    // SAFE — should reach browser
    status: 'ACCEPTED',
    clave: '50625092600020753025100100001010000000001101924748',
    consecutive: '00100001010000000001',
    metadata: { billingAcceptedAt: '2025-01-15T14:30:00.000Z', reconciliationAttemptCount: 1 },
    ...statusOverrides,
  };
}

/** The set of field names that must NEVER appear in any DTO response. */
const INTERNAL_FIELD_NAMES = [
  'failureMessage',
  'failureCode',
  'retryCount',
  'nextRetryAt',
  'lastAttemptAt',
  'idempotencyKey',
  'billingFiscalDocumentId',
  'billingStatus',
  'processingNodeId',
  'metadata',
  'billingPayload',
  'attemptCount',
  'lastSyncAt',
  'billingIntegrationConfigId',
  'nextAttemptAt',
];

// ─── buildFiscalDto (LIST) ────────────────────────────────────────────────────

test('buildFiscalDto returns null when intent is null', () => {
  assert.equal(buildFiscalDto(null), null);
});

test('buildFiscalDto returns null when intent is undefined', () => {
  assert.equal(buildFiscalDto(undefined), null);
});

test('buildFiscalDto returns only status for PENDING intent', () => {
  const dto = buildFiscalDto({ status: 'PENDING', clave: null, failureMessage: 'should-not-appear' });
  assert.deepEqual(dto, { status: 'PENDING' });
});

test('buildFiscalDto returns only status for ACCEPTED intent', () => {
  const dto = buildFiscalDto(makeIntentWithInternals());
  assert.deepEqual(dto, { status: 'ACCEPTED' });
});

test('buildFiscalDto excludes all internal fields', () => {
  const dto = buildFiscalDto(makeIntentWithInternals());
  assert.ok(dto, 'dto must not be null');
  for (const field of INTERNAL_FIELD_NAMES) {
    assert.equal(
      dto[field],
      undefined,
      `buildFiscalDto must not expose internal field: ${field}`,
    );
  }
});

// ─── buildFiscalDtoDetail (DETAIL) ───────────────────────────────────────────

test('buildFiscalDtoDetail returns null when intent is null', () => {
  assert.equal(buildFiscalDtoDetail(null), null);
});

test('buildFiscalDtoDetail returns null when intent is undefined', () => {
  assert.equal(buildFiscalDtoDetail(undefined), null);
});

test('buildFiscalDtoDetail for PENDING intent: status set, clave/consecutive/acceptedAt null', () => {
  const dto = buildFiscalDtoDetail({
    status: 'PENDING',
    clave: null,
    consecutive: null,
    metadata: null,
  });
  assert.equal(dto.status, 'PENDING');
  assert.equal(dto.clave, null);
  assert.equal(dto.consecutive, null);
  assert.equal(dto.acceptedAt, null);
});

test('buildFiscalDtoDetail for ACCEPTED intent: all four fields populated', () => {
  const intent = makeIntentWithInternals();
  const dto = buildFiscalDtoDetail(intent);
  assert.equal(dto.status, 'ACCEPTED');
  assert.equal(dto.clave, '50625092600020753025100100001010000000001101924748');
  assert.equal(dto.consecutive, '00100001010000000001');
  assert.equal(dto.acceptedAt, '2025-01-15T14:30:00.000Z');
});

test('buildFiscalDtoDetail for ACCEPTED with clave=null: clave is null', () => {
  const intent = makeIntentWithInternals({ clave: null });
  const dto = buildFiscalDtoDetail(intent);
  assert.equal(dto.status, 'ACCEPTED');
  assert.equal(dto.clave, null);
  assert.equal(dto.consecutive, '00100001010000000001');
});

test('buildFiscalDtoDetail for ACCEPTED with no metadata: acceptedAt is null', () => {
  const intent = makeIntentWithInternals({ metadata: null });
  const dto = buildFiscalDtoDetail(intent);
  assert.equal(dto.status, 'ACCEPTED');
  assert.equal(dto.acceptedAt, null);
});

test('buildFiscalDtoDetail for ACCEPTED with invalid metadata date: acceptedAt is null', () => {
  const intent = makeIntentWithInternals({ metadata: { billingAcceptedAt: 'not-a-date' } });
  const dto = buildFiscalDtoDetail(intent);
  assert.equal(dto.acceptedAt, null);
});

test('buildFiscalDtoDetail for REJECTED: acceptedAt is null even if timestamp in metadata', () => {
  const intent = makeIntentWithInternals({
    status: 'REJECTED',
    metadata: { billingAcceptedAt: '2025-01-15T14:30:00.000Z', billingRejectedAt: '2025-01-15T14:35:00.000Z' },
  });
  const dto = buildFiscalDtoDetail(intent);
  assert.equal(dto.status, 'REJECTED');
  assert.equal(dto.acceptedAt, null, 'acceptedAt must be null for REJECTED status');
});

test('buildFiscalDtoDetail for ERROR_FINAL: acceptedAt is null', () => {
  const intent = makeIntentWithInternals({
    status: 'ERROR_FINAL',
    clave: null,
    metadata: { billingAcceptedAt: '2025-01-15T14:30:00.000Z' },
  });
  const dto = buildFiscalDtoDetail(intent);
  assert.equal(dto.status, 'ERROR_FINAL');
  assert.equal(dto.acceptedAt, null, 'acceptedAt must be null for ERROR_FINAL status');
});

test('buildFiscalDtoDetail for ERROR_RETRYABLE: acceptedAt is null', () => {
  const dto = buildFiscalDtoDetail({ status: 'ERROR_RETRYABLE', clave: null, consecutive: null, metadata: null });
  assert.equal(dto.acceptedAt, null);
});

test('buildFiscalDtoDetail for PROCESSING: acceptedAt is null', () => {
  const dto = buildFiscalDtoDetail({ status: 'PROCESSING', clave: null, consecutive: null, metadata: null });
  assert.equal(dto.acceptedAt, null);
});

test('buildFiscalDtoDetail excludes all internal fields', () => {
  const dto = buildFiscalDtoDetail(makeIntentWithInternals());
  assert.ok(dto, 'dto must not be null');
  for (const field of INTERNAL_FIELD_NAMES) {
    assert.equal(
      dto[field],
      undefined,
      `buildFiscalDtoDetail must not expose internal field: ${field}`,
    );
  }
});

// ─── serializeInvoiceForList ──────────────────────────────────────────────────

test('serializeInvoiceForList includes invoiceNumber from invoice.number', () => {
  const invoice = makeInvoiceStub({ number: 'INV-963' });
  const dto = serializeInvoiceForList(invoice);
  assert.equal(dto.invoiceNumber, 'INV-963', 'invoiceNumber must equal invoice.number');
  // Must NOT equal the numeric invoice id
  assert.notEqual(dto.invoiceNumber, String(invoice.id));
});

test('serializeInvoiceForList has fiscal: null when fiscalIntent is null', () => {
  const dto = serializeInvoiceForList(makeInvoiceStub({ fiscalIntent: null }));
  assert.equal(dto.fiscal, null);
});

test('serializeInvoiceForList has fiscal.status when fiscalIntent exists', () => {
  const invoice = makeInvoiceStub({ fiscalIntent: { status: 'ACCEPTED' } });
  const dto = serializeInvoiceForList(invoice);
  assert.ok(dto.fiscal, 'fiscal must not be null');
  assert.equal(dto.fiscal.status, 'ACCEPTED');
});

test('serializeInvoiceForList fiscal does not include clave or consecutive', () => {
  const intent = makeIntentWithInternals();
  const dto = serializeInvoiceForList(makeInvoiceStub({ fiscalIntent: intent }));
  assert.ok(dto.fiscal);
  assert.equal(dto.fiscal.clave, undefined, 'list fiscal must not include clave');
  assert.equal(dto.fiscal.consecutive, undefined, 'list fiscal must not include consecutive');
  assert.equal(dto.fiscal.acceptedAt, undefined, 'list fiscal must not include acceptedAt');
});

test('serializeInvoiceForList excludes all internal FiscalIntent fields', () => {
  const invoice = makeInvoiceStub({ fiscalIntent: makeIntentWithInternals() });
  const dto = serializeInvoiceForList(invoice);
  for (const field of INTERNAL_FIELD_NAMES) {
    assert.equal(dto[field], undefined, `serializeInvoiceForList must not expose: ${field}`);
    if (dto.fiscal) {
      assert.equal(dto.fiscal[field], undefined, `fiscal sub-object must not expose: ${field}`);
    }
  }
});

test('serializeInvoiceForList includes expected top-level fields', () => {
  const invoice = makeInvoiceStub();
  const dto = serializeInvoiceForList(invoice);
  assert.ok('id' in dto, 'id required');
  assert.ok('invoiceNumber' in dto, 'invoiceNumber required');
  assert.ok('clientId' in dto, 'clientId required');
  assert.ok('clientName' in dto, 'clientName required');
  assert.ok('orderId' in dto, 'orderId required');
  assert.ok('amount' in dto, 'amount required');
  assert.ok('pendingAmount' in dto, 'pendingAmount required');
  assert.ok('status' in dto, 'status required');
  assert.ok('issuedAt' in dto, 'issuedAt required');
  assert.ok('dueAt' in dto, 'dueAt required');
  assert.ok('fiscal' in dto, 'fiscal required');
});

test('serializeInvoiceForList pendingAmount is 0 for invoice with no approved payments', () => {
  const invoice = makeInvoiceStub({ amount: 5000, payments: [] });
  const dto = serializeInvoiceForList(invoice);
  assert.equal(dto.pendingAmount, 5000);
});

test('serializeInvoiceForList clientName extracted from client relation', () => {
  const invoice = makeInvoiceStub({ client: { id: 42n, name: 'Distribuidora El Sol S.A.' } });
  const dto = serializeInvoiceForList(invoice);
  assert.equal(dto.clientName, 'Distribuidora El Sol S.A.');
});

// ─── serializeInvoiceForDetail ────────────────────────────────────────────────

test('serializeInvoiceForDetail has fiscal: null when no fiscalIntent', () => {
  const dto = serializeInvoiceForDetail(makeInvoiceStub({ fiscalIntent: null }));
  assert.equal(dto.fiscal, null);
});

test('serializeInvoiceForDetail ACCEPTED intent: status, clave, consecutive, acceptedAt present', () => {
  const invoice = makeInvoiceStub({ fiscalIntent: makeIntentWithInternals() });
  const dto = serializeInvoiceForDetail(invoice);
  assert.ok(dto.fiscal, 'fiscal must not be null');
  assert.equal(dto.fiscal.status, 'ACCEPTED');
  assert.equal(dto.fiscal.clave, '50625092600020753025100100001010000000001101924748');
  assert.equal(dto.fiscal.consecutive, '00100001010000000001');
  assert.equal(dto.fiscal.acceptedAt, '2025-01-15T14:30:00.000Z');
});

test('serializeInvoiceForDetail REJECTED intent: acceptedAt is null', () => {
  const intent = makeIntentWithInternals({
    status: 'REJECTED',
    metadata: { billingAcceptedAt: '2025-01-15T14:30:00.000Z' },
  });
  const dto = serializeInvoiceForDetail(makeInvoiceStub({ fiscalIntent: intent }));
  assert.equal(dto.fiscal.status, 'REJECTED');
  assert.equal(dto.fiscal.acceptedAt, null);
});

test('serializeInvoiceForDetail excludes all internal FiscalIntent fields', () => {
  const invoice = makeInvoiceStub({ fiscalIntent: makeIntentWithInternals() });
  const dto = serializeInvoiceForDetail(invoice);
  for (const field of INTERNAL_FIELD_NAMES) {
    assert.equal(dto[field], undefined, `serializeInvoiceForDetail must not expose: ${field}`);
    if (dto.fiscal) {
      assert.equal(dto.fiscal[field], undefined, `detail fiscal must not expose: ${field}`);
    }
  }
});

test('serializeInvoiceForDetail includes payments array', () => {
  const invoice = makeInvoiceStub({
    payments: [
      { id: 88n, paymentMethod: 'CASH', amount: 5000, status: 'APPROVED', reference: null, approvedAt: new Date(), createdAt: new Date() },
    ],
  });
  const dto = serializeInvoiceForDetail(invoice);
  assert.ok(Array.isArray(dto.payments));
  assert.equal(dto.payments.length, 1);
  assert.equal(dto.payments[0].paymentMethod, 'CASH');
  assert.equal(dto.payments[0].status, 'APPROVED');
});

test('serializeInvoiceForDetail includes structured order with clientStoreName', () => {
  const invoice = makeInvoiceStub({
    order: { id: 963n, clientStoreId: 7n, clientStore: { name: 'Tienda Centro' } },
  });
  const dto = serializeInvoiceForDetail(invoice);
  assert.ok(dto.order);
  assert.equal(dto.order.id, 963n);
  assert.equal(dto.order.clientStoreId, 7n);
  assert.equal(dto.order.clientStoreName, 'Tienda Centro');
});

test('serializeInvoiceForDetail order is null when invoice has no order', () => {
  const invoice = makeInvoiceStub({ order: null, orderId: null });
  const dto = serializeInvoiceForDetail(invoice);
  assert.equal(dto.order, null);
});

test('serializeInvoiceForDetail includes invoiceNumber (not invoice ID)', () => {
  const invoice = makeInvoiceStub({ id: 1623n, number: 'INV-963' });
  const dto = serializeInvoiceForDetail(invoice);
  assert.equal(dto.invoiceNumber, 'INV-963');
  assert.notEqual(dto.invoiceNumber, '1623');
});

test('serializeInvoiceForDetail payments are serialized (no raw Prisma fields leaked)', () => {
  // Payment-specific internal fields that should not be present
  const invoice = makeInvoiceStub({
    payments: [{
      id: 1n,
      paymentMethod: 'TRANSFER',
      amount: 500,
      status: 'APPROVED',
      reference: 'REF-001',
      approvedAt: new Date(),
      createdAt: new Date(),
      // These would be on a real Prisma payment but are not in our DTO:
      invoiceId: 1623n,
      approvedByUserId: 9n,
      reviewReason: 'internal note',
      rejectedAt: null,
      reversedAt: null,
    }],
  });
  const dto = serializeInvoiceForDetail(invoice);
  const payment = dto.payments[0];
  // Serialized fields present
  assert.equal(payment.paymentMethod, 'TRANSFER');
  assert.equal(payment.status, 'APPROVED');
  // Fields not in serializePaymentForDto should not be present
  assert.equal(payment.approvedByUserId, undefined);
  assert.equal(payment.reviewReason, undefined);
});

// ─── listInvoices integration (with stubs) ───────────────────────────────────

test('listInvoices applies serializeInvoiceForList to each invoice', async () => {
  const stubInvoice = makeInvoiceStub({
    id: 1623n,
    number: 'INV-963',
    fiscalIntent: { status: 'ACCEPTED' },
  });

  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoices: async () => [stubInvoice],
    }]],
    () => listInvoices({ companyId: '7' }),
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].invoiceNumber, 'INV-963');
  assert.ok(result[0].fiscal, 'fiscal must be present');
  assert.equal(result[0].fiscal.status, 'ACCEPTED');
  // List fiscal must not include detail-only fields
  assert.equal(result[0].fiscal.clave, undefined);
  assert.equal(result[0].fiscal.consecutive, undefined);
  assert.equal(result[0].fiscal.acceptedAt, undefined);
});

test('listInvoices has fiscal: null for invoice with no fiscalIntent', async () => {
  const stubInvoice = makeInvoiceStub({ fiscalIntent: null });

  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoices: async () => [stubInvoice],
    }]],
    () => listInvoices({ companyId: '7' }),
  );

  assert.equal(result[0].fiscal, null);
});

test('listInvoices: no internal FiscalIntent fields in any item', async () => {
  const intent = makeIntentWithInternals();
  const stubInvoice = makeInvoiceStub({ fiscalIntent: intent });

  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoices: async () => [stubInvoice],
    }]],
    () => listInvoices({ companyId: '7' }),
  );

  const item = result[0];
  for (const field of INTERNAL_FIELD_NAMES) {
    assert.equal(item[field], undefined, `list item must not expose: ${field}`);
    if (item.fiscal) {
      assert.equal(item.fiscal[field], undefined, `list fiscal must not expose: ${field}`);
    }
  }
});

// ─── getInvoice integration (with stubs) ─────────────────────────────────────

test('getInvoice applies serializeInvoiceForDetail to the found invoice', async () => {
  const intent = makeIntentWithInternals();
  const stubInvoice = makeInvoiceStub({ fiscalIntent: intent });

  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => stubInvoice,
    }]],
    () => getInvoice(1623n, { companyId: '7' }),
  );

  assert.equal(result.invoiceNumber, 'INV-963');
  assert.ok(result.fiscal, 'fiscal must not be null');
  assert.equal(result.fiscal.status, 'ACCEPTED');
  assert.equal(result.fiscal.clave, '50625092600020753025100100001010000000001101924748');
  assert.equal(result.fiscal.consecutive, '00100001010000000001');
  assert.equal(result.fiscal.acceptedAt, '2025-01-15T14:30:00.000Z');
});

test('getInvoice has fiscal: null when no fiscalIntent', async () => {
  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => makeInvoiceStub({ fiscalIntent: null }),
    }]],
    () => getInvoice(1623n, { companyId: '7' }),
  );
  assert.equal(result.fiscal, null);
});

test('getInvoice: no internal FiscalIntent fields in response', async () => {
  const intent = makeIntentWithInternals();
  const stubInvoice = makeInvoiceStub({ fiscalIntent: intent });

  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => stubInvoice,
    }]],
    () => getInvoice(1623n, { companyId: '7' }),
  );

  for (const field of INTERNAL_FIELD_NAMES) {
    assert.equal(result[field], undefined, `getInvoice response must not expose: ${field}`);
    if (result.fiscal) {
      assert.equal(result.fiscal[field], undefined, `detail fiscal must not expose: ${field}`);
    }
  }
});

// ─── Cross-company isolation ──────────────────────────────────────────────────

test('getInvoice returns 404 when repository returns null (cross-company or missing)', async () => {
  await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => getInvoice(1623n, { companyId: '9999' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('listInvoices rejects when no company scope', async () => {
  await assert.rejects(
    () => listInvoices({ companyId: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

// ─── Backward compat: existing invoice behavior ───────────────────────────────

test('listInvoices commercial status still correctly propagated', async () => {
  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoices: async () => [makeInvoiceStub({ status: 'PARTIAL' })],
    }]],
    () => listInvoices({ companyId: '7' }),
  );
  assert.equal(result[0].status, 'PARTIAL');
});

test('getInvoice commercial status still correctly propagated', async () => {
  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => makeInvoiceStub({ status: 'PAID' }),
    }]],
    () => getInvoice(1623n, { companyId: '7' }),
  );
  assert.equal(result.status, 'PAID');
});

test('getInvoice paidAt is present in detail DTO', async () => {
  const paidAt = new Date('2025-01-20T00:00:00.000Z');
  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => makeInvoiceStub({ status: 'PAID', paidAt }),
    }]],
    () => getInvoice(1623n, { companyId: '7' }),
  );
  assert.ok(result.paidAt, 'paidAt must be present in detail DTO');
  assert.deepEqual(result.paidAt, paidAt);
});
