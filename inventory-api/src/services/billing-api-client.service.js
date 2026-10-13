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

function validateHaciendaConnectionResponse(response, correlationId) {
  const hasRequiredShape = response
    && typeof response === 'object'
    && isString(response.companyId)
    && isString(response.environment)
    && isString(response.status);

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed Hacienda connection response', {
      code: 'BILLING_MALFORMED_HACIENDA_CONNECTION',
      retryable: false,
      correlationId,
    });
  }

  return response;
}

const FISCAL_READINESS_DIMENSIONS_V1 = Object.freeze([
  'issuer',
  'profile',
  'activity',
  'hacienda',
  'certificate',
  'issuancePoint',
  'sequence',
  'operational',
]);

const FISCAL_READINESS_METADATA_KEYS_V1 = new Set([
  'companyActive', 'verificationStatus', 'configured', 'count', 'defaultActivityId',
  'status', 'lastValidatedAt', 'id', 'fingerprintSha256', 'validFrom', 'validTo',
  'environment', 'branchCode', 'terminalCode', 'branchId', 'terminalId', 'name',
  'active', 'isDefault', 'configuredTypes', 'automaticInitialization', 'database',
]);

function validateFiscalReadinessV1Response(response, correlationId, expected = {}) {
  const isValidDateString = (v) => typeof v === 'string' && v.trim().length > 0 && !isNaN(Date.parse(v));
  const isNullableDateString = (v) => v === null || isValidDateString(v);
  const isStringArray = (v) => Array.isArray(v) && v.every((item) => typeof item === 'string');
  const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const allowedDimensionStates = new Set(['READY', 'NOT_READY', 'WARNING', 'UNKNOWN']);
  const dimensions = response?.dimensions;
  const dimensionsValid = isPlainObject(dimensions)
    && FISCAL_READINESS_DIMENSIONS_V1.every((name) => isPlainObject(dimensions[name]))
    && Object.values(dimensions).every((dimension) => (
      allowedDimensionStates.has(dimension.state)
      && isStringArray(dimension.blockers)
      && isPlainObject(dimension.metadata)
      && Object.keys(dimension.metadata).every((key) => FISCAL_READINESS_METADATA_KEYS_V1.has(key))
      && (!hasOwnProperty(dimension.metadata, 'lastValidatedAt') || isNullableDateString(dimension.metadata.lastValidatedAt))
      && (!hasOwnProperty(dimension.metadata, 'validFrom') || isValidDateString(dimension.metadata.validFrom))
      && (!hasOwnProperty(dimension.metadata, 'validTo') || isValidDateString(dimension.metadata.validTo))
    ));
  const serialized = JSON.stringify(response || {});

  const hasRequiredShape = response
    && typeof response === 'object'
    && response.contractVersion === '1.0'
    && response.profileVersion === 'inventori-fiscal-v1'
    && isString(response.companyId)
    && ['SANDBOX', 'PRODUCTION'].includes(response.environment)
    && ['READY', 'NOT_READY', 'UNKNOWN'].includes(response.status)
    && typeof response.readyToIssue === 'boolean'
    && response.readyToIssue === (response.status === 'READY')
    && isStringArray(response.blockers)
    && isStringArray(response.warnings)
    && isValidDateString(response.checkedAt)
    && dimensionsValid
    && (!expected.companyId || response.companyId === expected.companyId)
    && (!expected.environment || response.environment === expected.environment)
    && !/secretReference|password|privateKey|certificateBytes|"pin"/i.test(serialized);

  if (!hasRequiredShape) {
    throw new BillingClientError('Billing returned malformed fiscal readiness response', {
      code: 'BILLING_MALFORMED_FISCAL_READINESS',
      retryable: false,
      correlationId,
    });
  }

  return response;
}

