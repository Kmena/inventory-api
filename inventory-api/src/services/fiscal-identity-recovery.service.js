'use strict';

const prisma = require('../lib/prisma');
const audit = require('../lib/audit');
const { BillingClientError } = require('./billing-api-client.service');
const { buildBillingFiscalDocumentPayload, hashBillingPayload } = require('./fiscal-billing-worker.service');

const BILLING_LOOKUP_CONTRACT_VERSION = '1.0.0';
const INVOICE_CREATE_OPERATION = 'fiscal-document.create.invoice';
const SHA256_HEX = /^[a-f0-9]{64}$/i;
const FISCAL_PAYLOAD_EQUIVALENCE_VERSION = 'fiscal-payload-equivalence.v1';

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function recoveryError(code, message) {
  const error = /** @type {Error & { code: string }} */ (new Error(message));
  error.code = code;
  return error;
}

function originalPayloadHash(intent) {
  const value = jsonObject(intent?.metadata).billingPayloadHash;
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) {
    throw recoveryError('FISCAL_RECOVERY_HASH_UNAVAILABLE', 'Original Billing request hash is unavailable');
  }
  return value;
}

function assertVerifiedIdentity(intent, identity) {
  const config = intent.integrationConfig;
  const hash = originalPayloadHash(intent);
  if (!identity || identity.requestHashVerified !== true || identity.reservationStatus !== 'COMPLETED') {
    throw recoveryError('FISCAL_RECOVERY_UNVERIFIED_IDENTITY', 'Billing did not prove a completed fiscal identity');
  }
  if (identity.companyId !== config?.billingCompanyId || String(identity.environment).toUpperCase() !== String(config?.billingEnvironment).toUpperCase()) {
    throw recoveryError('FISCAL_RECOVERY_BINDING_MISMATCH', 'Billing identity company or environment mismatch');
  }
  if (identity.documentType !== 'INVOICE' || identity.operation !== INVOICE_CREATE_OPERATION || identity.idempotencyKey !== intent.idempotencyKey) {
    throw recoveryError('FISCAL_RECOVERY_IDEMPOTENCY_MISMATCH', 'Billing identity does not match the original issuance operation');
  }
  if (typeof identity.fiscalDocumentId !== 'string' || !identity.fiscalDocumentId || typeof identity.clave !== 'string' || !identity.clave || typeof identity.consecutive !== 'string' || !identity.consecutive) {
    throw recoveryError('FISCAL_RECOVERY_INCOMPLETE_IDENTITY', 'Billing identity is incomplete');
  }
  if ((intent.clave && intent.clave !== identity.clave) || (intent.consecutive && intent.consecutive !== identity.consecutive)) {
    throw recoveryError('FISCAL_RECOVERY_IDENTIFIER_CONFLICT', 'Billing identifiers conflict with local fiscal evidence');
  }
  return hash;
}

function originalImmutableFiscalPayload(intent) {
  const snapshot = intent?.invoice?.fiscalSnapshot;
  if (!snapshot) {
    throw recoveryError('FISCAL_RECOVERY_EVIDENCE_UNAVAILABLE', 'Immutable fiscal snapshot is unavailable');
  }
  let fiscalPayload;
  try {
    fiscalPayload = buildBillingFiscalDocumentPayload(snapshot);
  } catch (_error) {
    throw recoveryError('FISCAL_RECOVERY_EVIDENCE_UNAVAILABLE', 'Immutable fiscal evidence is invalid');
  }
  if (hashBillingPayload(fiscalPayload) !== originalPayloadHash(intent)) {
    throw recoveryError('FISCAL_RECOVERY_EVIDENCE_MISMATCH', 'Immutable fiscal evidence does not match the original request hash');
  }
  return fiscalPayload;
}

