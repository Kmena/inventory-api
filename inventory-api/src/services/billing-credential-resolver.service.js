'use strict';

const { createHttpError } = require('../lib/errors');

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

function resolveBillingApiKey(secretReference, environment = process.env) {
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

function createBillingCredentialResolver(environment = process.env) {
  return {
    resolveApiKey(secretReference) {
      return resolveBillingApiKey(secretReference, environment);
    },
  };
}

module.exports = {
  createBillingCredentialResolver,
  parseEnvironmentSecretReference,
  resolveBillingApiKey,
};
