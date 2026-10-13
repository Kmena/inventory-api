/**
 * DEV-ONLY: Creates a CompanyBillingIntegrationConfig for a company that
 * doesn't have one yet, using the existing SANDBOX credentials.
 *
 * Safe to re-run (upsert). Does NOT modify Billing or Hacienda.
 * Does NOT create real fiscal documents.
 *
 * Usage:
 *   node scripts/setup-dev-billing-config.js [companyId]
 *   (defaults to company 1 — "Inventori Demo")
 */
'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// The sandbox billing IDs already configured and working in dev
// (same as the sandbox_fiscal_admin company, id=1698)
const SANDBOX_BILLING_TENANT_ID = '25ae538c-b272-407b-83d0-ccc78be3c658';
const SANDBOX_BILLING_COMPANY_ID = 'dde91f44-6ceb-4eb7-b322-0139919cc34d';
const SANDBOX_SECRET_REF        = 'env:BILLING_SANDBOX_M2M_API_KEY';
const BILLING_ENVIRONMENT       = 'SANDBOX';

async function main() {
  const targetCompanyId = BigInt(process.argv[2] || '1');

  const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
  if (!company) {
    console.error(`Company id=${targetCompanyId} not found.`);
    process.exit(1);
  }
  console.log(`Company: id=${company.id} name="${company.name}"`);

  const existing = await prisma.companyBillingIntegrationConfig.findUnique({
    where: { companyId: targetCompanyId },
  });

  if (existing) {
    console.log(`Already has billing config (id=${existing.id}, enabled=${existing.enabled}).`);
    if (!existing.enabled) {
      await prisma.companyBillingIntegrationConfig.update({
        where: { companyId: targetCompanyId },
        data:  { enabled: true },
      });
      console.log('→ Enabled the existing config.');
    } else {
      console.log('Nothing to do.');
    }
    return;
  }

  const config = await prisma.companyBillingIntegrationConfig.create({
    data: {
      companyId:                   targetCompanyId,
      billingTenantId:             SANDBOX_BILLING_TENANT_ID,
      billingCompanyId:            SANDBOX_BILLING_COMPANY_ID,
      billingEnvironment:          BILLING_ENVIRONMENT,
      billingCredentialSecretRef:  SANDBOX_SECRET_REF,
      enabled:                     true,
      readinessStatus:             'UNKNOWN',
    },
  });

  console.log(`✅ Created billing config id=${config.id} for company id=${targetCompanyId}.`);
  console.log(`   environment=${config.billingEnvironment}`);
  console.log(`   secretRef=${config.billingCredentialSecretRef}`);
  console.log(`\nNOTE: Billing is at localhost:3000. If it is not running, the fiscal`);
  console.log(`settings page will load but show empty/unavailable data — which is fine for dev.`);
}

main()
  .catch((err) => { console.error('Error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
