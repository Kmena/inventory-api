'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Mock setup ────────────────────────────────────────────────────────────
// We override the repository module and audit module in require.cache before loading the service.

const feedbackRepositoryPath = require.resolve('../src/repositories/feedback.repository');
const auditPath = require.resolve('../src/lib/audit');

let auditCalls = [];
const mockAudit = {
  recordAuditEventSafelyIfAvailable: async (payload) => { auditCalls.push(payload); },
};
require.cache[auditPath] = { exports: mockAudit, id: auditPath, filename: auditPath, loaded: true };

let capturedCreateArgs = null;
let capturedFindAllArgs = null;
let capturedFindByIdReturn = null;
let capturedResolveArgs = null;
let resolveCalled = false;

const mockRepository = {
  createFeedback: async (data) => {
    capturedCreateArgs = data;
    return { id: 1, ...data, createdAt: new Date() };
  },
  findAllFeedback: async (filter) => {
    capturedFindAllArgs = filter;
    return [];
  },
  findFeedbackById: async (id) => {
    void id;
    return capturedFindByIdReturn;
  },
  resolveFeedback: async (id) => {
    capturedResolveArgs = id;
    resolveCalled = true;
    return { id, resolved: true, resolvedAt: new Date() };
  },
};

require.cache[feedbackRepositoryPath] = { exports: mockRepository, id: feedbackRepositoryPath };

const feedbackService = require('../src/services/feedback.service');

function resetCaptures() {
  capturedCreateArgs = null;
  capturedFindAllArgs = null;
  capturedFindByIdReturn = null;
  capturedResolveArgs = null;
  resolveCalled = false;
  auditCalls = [];
}

// ── Tests ─────────────────────────────────────────────────────────────────

test('submitFeedback stores username as userEmail and fullName as userName', async () => {
  resetCaptures();
  const req = {
    browserSessionUser: {
      username: 'john',
      fullName: 'John Doe',
      companyId: '5',
    },
  };
  const payload = { rating: 4, category: 'bug', comment: 'test comment', context: 'rfq' };
  await feedbackService.submitFeedback(payload, req);

  assert.equal(capturedCreateArgs.userEmail, 'john');
  assert.equal(capturedCreateArgs.userName, 'John Doe');
  assert.equal(capturedCreateArgs.companyId, 5, 'companyId should be integer 5');
  assert.equal(typeof capturedCreateArgs.companyId, 'number');
});

test('submitFeedback handles null browserSessionUser gracefully', async () => {
  resetCaptures();
  const req = { browserSessionUser: null };
  const payload = { rating: 3, category: 'sugerencia', comment: 'hello', context: 'billing' };
  await feedbackService.submitFeedback(payload, req);

  assert.equal(capturedCreateArgs.userEmail, null);
  assert.equal(capturedCreateArgs.userName, null);
  assert.equal(capturedCreateArgs.companyId, null);
});

test('submitFeedback passes optional fields correctly', async () => {
  resetCaptures();
  const req = { browserSessionUser: { username: 'u', fullName: 'U', companyId: null } };
  const payload = {
    rating: 5,
    category: 'elogio',
    comment: 'Great!',
    improvement: 'Nothing',
    context: 'manual',
    route: '#home',
  };
  await feedbackService.submitFeedback(payload, req);

  assert.equal(capturedCreateArgs.improvement, 'Nothing');
  assert.equal(capturedCreateArgs.route, '#home');
  assert.equal(capturedCreateArgs.rating, 5);
  assert.equal(capturedCreateArgs.context, 'manual');
});

test('listFeedback with resolved=true passes boolean true to repository', async () => {
  resetCaptures();
  await feedbackService.listFeedback({ resolved: 'true' });
  assert.deepEqual(capturedFindAllArgs, { resolved: true });
});

