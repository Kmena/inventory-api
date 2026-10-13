'use strict';

const { createHttpError } = require('../lib/errors');
const { BillingManagedCredentialStore, REFERENCE_PREFIX } = require('./billing-managed-credential-store.service');

function parseEnvironmentSecretReference(secretReference) {
  const value = String(secretReference || '').trim();
  if (!value.startsWith('env:')) {
    return null;
  }
  const environmentVariableName = value.slice(4).trim();
  if (!/^[A-Z0-9_]+$/.test(environmentVariableName)) {
    return null;
  }
  return environmentVariableName;
}

function resolveBillingApiKey(secretReference, environment = process.env, managedStore = null) {
  if (String(secretReference || '').startsWith(REFERENCE_PREFIX)) {
    try {
      return (managedStore || new BillingManagedCredentialStore()).resolve(secretReference);
    } catch (_error) {
      throw createHttpError(500, 'Credencial Billing administrada no disponible', 'BILLING_MANAGED_SECRET_UNAVAILABLE');
    }
  }
  const environmentVariableName = parseEnvironmentSecretReference(secretReference);
  if (!environmentVariableName) {
    throw createHttpError(500, 'Referencia de credencial Billing no soportada', 'BILLING_SECRET_REFERENCE_UNSUPPORTED');
  }

  const apiKey = String(environment[environmentVariableName] || '').trim();
  if (!apiKey) {
    throw createHttpError(500, 'Credencial Billing no configurada', 'BILLING_SECRET_MISSING');
  }

  return apiKey;
}

function createBillingCredentialResolver(environment = process.env, managedStore = null) {
  return {
    resolveApiKey(secretReference) {
      return resolveBillingApiKey(secretReference, environment, managedStore);
    },
  };
}

module.exports = {
  createBillingCredentialResolver,
  parseEnvironmentSecretReference,
  resolveBillingApiKey,
};
