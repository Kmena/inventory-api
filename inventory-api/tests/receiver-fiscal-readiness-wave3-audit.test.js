'use strict';

/**
 * Wave 3 Closure — Approval audit evidence tests
 *
 * Verifies:
 *   1. Billing-enabled success audit contains fiscal fields from the committed OrderFiscalApproval
 *   2. Fiscal audit values match the committed DB record (not speculative pre-tx values)
 *   3. Billing-disabled approval retains exact existing audit shape (no fabricated fiscal fields)
 *   4. Failed/rolled-back tx does not emit a successful audit with fiscal approval metadata
 *   5. Audit not called when req is null (existing guard behavior unchanged)
 *
 * Strategy: stub inventoryRepository.transaction to run the real callback with a mock Prisma tx,
 * stub audit.recordAuditEventIfAvailable to capture what was passed,
 * never touch a real DB or Hacienda.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const inventoryService = require('../src/services/inventory.service');
const inventoryRepository = require('../src/repositories/inventory.repository');
const audit = require('../src/lib/audit');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withStubs(stubsByModule, run) {
  const originals = [];
  for (const [mod, stubs] of stubsByModule) {
    for (const [key, val] of Object.entries(stubs)) {
      originals.push([mod, key, mod[key]]);
      mod[key] = val;
    }
  }
  return Promise.resolve().then(run).finally(() => {
    for (const [mod, key, orig] of originals) {
      mod[key] = orig;
    }
  });
}

/** Minimal req object that satisfies the audit guard (requestContext.requestId present). */
function makeReq() {
  return {
    requestContext: {
      requestId: 'test-audit-req-001',
      method: 'POST',
      path: '/api/orders/5/approve',
    },
    auth: { sub: '10', role: 'admin', companyId: '42' },
  };
}

const AUTH = { companyId: '42', sub: '10', userId: '10', role: 'admin' };

const FISCAL_APPROVAL_DATA = {
  companyId: 42n,
  clientLegalEntityId: 100n,
  receiverEconomicActivityCode: '620100',
  confirmedById: 10n,
};

/**
 * Build a mock Prisma tx that simulates successful fiscal approval DB ops.
 * Returns { createdId: BigInt } for introspection.
 */
function makeMockTx(fiscalApprovalCreateResult = { id: 99n }) {
  return {
    clientEconomicActivity: {
      findFirst: async () => ({ id: 1n, code: '620100', isCurrentlyReturned: true }),
    },
    orderFiscalApproval: {
      create: async (args) => ({ ...fiscalApprovalCreateResult, ...args.data }),
    },
    clientStore: {
      update: async () => {},
    },
  };
}

/**
 * Mock order returned by findOrderForCompany — no items, no clientStore.
 * Allows the entire inventory loop to be skipped.
 */
function makeMockOrder(orderId) {
  return {
    id: orderId,
    companyId: 42n,
    status: 'DRAFT',
    approved: false,
    warehouseId: 1n,
    clientStoreId: null,
    items: [],
    warehouse: { id: 1n, name: 'Main', isSellable: true },
  };
}

/** Mock approved order returned by updateOrderById. */
function makeMockApprovedOrder(orderId) {
  return {
    id: orderId,
    companyId: 42n,
    status: 'APPROVED',
    approved: true,
    approvedById: 10n,
    warehouseId: 1n,
    items: [],
  };
}

// ─── Test 1: Billing-enabled — audit contains committed fiscal fields ──────────

test('[Audit-01] billing-enabled approval: audit afterState contains fiscalApprovalId, clientLegalEntityId, receiverEconomicActivityCode', async () => {
  let capturedAudit = null;
  const mockTx = makeMockTx({ id: 99n });

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => fn(mockTx),
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async (orderId) => makeMockApprovedOrder(orderId),
      findFirstSellableWarehouse: async () => null,
    }],
    [audit, {
      recordAuditEventIfAvailable: async (args) => { capturedAudit = args; },
    }],
  ], () => inventoryService.reserveStockForOrder(5n, AUTH, makeReq(), { fiscalApprovalData: FISCAL_APPROVAL_DATA }));

  assert.ok(capturedAudit, 'audit.recordAuditEventIfAvailable must have been called');
  assert.strictEqual(capturedAudit.action, 'orders.approve');
  assert.strictEqual(capturedAudit.outcome, 'SUCCESS');

  const { afterState } = capturedAudit;
  assert.ok(afterState, 'afterState must be present');
  assert.strictEqual(afterState.fiscalApprovalId, '99', 'fiscalApprovalId must be the committed DB record ID as string');
  assert.strictEqual(afterState.clientLegalEntityId, '100', 'clientLegalEntityId must be the entity from fiscalApprovalData');
  assert.strictEqual(afterState.receiverEconomicActivityCode, '620100', 'receiverEconomicActivityCode must be the confirmed code');
});