function assertVerifiedEvidenceIdentity(intent, identity) {
  const config = intent.integrationConfig;
  originalPayloadHash(intent);
  if (!identity || identity.fiscalPayloadEquivalent !== true || identity.equivalenceContractVersion !== FISCAL_PAYLOAD_EQUIVALENCE_VERSION || identity.reservationStatus !== 'COMPLETED') {
    throw recoveryError('FISCAL_RECOVERY_UNVERIFIED_EVIDENCE', 'Billing did not prove fiscal payload equivalence');
  }
  if (identity.companyId !== config?.billingCompanyId || String(identity.environment).toUpperCase() !== String(config?.billingEnvironment).toUpperCase()) {
    throw recoveryError('FISCAL_RECOVERY_BINDING_MISMATCH', 'Billing identity company or environment mismatch');
  }
  if (identity.documentType !== 'INVOICE' || identity.operation !== INVOICE_CREATE_OPERATION || identity.idempotencyKey !== intent.idempotencyKey) {
    throw recoveryError('FISCAL_RECOVERY_IDEMPOTENCY_MISMATCH', 'Billing identity does not match the original issuance operation');
  }
  if (typeof identity.fiscalDocumentId !== 'string' || !identity.fiscalDocumentId || typeof identity.clave !== 'string' || !identity.clave || typeof identity.consecutive !== 'string' || !identity.consecutive) {
    throw recoveryError('FISCAL_RECOVERY_INCOMPLETE_IDENTITY', 'Billing identity is incomplete');
  }
  if ((intent.clave && intent.clave !== identity.clave) || (intent.consecutive && intent.consecutive !== identity.consecutive)) {
    throw recoveryError('FISCAL_RECOVERY_IDENTIFIER_CONFLICT', 'Billing identifiers conflict with local fiscal evidence');
  }
}

function mapRemoteStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (['ACCEPTED', 'HACIENDA_ACCEPTED', 'ACEPTADO'].includes(normalized)) return 'ACCEPTED';
  if (['REJECTED', 'HACIENDA_REJECTED', 'RECHAZADO'].includes(normalized)) return 'REJECTED';
  return 'PROCESSING';
}

function classifyDiscoveryFailure(error) {
  const status = Number(error?.statusCode);
  if (error instanceof BillingClientError && (error.retryable || status === 500 || status === 408 || status === 429)) return { outcome: 'RETRYABLE_DISCOVERY', code: error.code };
  if (status === 404) return { outcome: 'OPERATOR_REVIEW', code: 'FISCAL_RECOVERY_IDENTITY_NOT_FOUND' };
  if (status === 409) return { outcome: 'OPERATOR_REVIEW', code: 'FISCAL_RECOVERY_IDENTITY_CONFLICT' };
  return { outcome: 'OPERATOR_REVIEW', code: error?.code || 'FISCAL_RECOVERY_LOOKUP_FAILED' };
}

async function loadIntent(intentId, db) {
  return db.invoiceFiscalIntent.findUnique({ where: { id: intentId }, include: { integrationConfig: true, invoice: { include: { fiscalSnapshot: true } } } });
}

async function associateVerifiedIdentity(intent, identity, options = {}) {
  const db = options.db || prisma;
  const now = options.now || new Date();
  const existing = await db.invoiceFiscalIntent.findFirst({ where: { billingIntegrationConfigId: intent.billingIntegrationConfigId, billingFiscalDocumentId: identity.fiscalDocumentId, id: { not: intent.id } }, select: { id: true } });
  if (existing) throw recoveryError('FISCAL_RECOVERY_REMOTE_ID_CONFLICT', 'Billing fiscal document is associated to another local intent');
  const localStatus = mapRemoteStatus(identity.status);
  const metadata = {
    ...jsonObject(intent.metadata),
    recovery: {
      contractVersion: options.contractVersion || BILLING_LOOKUP_CONTRACT_VERSION,
      operation: INVOICE_CREATE_OPERATION,
      associatedAt: now.toISOString(),
      remoteStatus: identity.status,
      originalFailureCode: intent.failureCode || null,
      originalFailureMessage: intent.failureMessage || null,
      operatorReason: options.operatorReason || null,
    },
  };
  const result = await db.invoiceFiscalIntent.updateMany({
    where: { id: intent.id, status: { in: ['ERROR_FINAL', 'ERROR_RETRYABLE'] }, billingFiscalDocumentId: null },
    data: {
      status: localStatus,
      billingFiscalDocumentId: identity.fiscalDocumentId,
      clave: identity.clave,
      consecutive: identity.consecutive,
      billingStatus: identity.status,
      failureCode: null,
      failureMessage: null,
      nextAttemptAt: localStatus === 'PROCESSING' ? now : null,
      lastSyncAt: now,
      metadata,
    },
  });
  if (result.count !== 1) return { associated: false, reason: 'CONCURRENT_UPDATE' };
  return { associated: true, status: localStatus, metadata };
}

