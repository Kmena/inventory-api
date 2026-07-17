const auditRepository = require('../repositories/audit.repository');
const { createHttpError } = require('./errors');
const { getRequestAuditContext } = require('./request-context');

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_SEGMENTS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'jwt',
  'certificate',
  'cert',
  'privatekey',
  'private_key',
];

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeSensitiveKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function isSensitiveKey(key) {
  const normalizedKey = normalizeSensitiveKey(key);
  return SENSITIVE_KEY_SEGMENTS.some((segment) => normalizedKey.includes(segment));
}

function sanitizeAuditValue(value, currentKey = null) {
  if (currentKey && isSensitiveKey(currentKey)) {
    return REDACTED_VALUE;
  }

  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((result, [key, nestedValue]) => {
      result[key] = sanitizeAuditValue(nestedValue, key);
      return result;
    }, {});
  }

  return value;
}

function toNullableSanitizedValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return sanitizeAuditValue(value);
}

function truncateText(value, maxLength) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function assertRequiredAuditFields(event) {
  if (!event?.requestId) {
    throw createHttpError(500, 'No se pudo correlacionar la auditoria con el request actual', 'audit_context_missing');
  }
  if (!event?.action) {
    throw createHttpError(500, 'La accion de auditoria es obligatoria', 'audit_configuration_error');
  }
  if (!event?.resourceType) {
    throw createHttpError(500, 'El recurso de auditoria es obligatorio', 'audit_configuration_error');
  }
  if (!event?.outcome) {
    throw createHttpError(500, 'El resultado de auditoria es obligatorio', 'audit_configuration_error');
  }
}

function buildAuditEvent({
  req,
  action,
  resourceType,
  resourceId = null,
  outcome,
  reasonCode = null,
  beforeState = null,
  afterState = null,
  metadata = null,
  occurredAt = new Date(),
}) {
  const requestContext = getRequestAuditContext(req);

  const event = {
    requestId: requestContext.requestId,
    occurredAt,
    actorUserId: requestContext.actorUserId,
    actorUsername: requestContext.actorUsername,
    actorRoleCode: requestContext.actorRoleCode,
    companyId: requestContext.companyId,
    action,
    resourceType,
    resourceId: resourceId === null || resourceId === undefined ? null : resourceId.toString(),
    outcome,
    reasonCode,
    httpMethod: requestContext.httpMethod,
    routePattern: requestContext.routePattern,
    path: requestContext.path,
    ip: requestContext.ip,
    userAgent: truncateText(requestContext.userAgent, 512),
    beforeState: toNullableSanitizedValue(beforeState),
    afterState: toNullableSanitizedValue(afterState),
    metadata: toNullableSanitizedValue(metadata),
  };

  assertRequiredAuditFields(event);
  return event;
}

async function recordAuditEvent(payload, options = {}) {
  const event = buildAuditEvent(payload);
  const repository = options.repository || auditRepository;
  return repository.createAuditEvent(event, options.prismaClient);
}

async function recordAuditEventIfAvailable(payload, options = {}) {
  if (!payload?.req?.requestContext?.requestId) {
    return null;
  }

  return recordAuditEvent(payload, options);
}

async function recordAuditEventSafelyIfAvailable(payload, options = {}) {
  try {
    return await recordAuditEventIfAvailable(payload, options);
  } catch (error) {
    console.warn({
      code: 'audit_record_failed',
      action: payload?.action || 'unknown',
      reason: error?.message || 'unknown_error',
    });
    return null;
  }
}

module.exports = {
  REDACTED_VALUE,
  buildAuditEvent,
  isSensitiveKey,
  recordAuditEvent,
  recordAuditEventIfAvailable,
  recordAuditEventSafelyIfAvailable,
  sanitizeAuditValue,
};