test('listFeedback with resolved=false passes boolean false to repository', async () => {
  resetCaptures();
  await feedbackService.listFeedback({ resolved: 'false' });
  assert.deepEqual(capturedFindAllArgs, { resolved: false });
});

test('listFeedback with empty query passes empty filter object to repository', async () => {
  resetCaptures();
  await feedbackService.listFeedback({});
  assert.deepEqual(capturedFindAllArgs, {});
});

test('resolveFeedback throws 404 when feedback is not found', async () => {
  resetCaptures();
  capturedFindByIdReturn = null;
  await assert.rejects(
    async () => feedbackService.resolveFeedback(999),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, 'not_found');
      return true;
    },
  );
});

test('resolveFeedback returns existing record without calling repository when already resolved', async () => {
  resetCaptures();
  const alreadyResolved = { id: 1, resolved: true, resolvedAt: new Date() };
  capturedFindByIdReturn = alreadyResolved;

  const result = await feedbackService.resolveFeedback(1);

  assert.equal(resolveCalled, false, 'Should not call repository resolveFeedback when already resolved');
  assert.deepEqual(result, alreadyResolved);
});

test('resolveFeedback calls repository resolveFeedback when not yet resolved', async () => {
  resetCaptures();
  capturedFindByIdReturn = { id: 1, resolved: false };

  await feedbackService.resolveFeedback(1);

  assert.equal(resolveCalled, true, 'Should call repository resolveFeedback');
  assert.equal(capturedResolveArgs, 1);
});

// ── Audit trail tests (TASK-023 / APPROVAL-003) ───────────────────────────

test('submitFeedback calls audit.recordAuditEventSafelyIfAvailable with feedback.submitted action', async () => {
  resetCaptures();
  const payload = { rating: 4, category: 'elogio', comment: 'Muy bueno', context: 'billing' };
  const req = {
    browserSessionUser: { username: 'user@test', fullName: 'Test User', companyId: '1' },
    requestContext: { requestId: 'req-audit-test-1' },
  };
  await feedbackService.submitFeedback(payload, req);

  assert.equal(auditCalls.length, 1, 'audit should be called once');
  assert.equal(auditCalls[0].action, 'feedback.submitted');
  assert.equal(auditCalls[0].resourceType, 'feedback');
  assert.equal(auditCalls[0].outcome, 'success');
  assert.equal(auditCalls[0].metadata.category, 'elogio');
  assert.equal(auditCalls[0].metadata.context, 'billing');
});

test('resolveFeedback calls audit.recordAuditEventSafelyIfAvailable with feedback.resolved action', async () => {
  resetCaptures();
  capturedFindByIdReturn = { id: 1, resolved: false };
  const req = {
    auth: { username: 'root' },
    requestContext: { requestId: 'req-audit-test-2' },
  };

  await feedbackService.resolveFeedback(1, req);

  assert.equal(auditCalls.length, 1, 'audit should be called once for resolve');
  assert.equal(auditCalls[0].action, 'feedback.resolved');
  assert.equal(auditCalls[0].resourceType, 'feedback');
  assert.equal(auditCalls[0].outcome, 'success');
  assert.equal(auditCalls[0].metadata.resolvedByUsername, 'root');
});

test('submitFeedback completes successfully even if audit mock throws', async () => {
  resetCaptures();
  const originalFn = mockAudit.recordAuditEventSafelyIfAvailable;
  mockAudit.recordAuditEventSafelyIfAvailable = async () => { throw new Error('audit down'); };

  const payload = { rating: 3, category: 'bug', comment: 'x', context: 'rfq' };
  const req = { browserSessionUser: null, requestContext: { requestId: 'req-resilience-1' } };

  let result;
  try {
    result = await feedbackService.submitFeedback(payload, req);
  } finally {
    mockAudit.recordAuditEventSafelyIfAvailable = originalFn;
  }

  assert.ok(result, 'submitFeedback should return a result even when audit throws');
  assert.equal(result.id, 1);
});
