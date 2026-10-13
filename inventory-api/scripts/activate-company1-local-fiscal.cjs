/* global process */
'use strict';

const crypto = require('node:crypto');
const prisma = require('../src/lib/prisma');
const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');
const { BillingManagedCredentialStore } = require('../src/services/billing-managed-credential-store.service');
const fiscalSettings = require('../src/services/fiscal-settings.service');

const EXPECTED = Object.freeze({
  sourceCompanyId: 1698n, targetCompanyId: 1n,
  sourceAssociationId: 1684n, targetAssociationId: 1686n,
  tenantId: '25ae538c-b272-407b-83d0-ccc78be3c658',
  billingCompanyId: 'dde91f44-6ceb-4eb7-b322-0139919cc34d',
  environment: 'SANDBOX', identificationType: '01',
  billingIdentificationType: 'FISICA', identificationNumber: '207530251',
  legalName: 'PERSONA FISICA SANDBOX', externalCompanyKey: 'inventori:company:1',
});
const EXECUTION_AUTHORIZATION = 'AUTHORIZE_LOCAL_COMPANY1_INVENTORI_ACTIVATION';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}

function sameTuple(row) {
  return row.billingTenantId === EXPECTED.tenantId
    && row.billingCompanyId === EXPECTED.billingCompanyId
    && row.billingEnvironment === EXPECTED.environment;
}

async function assertDatabaseBoundary(mode) {
  const rows = await prisma.$queryRaw`
    SELECT current_database() AS database_name,
      coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()), 'pg_database'),'') AS marker
  `;
  const databaseName = rows[0]?.database_name;
  if (mode === 'REHEARSAL') {
    if (databaseName === 'tracksys') throw new Error('Rehearsal refuses normal tracksys');
    if (!String(rows[0]?.marker || '').startsWith('inventori-disposable:')) {
      throw new Error('Disposable Inventori database marker is missing');
    }
    return databaseName;
  }
  if (mode !== 'EXECUTE_LOCAL' || databaseName !== 'tracksys') {
    throw new Error('Normal execution is restricted to verified local tracksys');
  }
  if (required('COMPANY1_ACTIVATION_AUTHORIZATION') !== EXECUTION_AUTHORIZATION) {
    throw new Error('Explicit local execution authorization is missing');
  }
  return databaseName;
}

async function loadState(db = prisma) {
  const [source, target, targetCompany] = await Promise.all([
    db.companyBillingIntegrationConfig.findUnique({ where: { id: EXPECTED.sourceAssociationId } }),
    db.companyBillingIntegrationConfig.findUnique({ where: { id: EXPECTED.targetAssociationId } }),
    db.company.findUnique({ where: { id: EXPECTED.targetCompanyId }, include: { fiscalConfig: true } }),
  ]);
  if (!source || !target || !targetCompany?.fiscalConfig) throw new Error('Inventori activation baseline is incomplete');
  if (source.companyId !== EXPECTED.sourceCompanyId || target.companyId !== EXPECTED.targetCompanyId) {
    throw new Error('Inventori association ownership mismatch');
  }
  if (!sameTuple(source) || !sameTuple(target)) throw new Error('Inventori Billing tuple mismatch');
  return { source, target, targetCompany };
}

async function verifyHistoricalIdentity() {
  const rows = await prisma.$queryRaw`
    SELECT id::text, status::text, clave
    FROM invoice_fiscal_intents
    WHERE company_id = 1 AND status = 'ACCEPTED'
    ORDER BY id
  `;
  if (rows.length !== 2 || rows.some((row) => !String(row.clave || '').includes(EXPECTED.identificationNumber))) {
    throw new Error('Company 1 accepted fiscal identity evidence does not match target taxpayer');
  }
  return rows.map((row) => row.id);
}

async function recordAudit(tx, action, companyId, resourceId, beforeState, afterState) {
  await tx.auditEvent.create({ data: {
    requestId: crypto.randomUUID(), actorUserId: 3n, actorUsername: 'admin', actorRoleCode: 'admin',
    companyId, action, resourceType: 'company_billing_integration_config',
    resourceId: resourceId.toString(), outcome: 'SUCCESS',
    reasonCode: 'authorized_company1_local_fiscal_activation', beforeState, afterState,
    metadata: { billingTenantId: EXPECTED.tenantId, billingEnvironment: EXPECTED.environment },
  } });
}

