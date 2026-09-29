/* global AbortController */
'use strict';

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * TASK-014: Maximum artifact size Inventori will accept from Billing.
 * 10 MB is a conservative safety limit for P0 fiscal PDF/XML artifacts.
 * Real fiscal PDFs are typically < 500 KB; signed XMLs < 200 KB.
 * Adjust via BILLING_ARTIFACT_MAX_BYTES if Billing documents a different limit.
 */
const DEFAULT_ARTIFACT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * TASK-014: MIME type allowlist for artifact proxy responses.
 * Derived from expected artifact types in the approved Billing contract:
 *   PDF → application/pdf
 *   SIGNED_XML / HACIENDA_RESPONSE_XML → application/xml or text/xml
 * Any other Content-Type is rejected (fail closed).
 */
const ALLOWED_ARTIFACT_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/xml',
  'text/xml',
]);

/** @param {string} rawContentType @returns {boolean} */
function isAllowedArtifactContentType(rawContentType) {
  if (!rawContentType) return false;
  const baseType = String(rawContentType).split(';')[0].trim().toLowerCase();
  return ALLOWED_ARTIFACT_CONTENT_TYPES.has(baseType);
}

class BillingClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'BillingClientError';
    this.code = options.code || 'BILLING_CLIENT_ERROR';
    this.statusCode = options.statusCode || null;
    this.retryable = Boolean(options.retryable);
    this.correlationId = options.correlationId || null;
  }
}

function sanitizeRemoteCode(rawCode) {
  if (typeof rawCode === 'string' && rawCode.trim()) return rawCode.trim().slice(0, 200);
  return null;
}

function sanitizeRemoteMessage(rawMessage) {
  if (typeof rawMessage === 'string' && rawMessage.trim()) return rawMessage.trim().slice(0, 1000);
  if (Array.isArray(rawMessage)) {
    const joined = rawMessage.filter((item) => typeof item === 'string' && item.trim()).join('; ');
    return joined ? joined.slice(0, 1000) : null;
  }
  return null;
}

function sanitizeBillingErrorBody(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  // Billing wraps errors as { error: { code, message } }; others send { code, message } directly.
  // Never pass raw objects through to BillingClientError.code/message.
  const nested = body.error && typeof body.error === 'object' ? body.error : null;
  const code = sanitizeRemoteCode(body.code) || sanitizeRemoteCode(nested?.code);
  const message = sanitizeRemoteMessage(body.message)
    || sanitizeRemoteMessage(body.errorMessage)
    || sanitizeRemoteMessage(nested?.message)
    || 'Billing request failed';
  return { code, message };
}

function redactSensitiveValue(value, sensitiveValue) {
  if (!sensitiveValue || typeof value !== 'string') return value;
  return value.split(sensitiveValue).join('[REDACTED]');
}

function redactBillingErrorBody(sanitizedBody, apiKey) {
  if (!sanitizedBody) return null;
  return {
    code: redactSensitiveValue(sanitizedBody.code, apiKey),
    message: redactSensitiveValue(sanitizedBody.message, apiKey),
  };
}

function hasOwnProperty(value, propertyName) {
  return Object.prototype.hasOwnProperty.call(value, propertyName);
}

function isString(value) {
  return typeof value === 'string';
}

function validateFiscalOnboardingActivity(activity, correlationId) {
  if (!activity || typeof activity !== 'object') {
    throw new BillingClientError('Billing returned malformed fiscal onboarding activity', {
      code: 'BILLING_MALFORMED_FISCAL_ONBOARDING_ACTIVITY',
      retryable: false,
      correlationId,
    });
  }

  const hasRequiredShape = isString(activity.id)
    && isString(activity.code)
    && isString(activity.description)
    && isString(activity.haciendaStatus)
    && typeof activity.billingEnabled === 'boolean';

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed fiscal onboarding activity', {
      code: 'BILLING_MALFORMED_FISCAL_ONBOARDING_ACTIVITY',
      retryable: false,
      correlationId,
    });
  }

  return activity;
}

