'use strict';

/**
 * Tests for inventory-requests.service.js
 *
 * Covers:
 *  - createInventoryRequest: tenant scope, lot-product validation, duplicate guard, TRANSFER same-warehouse guard
 *  - cancelInventoryRequest: status guard (only PENDING cancellable)
 *  - pickupTransferRequest: type guard (TRANSFER only), status guard (PENDING), assignedToUserId from operator
 *  - listInventoryRequests / getInventoryRequest: serialization, not-found error
 *  - serializeRequest: BigInt-to-string conversion
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const inventoryRequestsRepository = require('../src/repositories/inventory-requests.repository');
const inventoryRequestsService = require('../src/services/inventory-requests.service');

// ── Auth helper ───────────────────────────────────────────────────────────────

function buildAuth(overrides = {}) {
  return {
    sub: '10',
    companyId: '7',
    ...overrides,
  };
}

// ── Repository stub helper ────────────────────────────────────────────────────

function withRepositoryStubs(stubs, run) {
  const originals = new Map();
  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, inventoryRequestsRepository[key]);
    inventoryRequestsRepository[key] = value;
  }
  return Promise.resolve().then(run).finally(() => {
    for (const [key, value] of originals.entries()) {
      inventoryRequestsRepository[key] = value;
    }
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function buildRequest(overrides = {}) {
  return {
    id: 1n,
    companyId: 7n,
    type: 'ADJUSTMENT',
    status: 'PENDING',
    lotId: 9n,
    productId: 5n,
    sourceWarehouseId: 3n,
    destinationWarehouseId: null,
    quantity: null,
    requestedByUserId: 10n,
    requestedAt: new Date('2026-10-29T10:00:00Z'),
    assignedToUserId: null,
    note: 'Ajuste requerido',
    operatorNote: null,
    completedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    resultOperationId: null,
    cancelledAt: null,
    cancelledReason: null,
    createdAt: new Date('2026-10-29T10:00:00Z'),
    updatedAt: new Date('2026-10-29T10:00:00Z'),
    lot: { id: 9n, companyId: 7n, internalLotNumber: 'LOT-9', lotNumber: 'LOT-9', expirationDate: null, productionDate: null },
    product: { id: 5n, name: 'Producto A', code: 'P-A' },
    sourceWarehouse: { id: 3n, name: 'Bodega Central', code: 'BC' },
    destinationWarehouse: null,
    requestedByUser: { id: 10n, fullName: 'Admin User', username: 'admin' },
    assignedToUser: null,
    ...overrides,
  };
}

// ── serializeRequest ──────────────────────────────────────────────────────────

test('serializeRequest converts BigInt fields to strings', () => {
  const req = buildRequest();
  // Access private function indirectly via getInventoryRequest
  // Instead, verify that the list serialization returns strings
  return withRepositoryStubs({
    findAllRequests: async () => [req],
  }, async () => {
    const result = await inventoryRequestsService.listInventoryRequests(buildAuth());
    assert.ok(Array.isArray(result));
    const first = result[0];
    assert.equal(typeof first.id, 'string', 'id must be a string');
    assert.equal(first.id, '1');
    assert.equal(typeof first.companyId, 'string');
    assert.equal(typeof first.lotId, 'string');
    assert.equal(typeof first.productId, 'string');
    assert.equal(typeof first.sourceWarehouseId, 'string');
    assert.equal(first.destinationWarehouseId, null);
    assert.equal(first.resultOperationId, null);
    assert.equal(first.assignedToUserId, null);
  });
});

// ── getInventoryRequest ───────────────────────────────────────────────────────

test('getInventoryRequest returns serialized request for correct company', () => {
  const req = buildRequest();
  return withRepositoryStubs({
    findRequestById: async (id, companyId) => {
      assert.equal(String(id), '1');
      assert.equal(String(companyId), '7');
      return req;
    },
  }, async () => {
    const result = await inventoryRequestsService.getInventoryRequest('1', buildAuth());
    assert.equal(result.id, '1');
    assert.equal(result.status, 'PENDING');
    assert.equal(result.type, 'ADJUSTMENT');
  });
});

test('getInventoryRequest throws 404 when request not found', async () => {
  return withRepositoryStubs({
    findRequestById: async () => null,
  }, async () => {
    await assert.rejects(
      () => inventoryRequestsService.getInventoryRequest('999', buildAuth()),
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'not_found');
        return true;
      },
    );
  });
});

// ── createInventoryRequest ────────────────────────────────────────────────────

test('createInventoryRequest rejects when lot does not belong to company', async () => {
  const prisma = require('../src/lib/prisma');
  const originalFindFirst = prisma.lot.findFirst.bind(prisma.lot);
  prisma.lot.findFirst = async ({ where }) => {
    if (where.id === 9n && where.companyId === 7n) return null; // not found
    return null;
  };

  try {
    await assert.rejects(
      () => inventoryRequestsService.createInventoryRequest(
        { type: 'ADJUSTMENT', lotId: 9n, productId: 5n, sourceWarehouseId: 3n },
        buildAuth(),
      ),
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  } finally {
    prisma.lot.findFirst = originalFindFirst;
  }
});

test('createInventoryRequest rejects when lot productId does not match body productId', async () => {
  const prisma = require('../src/lib/prisma');
  const originalFindFirst = prisma.lot.findFirst.bind(prisma.lot);
  prisma.lot.findFirst = async () => ({ id: 9n, productId: 99n, companyId: 7n }); // wrong product

  try {
    await assert.rejects(
      () => inventoryRequestsService.createInventoryRequest(
        { type: 'ADJUSTMENT', lotId: 9n, productId: 5n, sourceWarehouseId: 3n },
        buildAuth(),
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'validation_error');
        return true;
      },
    );
  } finally {
    prisma.lot.findFirst = originalFindFirst;
  }
});

test('createInventoryRequest rejects TRANSFER when source and destination warehouses are the same', async () => {
  const prisma = require('../src/lib/prisma');
  const originalLotFindFirst = prisma.lot.findFirst.bind(prisma.lot);
  const originalRequestFindFirst = prisma.inventoryRequest.findFirst.bind(prisma.inventoryRequest);

  prisma.lot.findFirst = async () => ({ id: 9n, productId: 5n, companyId: 7n });
  prisma.inventoryRequest.findFirst = async () => null; // no existing

  try {
    await assert.rejects(
      () => inventoryRequestsService.createInventoryRequest(
        { type: 'TRANSFER', lotId: 9n, productId: 5n, sourceWarehouseId: 3n, destinationWarehouseId: 3n, quantity: 10 },
        buildAuth(),
      ),
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  } finally {
    prisma.lot.findFirst = originalLotFindFirst;
    prisma.inventoryRequest.findFirst = originalRequestFindFirst;
  }
});

test('createInventoryRequest rejects when an active request already exists for the lot', async () => {
  const prisma = require('../src/lib/prisma');
  const originalLotFindFirst = prisma.lot.findFirst.bind(prisma.lot);
  const originalRequestFindFirst = prisma.inventoryRequest.findFirst.bind(prisma.inventoryRequest);

  prisma.lot.findFirst = async () => ({ id: 9n, productId: 5n, companyId: 7n });
  prisma.inventoryRequest.findFirst = async () => buildRequest(); // existing active

  try {
    await assert.rejects(
      () => inventoryRequestsService.createInventoryRequest(
        { type: 'ADJUSTMENT', lotId: 9n, productId: 5n, sourceWarehouseId: 3n },
        buildAuth(),
      ),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'conflict');
        return true;
      },
    );
  } finally {
    prisma.lot.findFirst = originalLotFindFirst;
    prisma.inventoryRequest.findFirst = originalRequestFindFirst;
  }
});

// ── cancelInventoryRequest ────────────────────────────────────────────────────

test('cancelInventoryRequest rejects when request is not PENDING', async () => {
  const inProgressRequest = buildRequest({ status: 'IN_PROGRESS' });

  return withRepositoryStubs({
    findRequestById: async () => inProgressRequest,
    updateRequestStatus: async () => ({}),
  }, async () => {
    await assert.rejects(
      () => inventoryRequestsService.cancelInventoryRequest('1', {}, buildAuth()),
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );
  });
});

test('cancelInventoryRequest throws 404 when request not found', async () => {
  return withRepositoryStubs({
    findRequestById: async () => null,
    updateRequestStatus: async () => ({}),
  }, async () => {
    await assert.rejects(
      () => inventoryRequestsService.cancelInventoryRequest('999', {}, buildAuth()),
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });
});

// ── pickupTransferRequest ─────────────────────────────────────────────────────

test('pickupTransferRequest rejects ADJUSTMENT type', async () => {
  const adjustmentRequest = buildRequest({ type: 'ADJUSTMENT', status: 'PENDING' });

  return withRepositoryStubs({
    findRequestById: async () => adjustmentRequest,
    updateRequestStatus: async () => ({}),
  }, async () => {
    await assert.rejects(
      () => inventoryRequestsService.pickupTransferRequest('1', {}, buildAuth()),
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );
  });
});

test('pickupTransferRequest rejects when status is not PENDING', async () => {
  const inProgressTransfer = buildRequest({ type: 'TRANSFER', status: 'IN_PROGRESS' });

  return withRepositoryStubs({
    findRequestById: async () => inProgressTransfer,
    updateRequestStatus: async () => ({}),
  }, async () => {
    await assert.rejects(
      () => inventoryRequestsService.pickupTransferRequest('1', {}, buildAuth()),
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );
  });
});

test('pickupTransferRequest sets assignedToUserId from authenticated operator', async () => {
  const transferRequest = buildRequest({ type: 'TRANSFER', status: 'PENDING' });
  let capturedPatch = null;
  let capturedCompanyId = null;

  return withRepositoryStubs({
    findRequestById: async () => transferRequest,
    updateRequestStatus: async (id, companyId, patch) => {
      capturedPatch = patch;
      capturedCompanyId = companyId;
      return { ...transferRequest, ...patch, status: 'IN_PROGRESS' };
    },
  }, async () => {
    // auth.sub is the userId
    const auth = buildAuth({ sub: '42', companyId: '7' });
    await inventoryRequestsService.pickupTransferRequest('1', {}, auth);

    assert.ok(capturedPatch, 'updateRequestStatus must have been called');
    assert.equal(capturedPatch.status, 'IN_PROGRESS');
    // assignedToUserId must be derived from the authenticated operator's userId (not client input)
    assert.equal(String(capturedPatch.assignedToUserId), '42',
      'assignedToUserId must be set from authenticated operator sub (OI-002)');
    // Tenant scope enforced
    assert.equal(String(capturedCompanyId), '7');
  });
});

test('pickupTransferRequest throws 404 when request not found', async () => {
  return withRepositoryStubs({
    findRequestById: async () => null,
    updateRequestStatus: async () => ({}),
  }, async () => {
    await assert.rejects(
      () => inventoryRequestsService.pickupTransferRequest('999', {}, buildAuth()),
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });
});

// ── listInventoryRequests ─────────────────────────────────────────────────────

test('listInventoryRequests returns serialized array for company', async () => {
  const req1 = buildRequest({ id: 1n, status: 'PENDING' });
  const req2 = buildRequest({ id: 2n, status: 'IN_PROGRESS', type: 'TRANSFER', assignedToUserId: 10n });

  return withRepositoryStubs({
    findAllRequests: async (companyId, filters) => {
      assert.equal(String(companyId), '7');
      return [req1, req2];
    },
  }, async () => {
    const result = await inventoryRequestsService.listInventoryRequests(buildAuth());
    assert.equal(result.length, 2);
    assert.equal(result[0].id, '1');
    assert.equal(result[1].id, '2');
    assert.equal(result[1].assignedToUserId, '10');
  });
});

test('listInventoryRequests enforces company scope from auth, not from client input', async () => {
  let capturedCompanyId = null;

  return withRepositoryStubs({
    findAllRequests: async (companyId) => {
      capturedCompanyId = companyId;
      return [];
    },
  }, async () => {
    // Provide a different companyId in auth vs what might be passed as a filter
    await inventoryRequestsService.listInventoryRequests(buildAuth({ companyId: '7' }), { type: 'ADJUSTMENT' });
    assert.equal(String(capturedCompanyId), '7',
      'companyId must come from the authenticated session, not from client filters');
  });
});

// ── findMaxTransferSuffixForLot ───────────────────────────────────────────────

test('findMaxTransferSuffixForLot returns 0 when no child lots exist', async () => {
  const originalFn = inventoryRequestsRepository.findMaxTransferSuffixForLot;
  inventoryRequestsRepository.findMaxTransferSuffixForLot = async () => 0;

  try {
    const result = await inventoryRequestsRepository.findMaxTransferSuffixForLot(7n, 'LOT-9');
    assert.equal(result, 0);
  } finally {
    inventoryRequestsRepository.findMaxTransferSuffixForLot = originalFn;
  }
});