async function markSourceHistorical() {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended('company1-final-fiscal-activation:inventori', 0))
    `;
    const { source, target } = await loadState(tx);
    if (source.associationStatus === 'HISTORICAL_ONLY' && source.enabled === false) return false;
    if (source.associationStatus !== 'ACTIVE' || source.enabled !== true
      || target.associationStatus !== 'HISTORICAL_ONLY' || target.enabled !== false) {
      throw new Error('Inventori source/target lifecycle precondition mismatch');
    }
    await tx.companyBillingIntegrationConfig.update({
      where: { id: EXPECTED.sourceAssociationId },
      data: { enabled: false, associationStatus: 'HISTORICAL_ONLY', readinessStatus: 'UNKNOWN', readinessCheckedAt: null },
    });
    await recordAudit(tx, 'fiscal-association.source-marked-historical', EXPECTED.sourceCompanyId,
      EXPECTED.sourceAssociationId,
      { associationId: '1684', enabled: true, associationStatus: 'ACTIVE' },
      { associationId: '1684', enabled: false, associationStatus: 'HISTORICAL_ONLY' });
    return true;
  }, { isolationLevel: 'Serializable' });
}

async function bootstrapAndVerify() {
  const billingClient = new BillingApiClient({
    baseUrl: required('BILLING_BASE_URL'),
    credentialResolver: createBillingCredentialResolver(),
    timeoutMs: Number(process.env.BILLING_TIMEOUT_MS) || 10000,
  });
  const bootstrap = await billingClient.bootstrapFiscalIssuer({
    secretReference: required('BILLING_BOOTSTRAP_SECRET_REF'), correlationId: crypto.randomUUID(),
    payload: {
      externalCompanyKey: EXPECTED.externalCompanyKey, existingCompanyId: EXPECTED.billingCompanyId,
      legalName: EXPECTED.legalName, identificationType: EXPECTED.billingIdentificationType,
      identificationNumber: EXPECTED.identificationNumber, environment: EXPECTED.environment,
    },
  });
  if (bootstrap.association.company.id !== EXPECTED.billingCompanyId
    || bootstrap.association.company.tenantId !== EXPECTED.tenantId
    || bootstrap.association.externalCompanyKey !== EXPECTED.externalCompanyKey) {
    throw new Error('Billing bootstrap canonical association mismatch');
  }
  const store = new BillingManagedCredentialStore();
  const reference = store.store(bootstrap.credential.secret);
  try {
    const issuer = await billingClient.getFiscalIssuerV1({
      billingCompanyId: EXPECTED.billingCompanyId, environment: EXPECTED.environment,
      secretReference: reference, correlationId: crypto.randomUUID(),
    });
    const readiness = await billingClient.getFiscalReadinessV1({
      billingCompanyId: EXPECTED.billingCompanyId, environment: EXPECTED.environment,
      secretReference: reference, correlationId: crypto.randomUUID(),
    });
    if (issuer.company.identificationType !== EXPECTED.billingIdentificationType
      || issuer.company.identificationNumber !== EXPECTED.identificationNumber
      || readiness.readyToIssue !== true || readiness.status !== 'READY') {
      throw new Error('New company 1 M2M credential failed canonical verification');
    }
    for (const probe of [
      { billingCompanyId: '00000000-0000-0000-0000-000000000001', environment: EXPECTED.environment },
      { billingCompanyId: EXPECTED.billingCompanyId, environment: 'PRODUCTION' },
    ]) {
      let denied = false;
      try {
        await billingClient.getFiscalIssuerV1({ ...probe, secretReference: reference, correlationId: crypto.randomUUID() });
      } catch (error) {
        denied = error instanceof BillingClientError && [401, 403, 404].includes(error.statusCode);
      }
      if (!denied) throw new Error('New M2M credential isolation probe did not fail closed');
    }
    return { reference, apiKeyId: bootstrap.credential.apiKeyId, readiness, isolationVerified: true };
  } catch (error) {
    store.remove(reference);
    throw error;
  }
}

async function activateTarget(credential) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended('company1-final-fiscal-activation:inventori', 0))
    `;
    const { source, target, targetCompany } = await loadState(tx);
    if (source.associationStatus !== 'HISTORICAL_ONLY' || source.enabled !== false) {
      throw new Error('Source association is not safely historical');
    }
    if (target.associationStatus === 'ACTIVE' && target.enabled === true) {
      if (target.billingCredentialSecretRef !== credential.reference) {
        throw new Error('Target is active with a different credential reference');
      }
      return false;
    }
    if (target.associationStatus !== 'HISTORICAL_ONLY' || target.enabled !== false) {
      throw new Error('Target association lifecycle precondition mismatch');
    }
    await tx.company.update({ where: { id: EXPECTED.targetCompanyId }, data: { legalId: EXPECTED.identificationNumber } });
    await tx.companyFiscalConfig.update({
      where: { companyId: EXPECTED.targetCompanyId },
      data: { legalName: EXPECTED.legalName, identificationType: EXPECTED.identificationType,
        identificationNumber: EXPECTED.identificationNumber, haciendaEnvironment: 'STAGING' },
    });
    await tx.companyBillingIntegrationConfig.update({
      where: { id: EXPECTED.targetAssociationId },
      data: { billingCredentialSecretRef: credential.reference, enabled: true,
        associationStatus: 'ACTIVE', readinessStatus: 'READY',
        readinessCheckedAt: new Date(credential.readiness.checkedAt), lastErrorCode: null, lastErrorMessage: null },
    });
    await recordAudit(tx, 'fiscal-association.target-activated', EXPECTED.targetCompanyId,
      EXPECTED.targetAssociationId,
      { associationId: '1686', enabled: false, associationStatus: 'HISTORICAL_ONLY',
        identificationType: targetCompany.fiscalConfig.identificationType,
        identificationNumber: targetCompany.fiscalConfig.identificationNumber },
      { associationId: '1686', enabled: true, associationStatus: 'ACTIVE',
        identificationType: EXPECTED.identificationType, identificationNumber: EXPECTED.identificationNumber,
        credentialReference: '[REDACTED]' });
    return true;
  }, { isolationLevel: 'Serializable' });
}

