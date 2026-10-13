/* global process */
'use strict';

const crypto = require('node:crypto');
const { PrismaClient } = require('/app/node_modules/@prisma/client');

const EXPECTED = Object.freeze({
  tenantId: '25ae538c-b272-407b-83d0-ccc78be3c658',
  companyId: 'dde91f44-6ceb-4eb7-b322-0139919cc34d',
  associationId: '4a74176b-a511-4e27-bfbd-e9ffc1d4f68e',
  sourceExternalKey: 'inventori:company:1698',
  targetExternalKey: 'inventori:company:1',
  profileVersion: 'inventori-fiscal-v1',
});

const EXECUTION_AUTHORIZATION = 'AUTHORIZE_LOCAL_COMPANY1_BILLING_ASSOCIATION_TRANSFER';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}

async function assertDatabaseBoundary(prisma, mode) {
  const rows = await prisma.$queryRaw`SELECT current_database() AS database_name`;
  const databaseName = rows[0]?.database_name;
  if (mode === 'REHEARSAL') {
    if (databaseName === 'billing_dev') throw new Error('Rehearsal refuses normal billing_dev');
    const marker = await prisma.$queryRaw`
      SELECT to_regclass('billing_test_safety.marker')::text AS marker_table
    `;
    if (marker[0]?.marker_table !== 'billing_test_safety.marker') {
      throw new Error('Disposable Billing database marker is missing');
    }
    return databaseName;
  }
  if (mode !== 'EXECUTE_LOCAL' || databaseName !== 'billing_dev') {
    throw new Error('Normal execution is restricted to verified local billing_dev');
  }
  if (required('COMPANY1_ACTIVATION_AUTHORIZATION') !== EXECUTION_AUTHORIZATION) {
    throw new Error('Explicit local execution authorization is missing');
  }
  return databaseName;
}

async function main() {
  const mode = required('COMPANY1_ACTIVATION_MODE');
  const prisma = new PrismaClient();
  try {
    const databaseName = await assertDatabaseBoundary(prisma, mode);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended('company1-final-fiscal-activation:billing', 0))
      `;
      const association = await tx.fiscalIntegrationAssociation.findUnique({
        where: { id: EXPECTED.associationId },
      });
      if (!association
        || association.tenantId !== EXPECTED.tenantId
        || association.companyId !== EXPECTED.companyId
        || association.provider !== 'INVENTORI'
        || association.profileVersion !== EXPECTED.profileVersion) {
        throw new Error('Billing association precondition mismatch');
      }
      if (![EXPECTED.sourceExternalKey, EXPECTED.targetExternalKey].includes(association.externalCompanyKey)) {
        throw new Error('Unexpected Billing external company key');
      }
      const competing = await tx.fiscalIntegrationAssociation.count({
        where: {
          tenantId: EXPECTED.tenantId,
          provider: 'INVENTORI',
          externalCompanyKey: EXPECTED.targetExternalKey,
          id: { not: EXPECTED.associationId },
        },
      });
      if (competing !== 0) throw new Error('Competing target Billing association exists');
      if (association.externalCompanyKey === EXPECTED.targetExternalKey) {
        return { changed: false, association };
      }
      const updated = await tx.fiscalIntegrationAssociation.update({
        where: { id: EXPECTED.associationId },
        data: { externalCompanyKey: EXPECTED.targetExternalKey },
      });
      await tx.auditLog.create({
        data: {
          id: crypto.randomUUID(), tenantId: EXPECTED.tenantId, companyId: EXPECTED.companyId,
          actor: `local-operator:${process.env.USERNAME || 'codex'}`,
          action: 'fiscal-onboarding.integration-association-reassigned',
          resource: `FiscalIntegrationAssociation:${EXPECTED.associationId}`,
          eventClass: 'SECURITY',
          metadata: {
            sourceExternalCompanyKey: EXPECTED.sourceExternalKey,
            targetExternalCompanyKey: EXPECTED.targetExternalKey,
            reason: 'authorized-company1-local-fiscal-activation',
          },
        },
      });
      return { changed: true, association: updated };
    }, { isolationLevel: 'Serializable' });

    process.stdout.write(`${JSON.stringify({
      operation: 'billing-integration-association-transfer', mode, databaseName,
      changed: result.changed, associationId: result.association.id,
      externalCompanyKey: result.association.externalCompanyKey,
      tenantId: result.association.tenantId, companyId: result.association.companyId,
      profileVersion: result.association.profileVersion,
    })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`BILLING_ASSOCIATION_TRANSFER_FAILED: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