async function recoverFiscalIntentIdentity(intentId, dependencies, options = {}) {
  const db = options.db || prisma;
  const intent = await loadIntent(intentId, db);
  if (!intent) throw recoveryError('FISCAL_RECOVERY_NOT_FOUND', 'Fiscal intent was not found');
  if (!['ERROR_FINAL', 'ERROR_RETRYABLE'].includes(intent.status) || intent.billingFiscalDocumentId) return { recovered: false, reason: 'NOT_ELIGIBLE' };
  if (!intent.integrationConfig?.enabled) return { recovered: false, reason: 'OPERATOR_REVIEW', code: 'BILLING_CONFIG_DISABLED' };
  const requestHash = originalPayloadHash(intent);
  let identity;
  let contractVersion = BILLING_LOOKUP_CONTRACT_VERSION;
  try {
    identity = await dependencies.billingClient.lookupFiscalIdentityByIdempotency({
      billingCompanyId: intent.integrationConfig.billingCompanyId,
      environment: intent.integrationConfig.billingEnvironment,
      secretReference: intent.integrationConfig.billingCredentialSecretRef,
      idempotencyKey: intent.idempotencyKey,
      requestHash,
      correlationId: `inventori-fiscal-recovery-${intent.id.toString()}`,
    });
    assertVerifiedIdentity(intent, identity);
  } catch (error) {
    const isVerifiedV1NotFound = error instanceof BillingClientError
      && Number(error.statusCode) === 404
      && error.code === 'FISCAL_IDENTITY_NOT_FOUND';
    if (!isVerifiedV1NotFound || !intent.invoice?.fiscalSnapshot) return { recovered: false, ...classifyDiscoveryFailure(error) };
    let fiscalPayload;
    try {
      fiscalPayload = originalImmutableFiscalPayload(intent);
      identity = await dependencies.billingClient.lookupFiscalIdentityByEvidence({
        billingCompanyId: intent.integrationConfig.billingCompanyId,
        environment: intent.integrationConfig.billingEnvironment,
        secretReference: intent.integrationConfig.billingCredentialSecretRef,
        idempotencyKey: intent.idempotencyKey,
        operation: INVOICE_CREATE_OPERATION,
        equivalenceContractVersion: FISCAL_PAYLOAD_EQUIVALENCE_VERSION,
        fiscalPayload,
        correlationId: `inventori-fiscal-recovery-evidence-${intent.id.toString()}`,
      });
      assertVerifiedEvidenceIdentity(intent, identity);
      contractVersion = FISCAL_PAYLOAD_EQUIVALENCE_VERSION;
    } catch (evidenceError) {
      return { recovered: false, ...classifyDiscoveryFailure(evidenceError) };
    }
  }
  const result = await associateVerifiedIdentity(intent, identity, { db, now: options.now, operatorReason: options.operatorReason, contractVersion });
  if (result.associated) {
    await audit.recordAuditEventSafelyIfAvailable({
      req: options.req,
      action: 'fiscal.identity.recovery.associated', resourceType: 'invoice_fiscal_intent', resourceId: intent.id,
      outcome: 'SUCCESS', reasonCode: 'BILLING_IDENTITY_VERIFIED',
      metadata: { billingFiscalDocumentId: identity.fiscalDocumentId, remoteStatus: identity.status, contractVersion, originalFailureCode: intent.failureCode || null, operatorReason: options.operatorReason || null },
    });
  }
  return { recovered: result.associated, ...result, billingFiscalDocumentId: identity.fiscalDocumentId };
}

module.exports = { BILLING_LOOKUP_CONTRACT_VERSION, FISCAL_PAYLOAD_EQUIVALENCE_VERSION, INVOICE_CREATE_OPERATION, originalPayloadHash, originalImmutableFiscalPayload, assertVerifiedIdentity, assertVerifiedEvidenceIdentity, classifyDiscoveryFailure, associateVerifiedIdentity, recoverFiscalIntentIdentity };