async function verifyFinalState() {
  const { source, target, targetCompany } = await loadState();
  const activeCount = await prisma.companyBillingIntegrationConfig.count({ where: {
    billingTenantId: EXPECTED.tenantId, billingCompanyId: EXPECTED.billingCompanyId,
    billingEnvironment: EXPECTED.environment, enabled: true, associationStatus: 'ACTIVE',
  } });
  if (activeCount !== 1 || source.enabled || source.associationStatus !== 'HISTORICAL_ONLY'
    || !target.enabled || target.associationStatus !== 'ACTIVE'
    || targetCompany.legalId !== EXPECTED.identificationNumber
    || targetCompany.fiscalConfig.identificationType !== EXPECTED.identificationType
    || targetCompany.fiscalConfig.identificationNumber !== EXPECTED.identificationNumber) {
    throw new Error('Final Inventori association or identity invariant failed');
  }
  const targetView = await fiscalSettings.getFiscalAdministration({ companyId: '1' }, { correlationId: crypto.randomUUID() });
  const sourceView = await fiscalSettings.getFiscalAdministration({ companyId: '1698' }, { correlationId: crypto.randomUUID() });
  if (targetView.association.status !== 'ASSOCIATED'
    || targetView.issuer.identificationNumber !== EXPECTED.identificationNumber
    || sourceView.association.status !== 'HISTORICAL_ONLY') {
    throw new Error('Inventori canonical read-back or historical guard failed');
  }
  let sourceReadinessDenied = false;
  try {
    await fiscalSettings.getFiscalReadiness({ companyId: '1698' }, { correlationId: crypto.randomUUID() });
  } catch (error) {
    sourceReadinessDenied = error?.code === 'BILLING_INTEGRATION_DISABLED'
      || error?.code === 'BILLING_ASSOCIATION_HISTORICAL_ONLY';
  }
  if (!sourceReadinessDenied) throw new Error('Company 1698 readiness did not fail closed');
  return { activeCount, source, target };
}

async function main() {
  const mode = required('COMPANY1_ACTIVATION_MODE');
  const phase = String(process.env.COMPANY1_ACTIVATION_PHASE || 'ACTIVATE').trim().toUpperCase();
  const databaseName = await assertDatabaseBoundary(mode);
  const historicalIntentIds = await verifyHistoricalIdentity();
  if (phase === 'DISABLE_SOURCE') {
    const sourceChanged = await markSourceHistorical();
    process.stdout.write(`${JSON.stringify({ operation: 'inventori-company1-disable-source', mode,
      databaseName, changed: sourceChanged, association1684: 'HISTORICAL_ONLY', historicalIntentIds })}\n`);
    return;
  }
  if (phase !== 'ACTIVATE') throw new Error('Unsupported activation phase');
  const initial = await loadState();
  if (initial.target.enabled && initial.target.associationStatus === 'ACTIVE') {
    const final = await verifyFinalState();
    process.stdout.write(`${JSON.stringify({ operation: 'inventori-company1-activation', mode,
      databaseName, changed: false, activeCount: final.activeCount, historicalIntentIds })}\n`);
    return;
  }
  const sourceChanged = await markSourceHistorical();
  const credential = await bootstrapAndVerify();
  let targetChanged = false;
  try { targetChanged = await activateTarget(credential); }
  catch (error) {
    throw new Error(`Target activation failed after secure handoff; preserved managed reference for controlled recovery: ${error instanceof Error ? error.message : 'unknown'}`);
  }
  const final = await verifyFinalState();
  process.stdout.write(`${JSON.stringify({
    operation: 'inventori-company1-activation', mode, databaseName,
    changed: sourceChanged || targetChanged, sourceChanged, targetChanged,
    activeCount: final.activeCount, association1684: final.source.associationStatus,
    association1686: final.target.associationStatus, readiness: final.target.readinessStatus,
    apiKeyId: credential.apiKeyId, isolationVerified: credential.isolationVerified,
    sourceIssuanceGuard: true, historicalIntentIds,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`INVENTORI_COMPANY1_ACTIVATION_FAILED: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect().catch(() => undefined); });
