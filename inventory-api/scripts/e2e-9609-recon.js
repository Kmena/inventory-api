'use strict';
/**
 * E2E-9609 Reconnaissance — finds all relevant data for the 9609 activity E2E.
 * READ-ONLY: zero mutations.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

async function main() {
  console.log('=== E2E-9609 RECON ===\n');

  // 1) Company 1698
  const company = await p.company.findUnique({
    where: { id: 1698n },
    include: { fiscalConfig: true, billingIntegrationConfig: true },
  });
  console.log('Company 1698:', j(company ? { id: company.id, name: company.name, billingEnabled: company.billingIntegrationConfig?.enabled, billingEnv: company.billingIntegrationConfig?.billingEnvironment } : null));

  // 2) Legal entities with 9609 activity
  const entities = await p.clientLegalEntity.findMany({
    where: { economicActivities: { some: { code: { contains: '9609' } } } },
    include: {
      economicActivities: { where: { code: { contains: '9609' } } },
      clients: { select: { id: true, name: true, companyId: true } },
    },
    take: 10,
  });
  console.log('\nLegal entities with 9609 activity:');
  for (const e of entities) {
    console.log(' -', j({ id: e.id, name: e.name, idNum: e.identificationNumber, activities: e.economicActivities.map(a => a.code), clients: e.clients }));
  }

  // 3) Clients with economicActivityCode containing 9609
  const clients = await p.client.findMany({
    where: { economicActivityCode: { contains: '9609' } },
    select: { id: true, name: true, economicActivityCode: true, companyId: true },
    take: 10,
  });
  console.log('\nClients with 9609 code:', j(clients));

  // 4) Check sample of economic activity codes in the DB
  const actCodes = await p.clientLegalEntityEconomicActivity.findMany({
    select: { code: true, legalEntityId: true },
    take: 30,
    orderBy: { code: 'asc' },
  });
  console.log('\nSample activity codes (first 30):', actCodes.map(a => a.code));

  // 5) Orders APPROVED for company 1698 (excluding already-invoiced)
  const orders = await p.order.findMany({
    where: {
      companyId: 1698n,
      status: 'APPROVED',
      invoices: { none: {} },
    },
    select: {
      id: true,
      status: true,
      paymentCondition: true,
      clientId: true,
      clientStoreId: true,
    },
    take: 5,
  });
  console.log('\nAPPROVED orders (company 1698, no invoices):', j(orders));

  // 6) Check the snapshot model for selectedEconomicActivityCode field
  const snapSample = await p.invoiceFiscalSnapshot.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, receiverSnapshot: true },
  });
  if (snapSample) {
    const rec = snapSample.receiverSnapshot;
    console.log('\nLatest snapshot receiver fields:', Object.keys(rec || {}));
    console.log('selectedEconomicActivityCode present:', 'selectedEconomicActivityCode' in (rec || {}));
    console.log('economicActivityCode present:', 'economicActivityCode' in (rec || {}));
    console.log('selectedEconomicActivityCode value:', rec?.selectedEconomicActivityCode);
    console.log('economicActivityCode value:', rec?.economicActivityCode);
  }

  // 7) Check if there's any order for clients with 9609 activity
  if (entities.length > 0) {
    const clientIds = entities.map(e => e.client?.id).filter(Boolean);
    const ordersForClients = await p.order.findMany({
      where: { clientId: { in: clientIds }, status: 'APPROVED', invoices: { none: {} } },
      select: { id: true, status: true, clientId: true, paymentCondition: true, companyId: true },
      take: 5,
    });
    console.log('\nAPPROVED orders for 9609-activity clients:', j(ordersForClients));
  }

  // 8) Recent successful ACCEPTED fiscal intents to understand the XML flow
  const acceptedIntents = await p.invoiceFiscalIntent.findMany({
    where: { status: 'ACCEPTED' },
    select: {
      id: true,
      clave: true,
      consecutive: true,
      billingFiscalDocumentId: true,
      invoiceId: true,
    },
    orderBy: { id: 'desc' },
    take: 3,
  });
  console.log('\nRecent ACCEPTED intents:', j(acceptedIntents));

  await p.$disconnect();
  console.log('\n=== RECON COMPLETE ===');
}

main().catch((e) => {
  process.stderr.write(e.stack + '\n');
  process.exit(1);
});