function validateFiscalTestInvoiceV1Response(response, correlationId, expected = {}) {
  const valid = response
    && typeof response === 'object'
    && response.contractVersion === '1.0'
    && response.profileVersion === 'inventori-fiscal-v1'
    && isString(response.executionId)
    && isString(response.documentId)
    && response.environment === 'SANDBOX'
    && response.mode === 'HACIENDA_SANDBOX_SUBMISSION'
    && response.disclosure?.consumesSandboxConsecutive === true
    && response.disclosure?.billingRequestAcceptedIsNotHaciendaAcceptance === true
    && response.document && isString(response.document.status)
    && Array.isArray(response.artifacts)
    && Array.isArray(response.deliveries)
    && (!expected.executionId || response.executionId === expected.executionId)
    && !/secretReference|password|privateKey|certificateBytes|"pin"|storageKey/i.test(JSON.stringify(response));
  if (!valid) {
    throw new BillingClientError('Billing returned malformed fiscal test invoice response', {
      code: 'BILLING_MALFORMED_FISCAL_TEST_INVOICE', retryable: false, correlationId,
    });
  }
  return response;
}

function validateLegacyFiscalReadinessResponse(response, correlationId) {
  const validDate = typeof response?.checkedAt === 'string' && !isNaN(Date.parse(response.checkedAt));
  const stringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (!response || !isString(response.companyId) || !isString(response.environment)
    || typeof response.readyToIssue !== 'boolean' || !stringArray(response.reasonCodes)
    || !stringArray(response.warnings) || !validDate) {
    throw new BillingClientError('Billing returned malformed fiscal readiness response', {
      code: 'BILLING_MALFORMED_FISCAL_READINESS', retryable: false, correlationId,
    });
  }
  return response;
}

function validateAssociation(response, correlationId) {
  const issuer = response?.company;
  if (!response || !isString(response.associationId) || !isString(response.externalCompanyKey)
    || response.profileVersion !== 'inventori-fiscal-v1' || !issuer || !isString(issuer.id)
    || !isString(issuer.tenantId) || !isString(issuer.legalName)
    || !isString(issuer.identificationType) || !isString(issuer.identificationNumber)) {
    throw new BillingClientError('Billing returned malformed fiscal association', {
      code: 'BILLING_MALFORMED_FISCAL_ASSOCIATION', retryable: false, correlationId,
    });
  }
  return response;
}

function validateBootstrapResponse(response, correlationId) {
  validateAssociation(response?.association, correlationId);
  const credential = response?.credential;
  if (!credential || !isString(credential.apiKeyId) || !isString(credential.keyPrefix)
    || !isString(credential.secret) || credential.profileVersion !== 'inventori-fiscal-v1'
    || credential.returnedOnce !== true || !['TEST', 'LIVE'].includes(credential.environment)) {
    throw new BillingClientError('Billing returned malformed bootstrap credential handoff', {
      code: 'BILLING_MALFORMED_BOOTSTRAP_HANDOFF', retryable: false, correlationId,
    });
  }
  return response;
}

function validateFiscalProfileV1(response, correlationId) {
  if (!response || !isString(response.id) || !isString(response.companyId)
    || !isString(response.economicActivityCode) || !isString(response.province)
    || !isString(response.canton) || !isString(response.district)
    || !isString(response.otrasSenas) || !isString(response.email)) {
    throw new BillingClientError('Billing returned malformed fiscal profile', {
      code: 'BILLING_MALFORMED_FISCAL_PROFILE', retryable: false, correlationId,
    });
  }
  return response;
}

function validateCertificateMetadata(response, correlationId) {
  const allowedStatuses = new Set(['ACTIVE', 'INACTIVE', 'REVOKED', 'EXPIRED']);
  const hasRequiredShape = response
    && typeof response === 'object'
    && isString(response.id)
    && isString(response.companyId)
    && ['SANDBOX', 'PRODUCTION'].includes(response.environment)
    && allowedStatuses.has(response.status)
    && isString(response.createdAt)
    && isString(response.updatedAt);
  const serialized = JSON.stringify(response || {});
  if (!hasRequiredShape || /certificateSecretReference|passwordSecretReference|privateKey|"pin"/i.test(serialized)) {
    throw new BillingClientError('Billing returned malformed certificate metadata', {
      code: 'BILLING_MALFORMED_CERTIFICATE_METADATA', retryable: false, correlationId,
    });
  }
  return response;
}

function malformedFiscalAdministrationResponse(message, code, correlationId) {
  throw new BillingClientError(message, {
    code,
    retryable: false,
    correlationId,
  });
}