function validateFiscalOnboardingActivitiesResponse(response, correlationId) {
  if (!Array.isArray(response)) {
    throw new BillingClientError('Billing returned malformed fiscal onboarding activities', {
      code: 'BILLING_MALFORMED_FISCAL_ONBOARDING_ACTIVITIES',
      retryable: false,
      correlationId,
    });
  }
  return response.map((activity) => validateFiscalOnboardingActivity(activity, correlationId));
}

function validateFiscalOnboardingStatusResponse(response, correlationId) {
  const hasRequiredShape = response
    && typeof response === 'object'
    && isString(response.companyId)
    && hasOwnProperty(response, 'defaultEconomicActivityId')
    && (response.defaultEconomicActivityId === null || isString(response.defaultEconomicActivityId));

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed fiscal onboarding status', {
      code: 'BILLING_MALFORMED_FISCAL_ONBOARDING_STATUS',
      retryable: false,
      correlationId,
    });
  }

  validateFiscalOnboardingActivitiesResponse(response.activities, correlationId);
  return response;
}

function validateFiscalOnboardingVerificationResponse(response, correlationId) {
  const hasRequiredShape = response
    && typeof response === 'object'
    && isString(response.companyId)
    && isString(response.haciendaVerificationStatus);

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed fiscal onboarding verification', {
      code: 'BILLING_MALFORMED_FISCAL_ONBOARDING_VERIFICATION',
      retryable: false,
      correlationId,
    });
  }

  validateFiscalOnboardingActivitiesResponse(response.activities, correlationId);
  return response;
}

function validateSetDefaultFiscalOnboardingActivityResponse(response, correlationId) {
  const hasRequiredShape = response
    && typeof response === 'object'
    && isString(response.companyId)
    && isString(response.defaultEconomicActivityId)
    && isString(response.code);

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed fiscal onboarding default activity response', {
      code: 'BILLING_MALFORMED_FISCAL_ONBOARDING_DEFAULT_ACTIVITY',
      retryable: false,
      correlationId,
    });
  }

  return response;
}

function validateFiscalReadinessResponse(response, correlationId) {
  const isValidDateString = (v) => typeof v === 'string' && v.trim().length > 0 && !isNaN(Date.parse(v));
  const isStringArray = (v) => Array.isArray(v) && v.every((item) => typeof item === 'string');

  const hasRequiredShape = response
    && typeof response === 'object'
    && isString(response.companyId)
    && isString(response.environment)
    && typeof response.readyToIssue === 'boolean'
    && isStringArray(response.reasonCodes)
    && isStringArray(response.warnings)
    && isValidDateString(response.checkedAt);

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed fiscal readiness response', {
      code: 'BILLING_MALFORMED_FISCAL_READINESS',
      retryable: false,
      correlationId,
    });
  }

  return response;
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: 'Billing returned a non-JSON response' };
  }
}

class BillingApiClient {
  constructor({ baseUrl, credentialResolver, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }) {
    if (!baseUrl) throw new Error('Billing baseUrl is required');
    if (!credentialResolver?.resolveApiKey) throw new Error('Billing credentialResolver is required');
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.credentialResolver = credentialResolver;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request({ method, path, secretReference, idempotencyKey = null, correlationId = null, body = null }) {
    const apiKey = this.credentialResolver.resolveApiKey(secretReference);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        ...(body == null ? {} : { body: JSON.stringify(body) }),
      });

