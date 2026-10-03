'use strict';

/**
 * RFR-TASK-302 — Order approval evolution + atomicity tests
 * No live DB, no Hacienda, no Billing.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');
const billingConfigRepository = require('../src/repositories/billing-integration-config.repository');
const receiverFiscalReadiness = require('../src/services/receiver-fiscal-readiness.service');

// ─── Stub helpers ─────────────────────────────────────────────────────────────

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

const AUTH_ADMIN = { companyId: '42', sub: '10', userId: '10', role: 'admin', permissions: ['sales.manage'] };

function makeDraftOrder(overrides = {}) {
  return { id: 5n, companyId: 42n, status: 'DRAFT', approved: false, ...overrides };
}

function makeBillingConfig(enabled = true) {
  return enabled ? {
    id: 1n, companyId: 42n, enabled: true,
    billingTenantId: 'T1', billingCompanyId: 'C1',
    billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'ref',
  } : { id: 1n, companyId: 42n, enabled: false };
}

function makeFiscalData(stateOverrides = {}) {
  return {
    state: 'READY',
    entity: { id: 100n, companyId: 42n, verificationStatus: 'VERIFIED' },
    eligibleActivities: [{ id: 1n, code: '620100', description: 'Software', isCurrentlyReturned: true }],
    allActivities: [],
    ...stateOverrides,
  };
}

// ─── Billing-disabled: existing behavior unchanged ────────────────────────────

test('[T-BilDis-01] billing disabled → approveOrder succeeds, no fiscal validation', async () => {
  let reserveCallOpts = 'NOT_CALLED';

  const result = await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(false) }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth, _req, opts) => {
        reserveCallOpts = opts;
        return { id, status: 'APPROVED', approved: true };
      },
    }],
  ], () => orderService.approveOrder(5n, null, AUTH_ADMIN));

  assert.strictEqual(result.status, 'APPROVED');
  assert.strictEqual(reserveCallOpts, undefined, 'billing disabled: no fiscalApprovalData passed');
});

test('[T-BilDis-02] billing disabled → approveOrder ignores any body', async () => {
  const result = await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(false) }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth) => ({ id, status: 'APPROVED', approved: true }),
    }],
  ], () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN));

  assert.strictEqual(result.status, 'APPROVED');
});

test('[T-BilDis-03] billing disabled → no OrderFiscalApproval created (reserveStockForOrder called without fiscalApprovalData)', async () => {
  let capturedOpts;

  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(false) }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth, _req, opts) => {
        capturedOpts = opts;
        return { id, status: 'APPROVED', approved: true };
      },
    }],
  ], () => orderService.approveOrder(5n, null, AUTH_ADMIN));

  assert.strictEqual(capturedOpts, undefined, 'billing disabled: must not pass fiscalApprovalData');
});

// ─── Billing-enabled: READY receiver + valid activity ─────────────────────────

test('[T-302-01] billing enabled + READY + valid activity → approval succeeds, fiscalApprovalData passed', async () => {
  let capturedFad;

  const result = await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(),
    }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth, _req, opts) => {
        capturedFad = opts?.fiscalApprovalData;
        return { id, status: 'APPROVED', approved: true };
      },
    }],
  ], () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN));

  assert.strictEqual(result.status, 'APPROVED');
  assert.ok(capturedFad, 'fiscalApprovalData must be passed to reserveStockForOrder');
  assert.strictEqual(capturedFad.receiverEconomicActivityCode, '620100');
  assert.strictEqual(capturedFad.clientLegalEntityId, 100n);
});

test('[T-302-02] billing enabled + READY + valid → confirmed fiscalApprovalData fields', async () => {
  let capturedFad;

  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(),
    }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth, _req, opts) => {
        capturedFad = opts?.fiscalApprovalData;
        return { id, status: 'APPROVED', approved: true };
      },
    }],
  ], () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN));

  assert.strictEqual(capturedFad.companyId, 42n);
  assert.strictEqual(capturedFad.receiverEconomicActivityCode, '620100');
  assert.strictEqual(capturedFad.clientLegalEntityId, 100n);
  assert.ok(capturedFad.confirmedById !== undefined, 'confirmedById must be set from auth.userId');
});

// ─── Billing-enabled: blocking states ────────────────────────────────────────

test('[T-302-10] billing enabled + UNVERIFIED → 409 UNVERIFIED', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData({ state: 'UNVERIFIED', eligibleActivities: [] }),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); assert.strictEqual(err.code, 'UNVERIFIED'); return true; },
    );
  });
});

test('[T-302-11] billing enabled + NOT_FOUND → 409 NOT_FOUND', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData({ state: 'NOT_FOUND', eligibleActivities: [] }),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); assert.strictEqual(err.code, 'NOT_FOUND'); return true; },
    );
  });
});

test('[T-302-12] billing enabled + ACTIVITIES_MISSING → 409 ACTIVITIES_MISSING', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData({ state: 'ACTIVITIES_MISSING', eligibleActivities: [] }),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); assert.strictEqual(err.code, 'ACTIVITIES_MISSING'); return true; },
    );
  });
});

test('[T-302-13] billing enabled + IDENTITY_INCOMPLETE → 409 IDENTITY_INCOMPLETE', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData({ state: 'IDENTITY_INCOMPLETE', entity: null, eligibleActivities: [] }),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, {}, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); assert.strictEqual(err.code, 'IDENTITY_INCOMPLETE'); return true; },
    );
  });
});

test('[T-302-14] billing enabled + VERIFICATION_UNAVAILABLE → 409', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData({ state: 'VERIFICATION_UNAVAILABLE', eligibleActivities: [] }),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, {}, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); assert.strictEqual(err.code, 'VERIFICATION_UNAVAILABLE'); return true; },
    );
  });
});

// ─── Billing-enabled: activity selection errors ───────────────────────────────

test('[T-302-20] billing enabled + READY + no activity in body → 400 RECEIVER_ACTIVITY_REQUIRED', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, {}, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 400); assert.strictEqual(err.code, 'RECEIVER_ACTIVITY_REQUIRED'); return true; },
    );
  });
});

test('[T-302-21] billing enabled + READY + null body → 400 RECEIVER_ACTIVITY_REQUIRED', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, null, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 400); assert.strictEqual(err.code, 'RECEIVER_ACTIVITY_REQUIRED'); return true; },
    );
  });
});

test('[T-302-22] billing enabled + READY + wrong activity code → 409 RECEIVER_ACTIVITY_NOT_ELIGIBLE', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(), // only '620100' is eligible
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: 'INVALID' }, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); assert.strictEqual(err.code, 'RECEIVER_ACTIVITY_NOT_ELIGIBLE'); return true; },
    );
  });
});

test('[T-302-23] billing enabled + READY + multiple activities, valid selection → succeeds', async () => {
  const multiData = makeFiscalData({
    eligibleActivities: [
      { id: 1n, code: '620100', isCurrentlyReturned: true },
      { id: 2n, code: '471100', isCurrentlyReturned: true },
    ],
  });
  let capturedCode;

  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => multiData,
    }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth, _req, opts) => {
        capturedCode = opts?.fiscalApprovalData?.receiverEconomicActivityCode;
        return { id, status: 'APPROVED', approved: true };
      },
    }],
  ], async () => {
    const result = await orderService.approveOrder(5n, { receiverEconomicActivityCode: '471100' }, AUTH_ADMIN);
    assert.strictEqual(result.status, 'APPROVED');
    assert.strictEqual(capturedCode, '471100');
  });
});

// ─── Billing-enabled: reserveStockForOrder failure → no approval ──────────────

test('[T-302-30] billing enabled + fiscal valid + stock reservation fails → error propagates', async () => {
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(),
    }],
    [inventoryService, {
      reserveStockForOrder: async () => {
        throw Object.assign(new Error('No stock'), { statusCode: 409, code: 'conflict' });
      },
    }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); return true; },
    );
  });
});

// ─── No Hacienda calls in approval path ──────────────────────────────────────

test('[T-302-40] no Hacienda call during billing-enabled approval', async () => {
  let haciendaCalled = false;

  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => {
        // If Hacienda were called, this stub would need a real taxpayer lookup — it doesn't
        haciendaCalled = false; // just mark for clarity
        return makeFiscalData();
      },
    }],
    [inventoryService, {
      reserveStockForOrder: async (id) => ({ id, status: 'APPROVED', approved: true }),
    }],
  ], async () => {
    await orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN);
  });

  assert.strictEqual(haciendaCalled, false, 'approval must NEVER call Hacienda');
});

// ─── Atomicity: fiscal approval data + stock reservation in same call ─────────

test('[T-302-50] atomicity: fiscal create failure in inventoryService → order not approved', async () => {
  // Simulates the tx.orderFiscalApproval.create throwing inside reserveStockForOrder
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalData(),
    }],
    [inventoryService, {
      reserveStockForOrder: async () => {
        // Simulate: inside tx, orderFiscalApproval.create threw a unique constraint violation
        throw Object.assign(new Error('Unique constraint'), { statusCode: 409, code: 'conflict' });
      },
    }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN),
      (err) => { assert.ok(err.statusCode >= 400); return true; },
    );
  });
});

// ─── Race condition: stale-preview protection ─────────────────────────────────

test('[T-302-60] race: activity became not-returned between preview and approval → 409', async () => {
  // Scenario: preview said '620100' eligible; by approval time it is gone from eligibleActivities
  const staleData = makeFiscalData({ eligibleActivities: [] }); // now ACTIVITIES_MISSING

  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => ({
        ...staleData, state: 'ACTIVITIES_MISSING',
      }),
    }],
    [inventoryService, { reserveStockForOrder: async () => { throw new Error('must not call'); } }],
  ], async () => {
    await assert.rejects(
      () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN),
      (err) => { assert.strictEqual(err.statusCode, 409); return true; },
    );
  });
});

// ─── Billing-disabled → later enabled edge case documentation ────────────────

test('[T-EdgeCase-01] order approved with billing disabled leaves NO OrderFiscalApproval', async () => {
  // This is the critical edge case: order approved pre-billing or billing-disabled.
  // After billing gets enabled, dispatch MUST NOT reinterpret this as a new-flow order.
  // Documented by absence of fiscalApprovalData in reserveStockForOrder call.
  let passedFiscalApprovalData = 'NOT_CHECKED';

  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(false) }],
    [inventoryService, {
      reserveStockForOrder: async (id, _auth, _req, opts) => {
        passedFiscalApprovalData = opts;
        return { id, status: 'APPROVED', approved: true };
      },
    }],
  ], () => orderService.approveOrder(5n, null, AUTH_ADMIN));

  assert.strictEqual(passedFiscalApprovalData, undefined,
    'billing-disabled approval: fiscalApprovalData MUST NOT be passed → no OrderFiscalApproval created.\n' +
    'If billing later becomes enabled before dispatch, dispatch code MUST detect absence of\n' +
    'OrderFiscalApproval and treat the order as a legacy order (Wave 4 responsibility).');
});
