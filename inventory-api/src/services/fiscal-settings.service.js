'use strict';

const { createHttpError } = require('../lib/errors');
const billingIntegrationConfigRepository = require('../repositories/billing-integration-config.repository');
const { BillingApiClient, BillingClientError } = require('./billing-api-client.service');
const { createBillingCredentialResolver } = require('./billing-credential-resolver.service');

const SUPPORTED_BILLING_ENVIRONMENTS = new Set(['SANDBOX', 'PRODUCTION']);

function getAuthenticatedCompanyId(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'Operacion requiere una empresa autenticada', 'forbidden');
  }
  return BigInt(auth.companyId);
}

function getCorrelationId(context = {}) {
  return context.correlationId || context.requestId || null;
}

function buildBillingClient() {
  return new BillingApiClient({
    baseUrl: process.env.BILLING_BASE_URL || 'http://localhost:4000',
    credentialResolver: createBillingCredentialResolver(),
    timeoutMs: Number(process.env.BILLING_TIMEOUT_MS) || 10000,
  });
}

function redactSensitiveText(value, sensitiveValue) {
  if (!sensitiveValue || typeof value !== 'string') return value;
  return value.split(sensitiveValue).join('[REDACTED]');
}

function sanitizeBillingFailure(error, secretReference = null) {
  if (error instanceof BillingClientError) {
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : error.retryable ? 503 : 502;
    const message = redactSensitiveText(error.message || 'Billing request failed', secretReference);
    const code = redactSensitiveText(error.code || 'BILLING_CLIENT_ERROR', secretReference);
    throw createHttpError(statusCode, message, code); 
  }
  if (error?.statusCode && error?.code) {
    throw error;
  }
  throw createHttpError(502, 'No fue posible consultar Billing', 'BILLING_UNAVAILABLE');
}

function assertBillingIntegrationReady(config) {
  if (!config) {
    throw createHttpError(409, 'La integracion Billing no esta configurada para esta empresa', 'BILLING_INTEGRATION_MISSING');
  }
  if (!config.enabled) {
    throw createHttpError(409, 'La integracion Billing esta deshabilitada para esta empresa', 'BILLING_INTEGRATION_DISABLED');
  }
  if (!String(config.billingCompanyId || '').trim()) {
    throw createHttpError(409, 'La integracion Billing no tiene empresa Billing configurada', 'BILLING_COMPANY_ID_MISSING');
  }
  if (!String(config.billingCredentialSecretRef || '').trim()) {
    throw createHttpError(409, 'La integracion Billing no tiene credencial configurada', 'BILLING_CREDENTIAL_REFERENCE_MISSING');
  }

  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  if (!SUPPORTED_BILLING_ENVIRONMENTS.has(environment)) {
    throw createHttpError(409, 'Ambiente Billing no soportado', 'BILLING_ENVIRONMENT_UNSUPPORTED');
  }
}

async function resolveBillingIntegration(auth, options = {}) {
  const companyId = getAuthenticatedCompanyId(auth);
  const repository = options.billingIntegrationConfigRepository || billingIntegrationConfigRepository;
  const config = await repository.findByCompanyId(companyId);
  assertBillingIntegrationReady(config);
  return { companyId, config };
}

function mapActivity(activity, defaultEconomicActivityId) {
  const isDefault = Boolean(defaultEconomicActivityId && activity.id === defaultEconomicActivityId);
  return {
    code: activity.code,
    description: activity.description,
    haciendaStatus: activity.haciendaStatus,
    haciendaKind: activity.haciendaKind ?? null,
    billingEnabled: activity.billingEnabled,
    isDefault,
    verifiedAt: activity.verifiedAt ?? null,
    lastSeenAt: activity.lastSeenAt ?? null,
    verificationSource: activity.verificationSource ?? null,
  };
}

function mapFiscalSettingsFromStatus(status) {
  const defaultActivity = status.activities.find((activity) => activity.id === status.defaultEconomicActivityId) || null;
  return {
    taxpayer: {
      verificationStatus: status.haciendaVerificationStatus ?? null,
      verifiedAt: status.haciendaVerifiedAt ?? null,
      taxSituation: status.haciendaTaxSituation ?? null,
      moroso: status.moroso ?? null,
      omiso: status.omiso ?? null,
    },
    activities: status.activities.map((activity) => mapActivity(activity, status.defaultEconomicActivityId)),
    defaultActivityCode: defaultActivity?.code || null,
    configuration: {
      hasBillingIntegration: true,
    },
  };
}

async function loadCanonicalSettings(config, correlationId, options = {}) {
  const billingClient = options.billingClient || buildBillingClient();
  try {
    const status = await billingClient.getFiscalOnboardingStatus({
      billingCompanyId: config.billingCompanyId,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    return mapFiscalSettingsFromStatus(status);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function getFiscalSettings(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  return loadCanonicalSettings(config, getCorrelationId(context), options);
}

async function refreshFiscalActivities(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const billingClient = options.billingClient || buildBillingClient();
  try {
    await billingClient.verifyFiscalOnboarding({
      billingCompanyId: config.billingCompanyId,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return loadCanonicalSettings(config, correlationId, { ...options, billingClient });
}

async function updateFiscalActivity(auth, code, billingEnabled, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const billingClient = options.billingClient || buildBillingClient();
  try {
    await billingClient.updateFiscalOnboardingActivity({
      billingCompanyId: config.billingCompanyId,
      code,
      billingEnabled,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return loadCanonicalSettings(config, correlationId, { ...options, billingClient });
}

async function setDefaultFiscalActivity(auth, code, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const billingClient = options.billingClient || buildBillingClient();
  try {
    await billingClient.setDefaultFiscalOnboardingActivity({
      billingCompanyId: config.billingCompanyId,
      code,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return loadCanonicalSettings(config, correlationId, { ...options, billingClient });
}

async function getFiscalReadiness(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  const billingClient = options.billingClient || buildBillingClient();
  try {
    const readiness = await billingClient.getFiscalReadiness({
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    // Strip Billing companyId — browser does not need it
    return {
      environment: readiness.environment,
      readyToIssue: readiness.readyToIssue,
      reasonCodes: readiness.reasonCodes,
      warnings: readiness.warnings,
      checkedAt: readiness.checkedAt,
    };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

module.exports = {
  getFiscalSettings,
  refreshFiscalActivities,
  updateFiscalActivity,
  setDefaultFiscalActivity,
  getFiscalReadiness,
  mapFiscalSettingsFromStatus,
  resolveBillingIntegration,
};