      const parsedBody = await parseJsonSafely(response);
      if (!response.ok) {
        const sanitized = redactBillingErrorBody(sanitizeBillingErrorBody(parsedBody), apiKey);
        throw new BillingClientError(sanitized?.message || 'Billing request failed', {
          code: sanitized?.code || 'BILLING_HTTP_ERROR',
          statusCode: response.status,
          retryable: response.status >= 500 || response.status === 408 || response.status === 429,
          correlationId,
        });
      }
      return parsedBody;
    } catch (error) {
      if (error instanceof BillingClientError) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        throw new BillingClientError('Billing request timed out', {
          code: 'BILLING_TIMEOUT',
          retryable: true,
          correlationId,
        });
      }
      throw new BillingClientError('Billing request failed', {
        code: 'BILLING_UNAVAILABLE',
        retryable: true,
        correlationId,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async getFiscalOnboardingStatus({ billingCompanyId, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/status`,
      secretReference,
      correlationId,
    });
    return validateFiscalOnboardingStatusResponse(response, correlationId);
  }

  async getFiscalOnboardingActivities({ billingCompanyId, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/activities`,
      secretReference,
      correlationId,
    });
    return validateFiscalOnboardingActivitiesResponse(response, correlationId);
  }

  async verifyFiscalOnboarding({ billingCompanyId, secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/verify`,
      secretReference,
      correlationId,
    });
    return validateFiscalOnboardingVerificationResponse(response, correlationId);
  }

  async updateFiscalOnboardingActivity({ billingCompanyId, code, billingEnabled, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PATCH',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/activities/${encodeURIComponent(code)}`,
      secretReference,
      correlationId,
      body: { billingEnabled },
    });
    return validateFiscalOnboardingActivity(response, correlationId);
  }

  async setDefaultFiscalOnboardingActivity({ billingCompanyId, code, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/default-activity`,
      secretReference,
      correlationId,
      body: { code },
    });
    return validateSetDefaultFiscalOnboardingActivityResponse(response, correlationId);
  }

  async getFiscalReadiness({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/${encodeURIComponent(environment)}/readiness`,
      secretReference,
      correlationId,
    });
    return validateFiscalReadinessResponse(response, correlationId);
  }

  createFiscalDocument({ billingCompanyId, environment, secretReference, idempotencyKey, correlationId, payload }) {
    return this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/invoices`,
      secretReference,
      idempotencyKey,
      correlationId,
      body: payload,
    });
  }

  prepareFiscalDocumentXml({ billingFiscalDocumentId, secretReference, correlationId }) {
    return this.request({
      method: 'POST',
      path: `/api/v1/fiscal-documents/${encodeURIComponent(billingFiscalDocumentId)}/prepare-xml`,
      secretReference,
      correlationId,
    });
  }

  submitFiscalDocument({ billingCompanyId, environment, billingFiscalDocumentId, secretReference, correlationId }) {
    return this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/invoices/${encodeURIComponent(billingFiscalDocumentId)}/submit`,
      secretReference,
      correlationId,
    });
  }

  getFiscalDocument({ billingFiscalDocumentId, secretReference, correlationId }) {
    return this.request({
      method: 'GET',
      path: `/api/v1/fiscal-documents/${encodeURIComponent(billingFiscalDocumentId)}`,
      secretReference,
      correlationId,
    });
  }

  getFiscalSubmission({ billingCompanyId, environment, billingFiscalDocumentId, secretReference, correlationId }) {
    return this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/invoices/${encodeURIComponent(billingFiscalDocumentId)}/submission`,
      secretReference,
      correlationId,
    });
  }

  /**
   * Reads Billing's authoritative fiscal projection for an invoice document.
   *
   * Billing does not expose Inventori's legacy `/status` endpoint. The official
   * read contract is a composed READ of:
   * - GET /api/v1/fiscal-documents/{id} for document identifiers/company/env
   * - GET /api/v1/companies/{companyId}/fiscal-documents/{env}/invoices/{id}/submission
   *   for the authoritative submission/provider state.
   *
   * This method intentionally keeps the old internal name so callers do not need
   * to know Billing's transport shape. It performs READs only: no CREATE/SUBMIT.
   */
  async getFiscalStatus({ billingCompanyId, environment, billingFiscalDocumentId, secretReference, correlationId }) {
    const document = await this.getFiscalDocument({ billingFiscalDocumentId, secretReference, correlationId });
    const submission = await this.getFiscalSubmission({
      billingCompanyId,
      environment,
      billingFiscalDocumentId,
      secretReference,
      correlationId,
    });

    return {
      ...submission,
      billingFiscalDocumentId: submission?.documentId || document?.id || billingFiscalDocumentId,
      id: document?.id || submission?.documentId || billingFiscalDocumentId,
      fiscalStatus: submission?.status || document?.status || null,
      haciendaStatus: submission?.lastProviderStatus || null,
      clave: submission?.clave || document?.clave || null,
      consecutive: document?.consecutive || submission?.consecutive || null,
      companyId: document?.companyId || billingCompanyId,
      environment: document?.environment || submission?.environment || environment,
      idempotencyKey: document?.idempotencyKey || null,
      documentStatus: document?.status || null,
      submissionId: submission?.submissionId || null,
      responseSha256: submission?.responseSha256 || null,
      responseContentType: submission?.responseContentType || null,
      responseReceivedAt: submission?.responseReceivedAt || null,
    };
  }

  async listArtifacts({ billingCompanyId, environment, billingFiscalDocumentId, secretReference, correlationId = null }) {
    const artifactBasePath = `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/invoices/${encodeURIComponent(billingFiscalDocumentId)}/artifacts`;
    const response = await this.request({
      method: 'GET',
      path: artifactBasePath,
      secretReference,
      correlationId,
    });
    if (!Array.isArray(response)) {
      throw new BillingClientError('Billing returned malformed artifact metadata', {
        code: 'BILLING_MALFORMED_ARTIFACT_METADATA',
        retryable: false,
        correlationId,
      });
    }
    return response.map((artifact) => ({
      id: typeof artifact?.id === 'string' ? artifact.id : null,
      type: typeof artifact?.type === 'string' ? artifact.type : null,
      contentType: typeof artifact?.contentType === 'string' ? artifact.contentType : null,
      sha256: typeof artifact?.sha256 === 'string' ? artifact.sha256 : null,
      sizeBytes: Number.isFinite(Number(artifact?.sizeBytes)) ? Number(artifact.sizeBytes) : null,
      createdAt: typeof artifact?.createdAt === 'string' ? artifact.createdAt : null,
    })).filter((artifact) => artifact.id && artifact.type);
  }

  /**
   * TASK-014: Retrieve a binary/XML artifact from Billing.
   *
   * Billing artifact endpoint:
   *   GET /api/v1/companies/{billingCompanyId}/fiscal-documents/{environment}/invoices/{billingFiscalDocumentId}/artifacts
   *   GET /api/v1/companies/{billingCompanyId}/fiscal-documents/{environment}/invoices/{billingFiscalDocumentId}/artifacts/{artifactId}/download
   *
   * Artifact types defined by Billing contract:
   *   PDF                  → application/pdf
   *   SIGNED_XML           → application/xml
   *   HACIENDA_RESPONSE_XML → application/xml
   *
   * INVARIANTS:
   * - API key used ONLY in X-API-Key outbound header; never returned or logged.
   * - Response content type validated against allowlist before reading body.
   * - Declared Content-Length > maxBytes aborts before reading body.
   * - Actual bytes > maxBytes aborts after reading.
   * - Unexpected MIME type → BILLING_UNEXPECTED_CONTENT_TYPE (non-retryable).
   * - Oversized artifact → BILLING_ARTIFACT_TOO_LARGE (non-retryable).
   * - Does NOT mutate InvoiceFiscalIntent in any way.
   *
   * @returns {Promise<{ contentType: string, bytes: Buffer }>}
   */
  async getArtifact({
    billingCompanyId,
    environment,
    billingFiscalDocumentId,
    artifactType,
    secretReference,
    correlationId = null,
    maxBytes = DEFAULT_ARTIFACT_MAX_BYTES,
  }) {
    const apiKey = this.credentialResolver.resolveApiKey(secretReference);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const artifactBasePath = `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/invoices/${encodeURIComponent(billingFiscalDocumentId)}/artifacts`;

    try {
      const artifacts = await this.listArtifacts({
        billingCompanyId,
        environment,
        billingFiscalDocumentId,
        secretReference,
        correlationId,
      });
      const artifact = artifacts.find((item) => item && item.type === artifactType);
      if (!artifact?.id) {
        throw new BillingClientError('Billing artifact not found', {
          code: 'BILLING_HTTP_ERROR',
          statusCode: 404,
          retryable: false,
          correlationId,
        });
      }

      const response = await this.fetchImpl(`${this.baseUrl}${artifactBasePath}/${encodeURIComponent(artifact.id)}/download`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-API-Key': apiKey,
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
      });

      if (!response.ok) {
        // Read and discard error body safely; never log API key
        const errText = await response.text().catch(() => '');
        let errBody = null;
        try { errBody = JSON.parse(errText); } catch (_) { /* non-JSON error */ }
        const sanitized = redactBillingErrorBody(sanitizeBillingErrorBody(errBody), apiKey);
        throw new BillingClientError(sanitized?.message || 'Billing artifact request failed', {
          code: sanitized?.code || 'BILLING_HTTP_ERROR',
          statusCode: response.status,
          retryable: response.status >= 500 || response.status === 408 || response.status === 429,
          correlationId,
        });
      }

      // Validate Content-Type BEFORE reading the body
      const rawContentType = response.headers.get('content-type') || '';
      if (!isAllowedArtifactContentType(rawContentType)) {
        // Discard body to avoid resource leak
        await response.arrayBuffer().catch(() => {});
        throw new BillingClientError(
          `Unexpected Billing artifact content-type: ${String(rawContentType).slice(0, 100)}`,
          { code: 'BILLING_UNEXPECTED_CONTENT_TYPE', statusCode: response.status, retryable: false, correlationId },
        );
      }

      // Guard against oversized artifact via declared Content-Length
      const contentLengthStr = response.headers.get('content-length');
      const declaredLength = contentLengthStr ? parseInt(contentLengthStr, 10) : null;
      if (declaredLength !== null && !Number.isNaN(declaredLength) && declaredLength > maxBytes) {
        await response.arrayBuffer().catch(() => {});
        throw new BillingClientError(
          `Billing artifact exceeds maximum allowed size (declared ${declaredLength} > ${maxBytes})`,
          { code: 'BILLING_ARTIFACT_TOO_LARGE', retryable: false, correlationId },
        );
      }

      // Read body as buffer; enforce size limit on actual bytes
      const buffer = await response.arrayBuffer();
      const bytes = Buffer.from(buffer);
      if (bytes.length > maxBytes) {
        throw new BillingClientError(
          `Billing artifact exceeds maximum allowed size (actual ${bytes.length} > ${maxBytes})`,
          { code: 'BILLING_ARTIFACT_TOO_LARGE', retryable: false, correlationId },
        );
      }

      // Return clean base content type (strip charset/boundary params)
      const contentType = rawContentType.split(';')[0].trim().toLowerCase();
      return { contentType, bytes };
    } catch (error) {
      if (error instanceof BillingClientError) throw error;
      if (error?.name === 'AbortError') {
        throw new BillingClientError('Billing artifact request timed out', {
          code: 'BILLING_TIMEOUT',
          retryable: true,
          correlationId,
        });
      }
      throw new BillingClientError('Billing artifact request failed', {
        code: 'BILLING_UNAVAILABLE',
        retryable: true,
        correlationId,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = {
  BillingApiClient,
  BillingClientError,
  ALLOWED_ARTIFACT_CONTENT_TYPES,
  DEFAULT_ARTIFACT_MAX_BYTES,
  isAllowedArtifactContentType,
  sanitizeBillingErrorBody,
};