function validateFiscalTerminal(response, correlationId) {
  const valid = response
    && typeof response === 'object'
    && isString(response.id)
    && isString(response.companyId)
    && isString(response.branchId)
    && ['SANDBOX', 'PRODUCTION'].includes(response.environment)
    && /^\d{5}$/.test(response.code)
    && isString(response.name)
    && typeof response.active === 'boolean';
  if (!valid) {
    malformedFiscalAdministrationResponse(
      'Billing returned malformed fiscal terminal',
      'BILLING_MALFORMED_FISCAL_TERMINAL',
      correlationId,
    );
  }
  return response;
}

function validateFiscalBranch(response, correlationId) {
  const valid = response
    && typeof response === 'object'
    && isString(response.id)
    && isString(response.companyId)
    && ['SANDBOX', 'PRODUCTION'].includes(response.environment)
    && /^\d{3}$/.test(response.code)
    && isString(response.name)
    && typeof response.active === 'boolean'
    && (!hasOwnProperty(response, 'terminals') || Array.isArray(response.terminals));
  if (!valid) {
    malformedFiscalAdministrationResponse(
      'Billing returned malformed fiscal branch',
      'BILLING_MALFORMED_FISCAL_BRANCH',
      correlationId,
    );
  }
  if (Array.isArray(response.terminals)) {
    response.terminals.forEach((terminal) => validateFiscalTerminal(terminal, correlationId));
  }
  return response;
}

function validateFiscalBranches(response, correlationId) {
  if (!Array.isArray(response)) {
    malformedFiscalAdministrationResponse(
      'Billing returned malformed fiscal branch list',
      'BILLING_MALFORMED_FISCAL_BRANCH_LIST',
      correlationId,
    );
  }
  return response.map((branch) => validateFiscalBranch(branch, correlationId));
}

function validateIssuancePoint(response, correlationId, { nullable = false } = {}) {
  if (nullable && response == null) return null;
  const valid = response
    && typeof response === 'object'
    && isString(response.branchId)
    && isString(response.terminalId)
    && ['SANDBOX', 'PRODUCTION'].includes(response.environment)
    && /^\d{3}$/.test(response.branchCode)
    && /^\d{5}$/.test(response.terminalCode)
    && isString(response.name)
    && typeof response.active === 'boolean'
    && typeof response.isDefault === 'boolean';
  if (!valid) {
    malformedFiscalAdministrationResponse(
      'Billing returned malformed fiscal issuance point',
      'BILLING_MALFORMED_ISSUANCE_POINT',
      correlationId,
    );
  }
  return response;
}

