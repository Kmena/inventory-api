'use strict';

const { createHttpError } = require('../lib/errors');
const billingIntegrationConfigRepository = require('../repositories/billing-integration-config.repository');
const { BillingApiClient, BillingClientError } = require('./billing-api-client.service');
const { createBillingCredentialResolver } = require('./billing-credential-resolver.service');
const { BillingManagedCredentialStore } = require('./billing-managed-credential-store.service');
const prisma = require('../lib/prisma');

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

function redactSensitiveText(value, sensitiveValues) {
  if (typeof value !== 'string') return value;
  const values = Array.isArray(sensitiveValues) ? sensitiveValues : [sensitiveValues];
  return values.reduce((result, sensitiveValue) => (
    typeof sensitiveValue === 'string' && sensitiveValue
      ? result.split(sensitiveValue).join('[REDACTED]')
      : result
  ), value);
}

function mapBillingClientStatus(error) {
  if (error.statusCode === 401 || error.statusCode === 403) {
    return 502;
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 600) {
    return error.statusCode;
  }

  return error.retryable ? 503 : 502;
}

function sanitizeBillingFailure(error, sensitiveValues = null) {
  if (error instanceof BillingClientError) {
    const statusCode = mapBillingClientStatus(error);
    const message = redactSensitiveText(error.message || 'Billing request failed', sensitiveValues);
    const code = redactSensitiveText(error.code || 'BILLING_CLIENT_ERROR', sensitiveValues);
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
  if (config.associationStatus === 'HISTORICAL_ONLY') {
    throw createHttpError(409, 'La asociacion fiscal es solo historica', 'BILLING_ASSOCIATION_HISTORICAL_ONLY');
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

function mapHaciendaConnection(connection) {
  if (!connection || typeof connection !== 'object') return null;
  return {
    environment: typeof connection.environment === 'string' ? connection.environment : null,
    status: typeof connection.status === 'string' ? connection.status : null,
    configured: typeof connection.status === 'string' && connection.status !== 'NOT_CONFIGURED',
    lastValidatedAt: connection.lastValidatedAt ?? null,
    lastSuccessfulAuthAt: connection.lastSuccessfulAuthAt ?? null,
    lastValidationErrorCode: typeof connection.lastValidationErrorCode === 'string'
      ? connection.lastValidationErrorCode
      : null,
  };
}

function mapCertificateMetadata(certificate, now = new Date()) {
  if (!certificate || typeof certificate !== 'object') return null;
  const validTo = certificate.validTo || null;
  const expirationTime = validTo ? Date.parse(validTo) : Number.NaN;
  const daysRemaining = Number.isFinite(expirationTime)
    ? Math.ceil((expirationTime - now.getTime()) / 86_400_000)
    : null;
  const expiryState = daysRemaining == null
    ? 'UNKNOWN'
    : (daysRemaining < 0 ? 'EXPIRED' : (daysRemaining <= 30 ? 'EXPIRING_SOON' : 'VALID'));
  return {
    environment: certificate.environment,
    status: certificate.status,
    fingerprintSha256: certificate.fingerprintSha256 ?? null,
    serialNumber: certificate.serialNumber ?? null,
    subjectName: certificate.subjectName ?? null,
    issuerName: certificate.issuerName ?? null,
    validFrom: certificate.validFrom ?? null,
    validTo,
    extractedIdentityNumber: certificate.extractedIdentityNumber ?? null,
    extractedIdentityType: certificate.extractedIdentityType ?? null,
    activeFrom: certificate.activeFrom ?? null,
    updatedAt: certificate.updatedAt ?? null,
    expiryState,
    daysRemaining,
  };
}

function mapFiscalTerminal(terminal) {
  return {
    terminalId: terminal.id,
    code: terminal.code,
    name: terminal.name,
    active: terminal.active,
  };
}

function mapFiscalBranch(branch) {
  return {
    branchId: branch.id,
    code: branch.code,
    name: branch.name,
    active: branch.active,
    terminals: Array.isArray(branch.terminals) ? branch.terminals.map(mapFiscalTerminal) : [],
  };
}

function mapIssuancePoint(point) {
  if (!point) return null;
  return {
    environment: point.environment,
    branchId: point.branchId,
    terminalId: point.terminalId,
    branchCode: point.branchCode,
    terminalCode: point.terminalCode,
    name: point.name,
    active: point.active,
    isDefault: point.isDefault,
  };
}

function mapFiscalSequence(sequence) {
  if (!sequence) return null;
  return {
    environment: sequence.environment,
    branchCode: sequence.branchCode,
    terminalCode: sequence.terminalCode,
    documentType: sequence.documentType,
    nextValue: sequence.nextValue,
    lastAssigned: sequence.lastAssigned,
    locked: sequence.lastAssigned !== null,
  };
}

async function readOptionalBillingResource(read, fallbackCode) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof BillingClientError && error.statusCode === 404) return null;
    if (error?.code === fallbackCode && error?.statusCode === 404) return null;
    throw error;
  }
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
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  try {
    if (typeof billingClient.getFiscalProfileV1 !== 'function'
      || typeof billingClient.getFiscalReadinessV1 !== 'function') {
      const legacyStatus = await billingClient.getFiscalOnboardingStatus({
        billingCompanyId: config.billingCompanyId,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
      });
      return mapFiscalSettingsFromStatus(legacyStatus);
    }
    const requestContext = {
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    };
    const [profile, activities, readiness] = await Promise.all([
      readOptionalBillingResource(
        () => billingClient.getFiscalProfileV1(requestContext),
        'COMPANY_FISCAL_PROFILE_NOT_FOUND',
      ),
      billingClient.getFiscalOnboardingActivities(requestContext),
      billingClient.getFiscalReadinessV1(requestContext),
    ]);
    const status = {
      activities,
      defaultEconomicActivityId: profile?.defaultEconomicActivityId
        ?? readiness?.dimensions?.activity?.metadata?.defaultActivityId
        ?? null,
      haciendaVerificationStatus: readiness?.dimensions?.issuer?.metadata?.verificationStatus ?? null,
    };
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
      environment: String(config.billingEnvironment || '').trim().toUpperCase(),
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
      environment: String(config.billingEnvironment || '').trim().toUpperCase(),
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
      environment: String(config.billingEnvironment || '').trim().toUpperCase(),
      code,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return loadCanonicalSettings(config, correlationId, { ...options, billingClient });
}

async function configureHaciendaCredentials(auth, credentials, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  const billingClient = options.billingClient || buildBillingClient();
  try {
    const replaceCredentials = billingClient.replaceHaciendaCredentialsV1
      || billingClient.configureHaciendaCredentials;
    const validateConnection = billingClient.validateHaciendaConnectionV1
      || billingClient.validateHaciendaCredentials;
    await replaceCredentials.call(billingClient, {
      billingCompanyId: config.billingCompanyId,
      environment,
      username: credentials.username,
      password: credentials.password,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    const validation = await validateConnection.call(billingClient, {
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    const canonical = typeof billingClient.getHaciendaConnectionV1 === 'function'
      ? await billingClient.getHaciendaConnectionV1({
        billingCompanyId: config.billingCompanyId,
        environment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
      })
      : validation;
    return { connection: mapHaciendaConnection(canonical) };
  } catch (error) {
    sanitizeBillingFailure(error, [config.billingCredentialSecretRef, credentials.username, credentials.password]);
  }
  return null;
}

async function validateHaciendaCredentials(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  const billingClient = options.billingClient || buildBillingClient();
  try {
    const validateConnection = billingClient.validateHaciendaConnectionV1
      || billingClient.validateHaciendaCredentials;
    const validation = await validateConnection.call(billingClient, {
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    const canonical = typeof billingClient.getHaciendaConnectionV1 === 'function'
      ? await billingClient.getHaciendaConnectionV1({
        billingCompanyId: config.billingCompanyId,
        environment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
      })
      : validation;
    return { connection: mapHaciendaConnection(canonical) };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function disableHaciendaConnection(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const correlationId = getCorrelationId(context);
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  const billingClient = options.billingClient || buildBillingClient();
  try {
    await billingClient.disableHaciendaConnectionV1({
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    const canonical = await billingClient.getHaciendaConnectionV1({
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    return { connection: mapHaciendaConnection(canonical) };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function getFiscalSecurityConfiguration(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  const correlationId = getCorrelationId(context);
  try {
    const connection = typeof billingClient.getHaciendaConnectionV1 === 'function'
      ? await readOptionalBillingResource(() => billingClient.getHaciendaConnectionV1({
        billingCompanyId: config.billingCompanyId,
        environment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
      }), 'HACIENDA_CONNECTION_NOT_FOUND')
      : null;
    const certificate = await readOptionalBillingResource(() => billingClient.getSigningCertificateMetadata({
      billingCompanyId: config.billingCompanyId,
      environment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    }), 'FISCAL_CERTIFICATE_NOT_FOUND');
    return {
      environment,
      connection: mapHaciendaConnection(connection),
      certificate: mapCertificateMetadata(certificate, options.now || new Date()),
    };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function writeFiscalCertificate(auth, upload, replace, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  const correlationId = getCorrelationId(context);
  try {
    const written = await billingClient.writeSigningCertificate({
      billingCompanyId: config.billingCompanyId,
      environment,
      certificateBytes: upload.certificateBytes,
      pin: upload.pin,
      replace: replace === true,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    const canonical = typeof billingClient.getSigningCertificateMetadata === 'function'
      ? await billingClient.getSigningCertificateMetadata({
        billingCompanyId: config.billingCompanyId,
        environment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
      })
      : written;
    return {
      environment,
      certificate: mapCertificateMetadata(canonical, options.now || new Date()),
    };
  } catch (error) {
    sanitizeBillingFailure(error, [config.billingCredentialSecretRef, upload.pin]);
  } finally {
    upload.certificateBytes?.fill(0);
  }
  return null;
}

function billingOperationArguments(config, correlationId) {
  return {
    billingCompanyId: config.billingCompanyId,
    environment: String(config.billingEnvironment || '').trim().toUpperCase(),
    secretReference: config.billingCredentialSecretRef,
    correlationId,
  };
}

function assertCanonicalIssuanceScope(branches, config) {
  const environment = String(config.billingEnvironment || '').trim().toUpperCase();
  for (const branch of branches) {
    if (branch.companyId !== config.billingCompanyId || branch.environment !== environment) {
      throw createHttpError(409, 'La configuración fiscal no coincide con la empresa autenticada', 'BILLING_ASSOCIATION_MISMATCH');
    }
    for (const terminal of branch.terminals || []) {
      if (terminal.companyId !== config.billingCompanyId
        || terminal.environment !== environment
        || terminal.branchId !== branch.id) {
        throw createHttpError(409, 'Una terminal fiscal no coincide con su sucursal', 'BILLING_TERMINAL_SCOPE_MISMATCH');
      }
    }
  }
}

async function readCanonicalIssuanceAdministration(config, correlationId, billingClient) {
  const args = billingOperationArguments(config, correlationId);
  const [branches, defaultPoint] = await Promise.all([
    billingClient.listFiscalBranchesV1(args),
    billingClient.getDefaultIssuancePointV1(args),
  ]);
  assertCanonicalIssuanceScope(branches, config);
  if (defaultPoint) {
    const branch = branches.find((item) => item.id === defaultPoint.branchId);
    const terminal = branch?.terminals?.find((item) => item.id === defaultPoint.terminalId);
    if (!branch || !terminal || defaultPoint.environment !== args.environment) {
      throw createHttpError(409, 'El punto predeterminado no coincide con el estado canónico', 'BILLING_DEFAULT_POINT_SCOPE_MISMATCH');
    }
  }
  return {
    environment: args.environment,
    branches: branches.map(mapFiscalBranch),
    defaultIssuancePoint: mapIssuancePoint(defaultPoint),
  };
}

function findCanonicalBranch(administration, branchId) {
  return administration.branches.find((branch) => branch.branchId === branchId) || null;
}

function findCanonicalTerminal(administration, terminalId) {
  for (const branch of administration.branches) {
    const terminal = branch.terminals.find((item) => item.terminalId === terminalId);
    if (terminal) return { branch, terminal };
  }
  return null;
}

async function getFiscalIssuanceAdministration(auth, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  try {
    return await readCanonicalIssuanceAdministration(config, getCorrelationId(context), billingClient);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function upsertFiscalBranch(auth, payload, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  try {
    try {
      await billingClient.upsertFiscalBranchV1({ ...args, payload });
    } catch (error) {
      if (!(error instanceof BillingClientError) || !error.retryable) throw error;
      const recovered = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
      const branch = recovered.branches.find((item) => item.code === payload.code);
      if (branch?.name === payload.name) return recovered;
      throw error;
    }
    return await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function setFiscalBranchActive(auth, branchId, active, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  try {
    const before = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
    if (!findCanonicalBranch(before, branchId)) {
      throw createHttpError(404, 'Sucursal fiscal no encontrada', 'FISCAL_BRANCH_NOT_FOUND');
    }
    try {
      await billingClient.setFiscalBranchActiveV1({ ...args, branchId, active });
    } catch (error) {
      if (!(error instanceof BillingClientError) || (!error.retryable && error.statusCode !== 409)) throw error;
      const recovered = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
      if (findCanonicalBranch(recovered, branchId)?.active === active) return recovered;
      throw error;
    }
    return await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function upsertFiscalTerminal(auth, branchId, payload, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  try {
    const before = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
    if (!findCanonicalBranch(before, branchId)) {
      throw createHttpError(404, 'Sucursal fiscal no encontrada', 'FISCAL_BRANCH_NOT_FOUND');
    }
    try {
      await billingClient.upsertFiscalTerminalV1({ ...args, branchId, payload });
    } catch (error) {
      if (!(error instanceof BillingClientError) || !error.retryable) throw error;
      const recovered = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
      const branch = findCanonicalBranch(recovered, branchId);
      const terminal = branch?.terminals.find((item) => item.code === payload.code);
      if (terminal?.name === payload.name) return recovered;
      throw error;
    }
    return await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function setFiscalTerminalActive(auth, terminalId, active, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  try {
    const before = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
    if (!findCanonicalTerminal(before, terminalId)) {
      throw createHttpError(404, 'Terminal fiscal no encontrada', 'FISCAL_TERMINAL_NOT_FOUND');
    }
    try {
      await billingClient.setFiscalTerminalActiveV1({ ...args, terminalId, active });
    } catch (error) {
      if (!(error instanceof BillingClientError) || (!error.retryable && error.statusCode !== 409)) throw error;
      const recovered = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
      if (findCanonicalTerminal(recovered, terminalId)?.terminal.active === active) return recovered;
      throw error;
    }
    return await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function selectDefaultIssuancePoint(auth, terminalId, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  try {
    const before = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
    const selected = findCanonicalTerminal(before, terminalId);
    if (!selected) throw createHttpError(404, 'Terminal fiscal no encontrada', 'FISCAL_TERMINAL_NOT_FOUND');
    if (!selected.branch.active || !selected.terminal.active) {
      throw createHttpError(409, 'Solo una sucursal y terminal activas pueden ser predeterminadas', 'FISCAL_TERMINAL_NOT_ELIGIBLE');
    }
    try {
      await billingClient.selectDefaultIssuancePointV1({ ...args, terminalId });
    } catch (error) {
      if (!(error instanceof BillingClientError) || (!error.retryable && error.statusCode !== 409)) throw error;
      const recovered = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
      if (recovered.defaultIssuancePoint?.terminalId === terminalId) return recovered;
      throw error;
    }
    return await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function readFiscalSequence(auth, terminalId, documentType, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  try {
    const administration = await readCanonicalIssuanceAdministration(config, correlationId, billingClient);
    if (!findCanonicalTerminal(administration, terminalId)) {
      throw createHttpError(404, 'Terminal fiscal no encontrada', 'FISCAL_TERMINAL_NOT_FOUND');
    }
    const sequence = await readOptionalBillingResource(
      () => billingClient.getFiscalSequenceV1({ ...args, terminalId, documentType }),
      'FISCAL_SEQUENCE_NOT_FOUND',
    );
    if (sequence && sequence.environment !== args.environment) {
      throw createHttpError(409, 'La secuencia no coincide con el ambiente fiscal', 'BILLING_SEQUENCE_SCOPE_MISMATCH');
    }
    return { environment: args.environment, terminalId, sequence: mapFiscalSequence(sequence) };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function configureInitialFiscalSequence(auth, payload, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  const args = billingOperationArguments(config, correlationId);
  const { terminalId, documentType, nextValue } = payload;
  try {
    const before = await readFiscalSequence(auth, terminalId, documentType, context, { ...options, billingClient });
    if (before.sequence) {
      if (before.sequence.lastAssigned !== null) {
        throw createHttpError(409, 'La secuencia ya fue utilizada y es inmutable', 'FISCAL_SEQUENCE_ALREADY_USED');
      }
      if (before.sequence.nextValue === String(nextValue)) return before;
      throw createHttpError(409, 'La secuencia inicial ya fue configurada con otro valor', 'FISCAL_SEQUENCE_INITIAL_VALUE_CONFLICT');
    }
    try {
      await billingClient.configureInitialSequenceV1({ ...args, terminalId, documentType, nextValue });
    } catch (error) {
      if (!(error instanceof BillingClientError) || (!error.retryable && error.statusCode !== 409)) throw error;
      const recovered = await readOptionalBillingResource(
        () => billingClient.getFiscalSequenceV1({ ...args, terminalId, documentType }),
        'FISCAL_SEQUENCE_NOT_FOUND',
      );
      if (recovered?.nextValue === String(nextValue)) {
        return { environment: args.environment, terminalId, sequence: mapFiscalSequence(recovered) };
      }
      throw error;
    }
    const canonical = await billingClient.getFiscalSequenceV1({ ...args, terminalId, documentType });
    return { environment: args.environment, terminalId, sequence: mapFiscalSequence(canonical) };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
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
      contractVersion: '1.0',
    });
    // Billing remains authoritative for issuer/operational readiness. Transaction
    // readiness is evaluated separately at the order handoff boundary.
    // Strip Billing companyId — browser does not need the provider identifier.
    return {
      contractVersion: readiness.contractVersion || 'legacy-test-seam',
      profileVersion: readiness.profileVersion || 'inventori-fiscal-v1',
      authority: 'BILLING',
      sources: {
        issuer: 'BILLING',
        operational: 'BILLING',
        transaction: 'INVENTORI_AT_TRANSACTION_HANDOFF',
      },
      environment: readiness.environment,
      status: readiness.status || (readiness.readyToIssue ? 'READY' : 'NOT_READY'),
      readyToIssue: readiness.readyToIssue,
      blockers: readiness.blockers || readiness.reasonCodes || [],
      warnings: readiness.warnings,
      dimensions: readiness.dimensions || {},
      checkedAt: readiness.checkedAt,
    };
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function initiateFiscalTestInvoice(auth, payload, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  if (config.billingEnvironment !== 'SANDBOX') {
    throw createHttpError(403, 'La factura de prueba solo está disponible en SANDBOX', 'FISCAL_TEST_INVOICE_PRODUCTION_FORBIDDEN');
  }
  const billingClient = options.billingClient || buildBillingClient();
  try {
    return await billingClient.initiateFiscalTestInvoiceV1({
      billingCompanyId: config.billingCompanyId,
      environment: config.billingEnvironment,
      secretReference: config.billingCredentialSecretRef,
      correlationId: getCorrelationId(context),
      idempotencyKey: payload.idempotencyKey,
      payload: {
        mode: 'HACIENDA_SANDBOX_SUBMISSION',
        confirmation: 'CONSUME_SANDBOX_CONSECUTIVE',
        receiver: payload.receiver,
        currency: payload.currency,
        exchangeRate: payload.exchangeRate,
        saleCondition: payload.saleCondition,
        creditTermDays: payload.creditTermDays,
        paymentMethod: payload.paymentMethod,
        lines: payload.lines,
      },
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function getFiscalTestInvoiceStatus(auth, executionId, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  if (config.billingEnvironment !== 'SANDBOX') {
    throw createHttpError(403, 'La factura de prueba solo está disponible en SANDBOX', 'FISCAL_TEST_INVOICE_PRODUCTION_FORBIDDEN');
  }
  const billingClient = options.billingClient || buildBillingClient();
  try {
    return await billingClient.getFiscalTestInvoiceV1({
      billingCompanyId: config.billingCompanyId,
      environment: config.billingEnvironment,
      secretReference: config.billingCredentialSecretRef,
      correlationId: getCorrelationId(context),
      executionId,
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function getFiscalTestInvoiceArtifact(auth, executionId, artifactType, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  if (config.billingEnvironment !== 'SANDBOX') {
    throw createHttpError(403, 'Los artefactos de prueba solo están disponibles en SANDBOX', 'FISCAL_TEST_INVOICE_PRODUCTION_FORBIDDEN');
  }
  const allowedTypes = new Set(['PDF', 'SIGNED_XML', 'HACIENDA_RESPONSE_XML']);
  if (!allowedTypes.has(artifactType)) {
    throw createHttpError(400, 'Tipo de artefacto fiscal no permitido', 'FISCAL_ARTIFACT_TYPE_INVALID');
  }
  const billingClient = options.billingClient || buildBillingClient();
  try {
    const status = await billingClient.getFiscalTestInvoiceV1({
      billingCompanyId: config.billingCompanyId,
      environment: 'SANDBOX',
      secretReference: config.billingCredentialSecretRef,
      correlationId: getCorrelationId(context),
      executionId,
    });
    if (!status.artifacts.some((artifact) => artifact.type === artifactType)) {
      throw createHttpError(404, 'Artefacto fiscal no disponible', 'FISCAL_ARTIFACT_NOT_FOUND');
    }
    return await billingClient.getArtifact({
      billingCompanyId: config.billingCompanyId,
      environment: 'SANDBOX',
      billingFiscalDocumentId: executionId,
      artifactType,
      secretReference: config.billingCredentialSecretRef,
      correlationId: getCorrelationId(context),
    });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

function billingEnvironmentFromLocal(value) {
  return String(value || '').toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
}

function billingIdentificationType(value) {
  return ({ '01': 'FISICA', '02': 'JURIDICA', '03': 'DIMEX', '04': 'NITE' })[String(value)] || String(value);
}

function billingIdentificationNumber(value, identificationType) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/[\s-]/g, '');
  const expectedLengths = {
    FISICA: new Set([9]),
    JURIDICA: new Set([10]),
    DIMEX: new Set([11, 12]),
    NITE: new Set([10]),
  };
  const lengths = expectedLengths[identificationType];
  if (!lengths || !/^\d+$/.test(digits) || !lengths.has(digits.length)) {
    throw createHttpError(
      409,
      'La identificacion fiscal local no tiene un formato valido para Billing',
      'FISCAL_IDENTIFICATION_INVALID',
    );
  }
  return digits;
}

async function loadLocalIssuer(companyId, options = {}) {
  const database = options.prisma || prisma;
  const company = await database.company.findUnique({
    where: { id: companyId },
    include: { fiscalConfig: true },
  });
  if (!company?.fiscalConfig) {
    throw createHttpError(409, 'Completa primero los datos fiscales de la empresa', 'LOCAL_FISCAL_IDENTITY_MISSING');
  }
  return company;
}

function safeAdministrationResponse({ config, issuer = null, profile = null, localCompany }) {
  const associationStatus = !config
    ? 'NOT_ASSOCIATED'
    : config.associationStatus === 'HISTORICAL_ONLY'
      ? 'HISTORICAL_ONLY'
      : config.enabled
        ? 'ASSOCIATED'
        : 'DISABLED';
  const safeProfile = profile ? {
    economicActivityCode: profile.economicActivityCode,
    province: profile.province,
    canton: profile.canton,
    district: profile.district,
    otrasSenas: profile.otrasSenas,
    email: profile.email,
    phoneCountryCode: profile.phoneCountryCode ?? null,
    phoneNumber: profile.phoneNumber ?? null,
    updatedAt: profile.updatedAt ?? null,
  } : null;
  return {
    association: {
      status: associationStatus,
      enabled: config?.enabled === true,
      environment: config?.billingEnvironment
        || billingEnvironmentFromLocal(localCompany?.fiscalConfig?.haciendaEnvironment),
      profileVersion: config ? 'inventori-fiscal-v1' : null,
      synchronizedAt: config?.updatedAt || null,
    },
    issuer: issuer?.company ? {
      legalName: issuer.company.legalName,
      tradeName: issuer.company.tradeName,
      identificationType: issuer.company.identificationType,
      identificationNumber: issuer.company.identificationNumber,
      status: issuer.company.status,
      updatedAt: issuer.company.updatedAt,
      identityLockPolicy: 'BILLING_ENFORCED',
    } : null,
    profile: safeProfile,
  };
}

async function getFiscalAdministration(auth, context = {}, options = {}) {
  const companyId = getAuthenticatedCompanyId(auth);
  const repository = options.billingIntegrationConfigRepository || billingIntegrationConfigRepository;
  const config = await repository.findByCompanyId(companyId);
  const localCompany = await loadLocalIssuer(companyId, options);
  if (!config?.enabled) return safeAdministrationResponse({ config, localCompany });
  assertBillingIntegrationReady(config);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  try {
    const issuer = await billingClient.getFiscalIssuerV1({
      billingCompanyId: config.billingCompanyId,
      environment: config.billingEnvironment,
      secretReference: config.billingCredentialSecretRef,
      correlationId,
    });
    let profile = null;
    try {
      profile = await billingClient.getFiscalProfileV1({
        billingCompanyId: config.billingCompanyId,
        environment: config.billingEnvironment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
      });
    } catch (error) {
      if (!(error instanceof BillingClientError) || error.statusCode !== 404) throw error;
    }
    if (issuer.company.tenantId !== config.billingTenantId || issuer.company.id !== config.billingCompanyId) {
      throw createHttpError(409, 'La asociación fiscal no coincide con Billing', 'BILLING_ASSOCIATION_MISMATCH');
    }
    return safeAdministrationResponse({ config, issuer, profile, localCompany });
  } catch (error) {
    sanitizeBillingFailure(error, config.billingCredentialSecretRef);
  }
  return null;
}

async function provisionFiscalAdministration(auth, context = {}, options = {}) {
  const companyId = getAuthenticatedCompanyId(auth);
  const repository = options.billingIntegrationConfigRepository || billingIntegrationConfigRepository;
  const existing = await repository.findByCompanyId(companyId);
  if (existing?.associationStatus === 'HISTORICAL_ONLY') {
    throw createHttpError(
      409,
      'La asociacion fiscal historica no puede aprovisionarse de nuevo',
      'BILLING_ASSOCIATION_HISTORICAL_ONLY',
    );
  }
  if (existing?.enabled) return getFiscalAdministration(auth, context, options);
  const localCompany = await loadLocalIssuer(companyId, options);
  const fiscal = localCompany.fiscalConfig;
  const environment = billingEnvironmentFromLocal(fiscal.haciendaEnvironment);
  const identificationType = billingIdentificationType(fiscal.identificationType);
  const bootstrapSecretReference = options.bootstrapSecretReference
    || process.env.BILLING_BOOTSTRAP_SECRET_REF
    || 'env:BILLING_BOOTSTRAP_API_KEY';
  const billingClient = options.billingClient || buildBillingClient();
  const credentialStore = options.credentialStore || new BillingManagedCredentialStore();
  let managedReference = null;
  try {
    const result = await billingClient.bootstrapFiscalIssuer({
      secretReference: bootstrapSecretReference,
      correlationId: getCorrelationId(context),
      payload: {
        externalCompanyKey: `inventori:company:${companyId.toString()}`,
        legalName: fiscal.legalName,
        tradeName: fiscal.commercialName || undefined,
        identificationType,
        identificationNumber: billingIdentificationNumber(fiscal.identificationNumber, identificationType),
        environment,
      },
    });
    managedReference = credentialStore.store(result.credential.secret);
    await repository.upsertForCompany(companyId, {
      billingTenantId: result.association.company.tenantId,
      billingCompanyId: result.association.company.id,
      billingEnvironment: environment,
      billingCredentialSecretRef: managedReference,
      enabled: true,
      readinessStatus: 'UNKNOWN',
      readinessCheckedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    return getFiscalAdministration(auth, context, { ...options, billingClient });
  } catch (error) {
    if (managedReference) credentialStore.remove(managedReference);
    sanitizeBillingFailure(error, bootstrapSecretReference);
  }
  return null;
}

async function updateFiscalAdministration(auth, payload, context = {}, options = {}) {
  const { config } = await resolveBillingIntegration(auth, options);
  const billingClient = options.billingClient || buildBillingClient();
  const correlationId = getCorrelationId(context);
  try {
    if (payload.issuer && Object.keys(payload.issuer).length > 0) {
      await billingClient.updateFiscalIssuerV1({
        billingCompanyId: config.billingCompanyId,
        environment: config.billingEnvironment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
        payload: payload.issuer,
      });
    }
    if (payload.profile) {
      await billingClient.upsertFiscalProfileV1({
        billingCompanyId: config.billingCompanyId,
        environment: config.billingEnvironment,
        secretReference: config.billingCredentialSecretRef,
        correlationId,
        payload: payload.profile,
      });
    }
    return getFiscalAdministration(auth, context, { ...options, billingClient });
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
  configureHaciendaCredentials,
  validateHaciendaCredentials,
  disableHaciendaConnection,
  getFiscalSecurityConfiguration,
  writeFiscalCertificate,
  getFiscalIssuanceAdministration,
  upsertFiscalBranch,
  setFiscalBranchActive,
  upsertFiscalTerminal,
  setFiscalTerminalActive,
  selectDefaultIssuancePoint,
  readFiscalSequence,
  configureInitialFiscalSequence,
  getFiscalReadiness,
  initiateFiscalTestInvoice,
  getFiscalTestInvoiceStatus,
  getFiscalTestInvoiceArtifact,
  getFiscalAdministration,
  provisionFiscalAdministration,
  updateFiscalAdministration,
  mapFiscalSettingsFromStatus,
  mapHaciendaConnection,
  mapCertificateMetadata,
  mapFiscalBranch,
  mapFiscalTerminal,
  mapIssuancePoint,
  mapFiscalSequence,
  resolveBillingIntegration,
};