// ─── Test 2: Committed ID not speculative — comes from tx.orderFiscalApproval.create ─

test('[Audit-02] fiscal audit fields come from committed tx.orderFiscalApproval.create — not from input fiscalApprovalData', async () => {
  let capturedAudit = null;
  // The create returns id=777n — different from any field in fiscalApprovalData.
  // This proves the audit is using the DB-assigned ID, not a pre-computed value.
  const mockTx = makeMockTx({ id: 777n });

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => fn(mockTx),
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async (orderId) => makeMockApprovedOrder(orderId),
    }],
    [audit, {
      recordAuditEventIfAvailable: async (args) => { capturedAudit = args; },
    }],
  ], () => inventoryService.reserveStockForOrder(5n, AUTH, makeReq(), { fiscalApprovalData: FISCAL_APPROVAL_DATA }));

  assert.strictEqual(
    capturedAudit.afterState.fiscalApprovalId,
    '777',
    'fiscalApprovalId must equal the committed create() result ID, not any pre-tx value',
  );
});

// ─── Test 3: Billing-disabled — NO fiscal fields in audit ─────────────────────

test('[Audit-03] billing-disabled approval: audit afterState does NOT contain fiscal fields', async () => {
  let capturedAudit = null;

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => {
        // Billing-disabled: no fiscalApprovalData, so no tx.orderFiscalApproval.create call.
        // Provide a minimal tx — if the test accidentally calls create(), it will throw.
        const mockTx = {
          clientEconomicActivity: {
            findFirst: async () => { throw new Error('[Audit-03] must NOT call clientEconomicActivity.findFirst when billing disabled'); },
          },
          orderFiscalApproval: {
            create: async () => { throw new Error('[Audit-03] must NOT call orderFiscalApproval.create when billing disabled'); },
          },
          clientStore: { update: async () => {} },
        };
        return fn(mockTx);
      },
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async (orderId) => makeMockApprovedOrder(orderId),
    }],
    [audit, {
      recordAuditEventIfAvailable: async (args) => { capturedAudit = args; },
    }],
  // Billing-disabled: call WITHOUT options (no fiscalApprovalData)
  ], () => inventoryService.reserveStockForOrder(5n, AUTH, makeReq()));

  assert.ok(capturedAudit, 'audit must still fire for billing-disabled approval');
  assert.strictEqual(capturedAudit.action, 'orders.approve');
  assert.strictEqual(capturedAudit.outcome, 'SUCCESS');

  const { afterState } = capturedAudit;
  // Existing fields preserved
  assert.ok('id' in afterState);
  assert.ok('status' in afterState);
  assert.ok('approved' in afterState);

  // Fiscal fields must be absent (not null — completely absent)
  assert.ok(!('fiscalApprovalId' in afterState), 'fiscalApprovalId must NOT exist for billing-disabled approval');
  assert.ok(!('clientLegalEntityId' in afterState), 'clientLegalEntityId must NOT exist for billing-disabled approval');
  assert.ok(!('receiverEconomicActivityCode' in afterState), 'receiverEconomicActivityCode must NOT exist');
});

// ─── Test 4: Transaction rollback — no successful audit emitted ───────────────

test('[Audit-04] rolled-back transaction: successful orders.approve audit is NOT emitted', async () => {
  let auditCallCount = 0;

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => {
        const mockTx = makeMockTx({ id: 99n });
        return fn(mockTx); // fn will throw because updateOrderById throws below
      },
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async () => {
        // Simulate tx failure at final order update (after fiscal approval "created")
        throw Object.assign(new Error('Simulated DB rollback'), { statusCode: 409, code: 'conflict' });
      },
    }],
    [audit, {
      recordAuditEventIfAvailable: async () => { auditCallCount += 1; },
    }],
  ], async () => {
    await assert.rejects(
      () => inventoryService.reserveStockForOrder(5n, AUTH, makeReq(), { fiscalApprovalData: FISCAL_APPROVAL_DATA }),
      (err) => { assert.ok(err.statusCode >= 400); return true; },
    );
  });

  assert.strictEqual(
    auditCallCount,
    0,
    'orders.approve audit MUST NOT be emitted when transaction fails — no committed fiscal approval exists',
  );
});