function validateFiscalSequence(response, correlationId) {
  const valid = response
    && typeof response === 'object'
    && ['SANDBOX', 'PRODUCTION'].includes(response.environment)
    && /^\d{3}$/.test(response.branchCode)
    && /^\d{5}$/.test(response.terminalCode)
    && ['INVOICE', 'TICKET'].includes(response.documentType)
    && /^\d+$/.test(response.nextValue)
    && (response.lastAssigned === null || /^\d+$/.test(response.lastAssigned));
  if (!valid) {
    malformedFiscalAdministrationResponse(
      'Billing returned malformed fiscal sequence',
      'BILLING_MALFORMED_FISCAL_SEQUENCE',
      correlationId,
    );
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

  async request({ method, path, secretReference, idempotencyKey = null, correlationId = null, body = null, formData = null }) {
    const apiKey = this.credentialResolver.resolveApiKey(secretReference);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          ...(formData ? {} : { 'Content-Type': 'application/json' }),
          'X-API-Key': apiKey,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        ...(formData ? { body: formData } : (body == null ? {} : { body: JSON.stringify(body) })),
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

  async getFiscalOnboardingActivities({ billingCompanyId, environment = 'SANDBOX', secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/activities`,
      secretReference,
      correlationId,
    });
    return validateFiscalOnboardingActivitiesResponse(response, correlationId);
  }

  async verifyFiscalOnboarding({ billingCompanyId, environment = 'SANDBOX', secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/activities/refresh`,
      secretReference,
      correlationId,
    });
    return validateFiscalOnboardingVerificationResponse(response, correlationId);
  }

  async updateFiscalOnboardingActivity({ billingCompanyId, environment = 'SANDBOX', code, billingEnabled, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PATCH',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/activities/${encodeURIComponent(code)}`,
      secretReference,
      correlationId,
      body: { billingEnabled },
    });
    return validateFiscalOnboardingActivity(response, correlationId);
  }

  async setDefaultFiscalOnboardingActivity({ billingCompanyId, environment = 'SANDBOX', code, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/activities/default`,
      secretReference,
      correlationId,
      body: { code },
    });
    return validateSetDefaultFiscalOnboardingActivityResponse(response, correlationId);
  }

  async configureHaciendaCredentials({ billingCompanyId, environment, username, password, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/${encodeURIComponent(environment)}/hacienda-credentials`,
      secretReference,
      correlationId,
      body: { username, password },
    });
    return validateHaciendaConnectionResponse(response, correlationId);
  }

  async validateHaciendaCredentials({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/${encodeURIComponent(environment)}/hacienda-credentials/validate`,
      secretReference,
      correlationId,
    });
    return validateHaciendaConnectionResponse(response, correlationId);
  }

  async getFiscalReadiness({ billingCompanyId, environment, secretReference, correlationId, contractVersion = null }) {
    if (contractVersion === '1.0') {
      return this.getFiscalReadinessV1({ billingCompanyId, environment, secretReference, correlationId });
    }
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/${encodeURIComponent(environment)}/readiness`,
      secretReference,
      correlationId,
    });
    return validateLegacyFiscalReadinessResponse(response, correlationId);
  }

  async getFiscalReadinessV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/readiness`,
      secretReference,
      correlationId,
    });
    return validateFiscalReadinessV1Response(response, correlationId, {
      companyId: billingCompanyId,
      environment,
    });
  }

  async initiateFiscalTestInvoiceV1({ billingCompanyId, environment, secretReference, correlationId, idempotencyKey, payload }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/test-invoices`,
      secretReference,
      correlationId,
      idempotencyKey,
      body: payload,
    });
    return validateFiscalTestInvoiceV1Response(response, correlationId);
  }

  async getFiscalTestInvoiceV1({ billingCompanyId, environment, secretReference, correlationId, executionId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/test-invoices/${encodeURIComponent(executionId)}`,
      secretReference,
      correlationId,
    });
    return validateFiscalTestInvoiceV1Response(response, correlationId, { executionId });
  }

  async bootstrapFiscalIssuer({ secretReference, correlationId, payload }) {
    const response = await this.request({
      method: 'POST',
      path: '/api/v1/fiscal-onboarding/v1/bootstrap',
      secretReference,
      correlationId,
      body: payload,
    });
    return validateBootstrapResponse(response, correlationId);
  }

  async getFiscalIssuerV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/issuer`,
      secretReference,
      correlationId,
    });
    return validateAssociation(response, correlationId);
  }

  async updateFiscalIssuerV1({ billingCompanyId, environment, secretReference, correlationId, payload }) {
    return this.request({
      method: 'PATCH',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/issuer`,
      secretReference,
      correlationId,
      body: payload,
    });
  }

  async getFiscalProfileV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/profile`,
      secretReference,
      correlationId,
    });
    return validateFiscalProfileV1(response, correlationId);
  }

  async upsertFiscalProfileV1({ billingCompanyId, environment, secretReference, correlationId, payload }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/profile`,
      secretReference,
      correlationId,
      body: payload,
    });
    return validateFiscalProfileV1(response, correlationId);
  }

  async getHaciendaConnectionV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/hacienda-connection`,
      secretReference,
      correlationId,
    });
    return validateHaciendaConnectionResponse(response, correlationId);
  }

  async replaceHaciendaCredentialsV1({ billingCompanyId, environment, username, password, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/hacienda-connection`,
      secretReference,
      correlationId,
      body: { username, password },
    });
    return validateHaciendaConnectionResponse(response, correlationId);
  }

  async validateHaciendaConnectionV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/hacienda-connection/validate`,
      secretReference,
      correlationId,
    });
    return validateHaciendaConnectionResponse(response, correlationId);
  }

  async disableHaciendaConnectionV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/hacienda-connection/disable`,
      secretReference,
      correlationId,
      body: {},
    });
    return validateHaciendaConnectionResponse(response, correlationId);
  }

  async getSigningCertificateMetadata({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/certificate`,
      secretReference,
      correlationId,
    });
    return validateCertificateMetadata(response, correlationId);
  }

  async writeSigningCertificate({ billingCompanyId, environment, certificateBytes, pin, replace, secretReference, correlationId }) {
    const formData = new globalThis.FormData();
    formData.append('certificate', new globalThis.Blob([certificateBytes], { type: 'application/x-pkcs12' }), 'certificate.p12');
    formData.append('pin', pin);
    const response = await this.request({
      method: replace ? 'PUT' : 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/certificate`,
      secretReference,
      correlationId,
      formData,
    });
    return validateCertificateMetadata(response, correlationId);
  }

  async listFiscalBranchesV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/branches`,
      secretReference,
      correlationId,
    });
    return validateFiscalBranches(response, correlationId);
  }

  async upsertFiscalBranchV1({ billingCompanyId, environment, payload, secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/branches`,
      secretReference,
      correlationId,
      body: payload,
    });
    return validateFiscalBranch(response, correlationId);
  }

  async setFiscalBranchActiveV1({ billingCompanyId, environment, branchId, active, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PATCH',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/branches/${encodeURIComponent(branchId)}`,
      secretReference,
      correlationId,
      body: { active },
    });
    return validateFiscalBranch(response, correlationId);
  }

  async upsertFiscalTerminalV1({ billingCompanyId, environment, branchId, payload, secretReference, correlationId }) {
    const response = await this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/branches/${encodeURIComponent(branchId)}/terminals`,
      secretReference,
      correlationId,
      body: payload,
    });
    return validateFiscalTerminal(response, correlationId);
  }

  async setFiscalTerminalActiveV1({ billingCompanyId, environment, terminalId, active, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PATCH',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/terminals/${encodeURIComponent(terminalId)}`,
      secretReference,
      correlationId,
      body: { active },
    });
    return validateFiscalTerminal(response, correlationId);
  }

  async getDefaultIssuancePointV1({ billingCompanyId, environment, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/issuance-points/default`,
      secretReference,
      correlationId,
    });
    return validateIssuancePoint(response, correlationId, { nullable: true });
  }

  async selectDefaultIssuancePointV1({ billingCompanyId, environment, terminalId, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/issuance-points/default`,
      secretReference,
      correlationId,
      body: { terminalId },
    });
    return validateIssuancePoint(response, correlationId);
  }

  async getFiscalSequenceV1({ billingCompanyId, environment, terminalId, documentType, secretReference, correlationId }) {
    const response = await this.request({
      method: 'GET',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/terminals/${encodeURIComponent(terminalId)}/sequences/${encodeURIComponent(documentType)}`,
      secretReference,
      correlationId,
    });
    return validateFiscalSequence(response, correlationId);
  }

  async configureInitialSequenceV1({ billingCompanyId, environment, terminalId, documentType, nextValue, secretReference, correlationId }) {
    const response = await this.request({
      method: 'PUT',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-onboarding/v1/${encodeURIComponent(environment)}/terminals/${encodeURIComponent(terminalId)}/sequences/${encodeURIComponent(documentType)}/initial`,
      secretReference,
      correlationId,
      body: { nextValue },
    });
    return validateFiscalSequence(response, correlationId);
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

  lookupFiscalIdentityByIdempotency({ billingCompanyId, environment, secretReference, idempotencyKey, requestHash, correlationId }) {
    const query = new URLSearchParams({ idempotencyKey: String(idempotencyKey), operation: 'fiscal-document.create.invoice', requestHash: String(requestHash) });
    return this.request({ method: 'GET', path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/identity-by-idempotency?${query.toString()}`, secretReference, correlationId });
  }

  lookupFiscalIdentityByEvidence({ billingCompanyId, environment, secretReference, idempotencyKey, operation, equivalenceContractVersion, fiscalPayload, correlationId }) {
    return this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/identity-by-fiscal-evidence`,
      secretReference,
      correlationId,
      body: { idempotencyKey, operation, equivalenceContractVersion, fiscalPayload },
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

requestAcceptedPackageResend({ billingCompanyId, environment, billingFiscalDocumentId, secretReference, correlationId }) {
    return this.request({
      method: 'POST',
      path: `/api/v1/companies/${encodeURIComponent(billingCompanyId)}/fiscal-documents/${encodeURIComponent(environment)}/invoices/${encodeURIComponent(billingFiscalDocumentId)}/accepted-package-resend`,
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
