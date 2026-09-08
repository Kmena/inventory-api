const feedbackRepository = require('../repositories/feedback.repository');
const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');

async function submitFeedback(payload, req) {
  const bsu = req.browserSessionUser || {};
  const data = {
    rating:      payload.rating,
    category:    payload.category,
    comment:     payload.comment,
    improvement: payload.improvement || null,
    context:     payload.context,
    route:       payload.route || null,
    userEmail:   bsu.username || null,
    userName:    bsu.fullName || null,
    companyId:   bsu.companyId ? parseInt(String(bsu.companyId), 10) : null,
  };
  const feedback = await feedbackRepository.createFeedback(data);
  try {
    await audit.recordAuditEventSafelyIfAvailable({
      req,
      action: 'feedback.submitted',
      resourceType: 'feedback',
      resourceId: feedback.id,
      outcome: 'success',
      metadata: {
        rating: data.rating,
        category: data.category,
        context: data.context,
        userEmail: data.userEmail,
        companyId: data.companyId,
        commentTruncated: data.comment ? data.comment.slice(0, 120) : null,
        hasImprovement: Boolean(data.improvement),
      },
    });
  } catch (auditError) {
    console.warn({ code: 'feedback_audit_failed', action: 'feedback.submitted', reason: auditError?.message });
  }
  return feedback;
}

async function listFeedback(query = {}) {
  const filter = {};
  if (query.resolved === 'true')  filter.resolved = true;
  if (query.resolved === 'false') filter.resolved = false;
  return feedbackRepository.findAllFeedback(filter);
}

async function resolveFeedback(id, req) {
  const existing = await feedbackRepository.findFeedbackById(id);
  if (!existing) {
    throw createHttpError(404, 'Feedback no encontrado', 'not_found');
  }
  if (existing.resolved) {
    return existing; // idempotent — already resolved
  }
  const updated = await feedbackRepository.resolveFeedback(id);
  try {
    await audit.recordAuditEventSafelyIfAvailable({
      req,
      action: 'feedback.resolved',
      resourceType: 'feedback',
      resourceId: id,
      outcome: 'success',
      metadata: {
        resolvedByUsername: req?.auth?.username || null,
        companyId: null,
      },
    });
  } catch (auditError) {
    console.warn({ code: 'feedback_audit_failed', action: 'feedback.resolved', reason: auditError?.message });
  }
  return updated;
}

module.exports = { submitFeedback, listFeedback, resolveFeedback };