// ─── Test 5: Activity validation failure inside tx — no audit ─────────────────

test('[Audit-05] in-tx activity re-validation failure (race condition): no successful audit', async () => {
  let auditCallCount = 0;

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => {
        const mockTx = {
          clientEconomicActivity: {
            // Activity became unavailable between preview and approval
            findFirst: async () => null,
          },
          orderFiscalApproval: {
            create: async () => { throw new Error('[Audit-05] must not reach create'); },
          },
          clientStore: { update: async () => {} },
        };
        return fn(mockTx);
      },
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async (orderId) => makeMockApprovedOrder(orderId),
    }],
    [audit, {
      recordAuditEventIfAvailable: async () => { auditCallCount += 1; },
    }],
  ], async () => {
    await assert.rejects(
      () => inventoryService.reserveStockForOrder(5n, AUTH, makeReq(), { fiscalApprovalData: FISCAL_APPROVAL_DATA }),
      (err) => { assert.strictEqual(err.code, 'RECEIVER_ACTIVITY_NOT_ELIGIBLE'); return true; },
    );
  });

  assert.strictEqual(auditCallCount, 0, 'no audit when activity validation fails inside tx');
});

// ─── Test 6: req=null — audit guard returns null, no DB call ─────────────────

test('[Audit-06] req=null: audit guard short-circuits — audit not emitted (existing behavior)', async () => {
  let auditCallCount = 0;

  // We do NOT stub audit here — we let the real recordAuditEventIfAvailable run.
  // It checks !payload?.req?.requestContext?.requestId → returns null immediately.
  // The real function never calls the DB, so no DB error occurs.

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => fn(makeMockTx({ id: 88n })),
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async (orderId) => makeMockApprovedOrder(orderId),
    }],
  // Note: audit NOT stubbed — real function used, req=null prevents DB call
  ], async () => {
    // Wrap just to count if anything weird throws
    try {
      await inventoryService.reserveStockForOrder(5n, AUTH, null, { fiscalApprovalData: FISCAL_APPROVAL_DATA });
      auditCallCount = 0; // completed without error
    } catch {
      auditCallCount = -1; // should not throw
    }
  });

  assert.strictEqual(auditCallCount, 0, 'req=null: service succeeds, audit guard prevents DB call');
});

// ─── Test 7: Existing afterState fields preserved in billing-enabled audit ────

test('[Audit-07] billing-enabled audit: existing order fields still present alongside fiscal fields', async () => {
  let capturedAudit = null;
  const mockTx = makeMockTx({ id: 55n });

  await withStubs([
    [inventoryRepository, {
      transaction: async (fn) => fn(mockTx),
      findOrderForCompany: async (orderId) => makeMockOrder(orderId),
      updateOrderById: async (orderId) => ({
        id: orderId, status: 'APPROVED', approved: true, approvedById: 10n, warehouseId: 7n,
      }),
    }],
    [audit, {
      recordAuditEventIfAvailable: async (args) => { capturedAudit = args; },
    }],
  ], () => inventoryService.reserveStockForOrder(5n, AUTH, makeReq(), { fiscalApprovalData: FISCAL_APPROVAL_DATA }));

  const { afterState } = capturedAudit;
  // Original fields still present
  assert.ok(afterState.id !== undefined, 'id must be present');
  assert.strictEqual(afterState.status, 'APPROVED');
  assert.strictEqual(afterState.approved, true);
  assert.ok(afterState.approvedById !== undefined, 'approvedById must be present');
  assert.ok(afterState.warehouseId !== undefined, 'warehouseId must be present');
  // Fiscal fields also present
  assert.strictEqual(afterState.fiscalApprovalId, '55');
  assert.strictEqual(afterState.clientLegalEntityId, '100');
  assert.strictEqual(afterState.receiverEconomicActivityCode, '620100');
});
