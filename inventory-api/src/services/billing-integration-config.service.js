'use strict';

const { createHttpError } = require('../lib/errors');
const billingIntegrationConfigRepository = require('../repositories/billing-integration-config.repository');

const ALLOWED_ENVIRONMENTS = new Set(['SANDBOX', 'PRODUCTION']);

function getAuthenticatedCompanyId(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'Operacion requiere una empresa autenticada', 'forbidden');
  }
  return BigInt(auth.companyId);
}

function serializeBillingIntegrationConfig(config) {
  if (!config) {
    return null;
  }

  return {
    id: config.id,
    inventoriCompanyId: config.companyId,
    billingTenantId: config.billingTenantId,
    billingCompanyId: config.billingCompanyId,
    billingEnvironment: config.billingEnvironment,
    enabled: config.enabled,
    associationStatus: config.associationStatus || 'ACTIVE',
    hasCredentialSecret: Boolean(config.billingCredentialSecretRef),
    readinessStatus: config.readinessStatus,
    readinessCheckedAt: config.readinessCheckedAt,
    lastErrorCode: config.lastErrorCode,
    lastErrorMessage: config.lastErrorMessage,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function normalizeConfigPayload(payload) {
  const billingEnvironment = String(payload.billingEnvironment || 'SANDBOX').trim().toUpperCase();
  if (!ALLOWED_ENVIRONMENTS.has(billingEnvironment)) {
    throw createHttpError(400, 'Ambiente Billing no soportado', 'BILLING_ENVIRONMENT_UNSUPPORTED');
  }

  return {
    billingTenantId: String(payload.billingTenantId || '').trim(),
    billingCompanyId: String(payload.billingCompanyId || '').trim(),
    billingEnvironment,
    billingCredentialSecretRef: String(payload.billingCredentialSecretRef || '').trim(),
    enabled: Boolean(payload.enabled),
    readinessStatus: payload.readinessStatus || 'UNKNOWN',
    readinessCheckedAt: payload.readinessCheckedAt || null,
    lastErrorCode: payload.lastErrorCode || null,
    lastErrorMessage: payload.lastErrorMessage || null,
  };
}

function validateConfigPayload(data) {
  const missing = [];
  if (!data.billingTenantId) missing.push('billingTenantId');
  if (!data.billingCompanyId) missing.push('billingCompanyId');
  if (!data.billingCredentialSecretRef) missing.push('billingCredentialSecretRef');

  if (missing.length > 0) {
    throw createHttpError(400, `Configuracion Billing incompleta: ${missing.join(', ')}`, 'BILLING_CONFIG_INCOMPLETE');
  }
}

async function getCompanyBillingIntegrationConfig(auth) {
  const companyId = getAuthenticatedCompanyId(auth);
  return serializeBillingIntegrationConfig(await billingIntegrationConfigRepository.findByCompanyId(companyId));
}

async function upsertCompanyBillingIntegrationConfig(payload, auth) {
  const companyId = getAuthenticatedCompanyId(auth);
  const data = normalizeConfigPayload(payload);
  validateConfigPayload(data);
  const existing = await billingIntegrationConfigRepository.findByCompanyId(companyId);
  if (existing?.associationStatus === 'HISTORICAL_ONLY' && data.enabled) {
    throw createHttpError(
      409,
      'La asociacion fiscal es historica y no puede reactivarse mediante la configuracion normal',
      'BILLING_ASSOCIATION_HISTORICAL_ONLY',
    );
  }
  const config = await billingIntegrationConfigRepository.upsertForCompany(companyId, data);
  return serializeBillingIntegrationConfig(config);
}

module.exports = {
  getAuthenticatedCompanyId,
  getCompanyBillingIntegrationConfig,
  normalizeConfigPayload,
  serializeBillingIntegrationConfig,
  upsertCompanyBillingIntegrationConfig,
};
