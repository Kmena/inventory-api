'use strict';
/**
 * E2E-9609 Full state inspection — READ ONLY.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

async function main() {
  const CID = 1698n;
  console.log('=== STATE INSPECTION — company 1698 ===\n');

  // Company config
  const bc = await p.companyBillingIntegrationConfig.findFirst({ where: { companyId: CID } });
  console.log('BillingConfig:', j({ enabled: bc?.enabled, env: bc?.billingEnvironment, companyId: bc?.billingCompanyId }));

  // Products
  const products = await p.product.findMany({
    where: { companyId: CID, isActive: true },
    select: { id: true, code: true, name: true, cabysCode: true, taxRate: true, unit: true },
  });
  console.log('\nProducts:', j(products));

  // Clients
  const clients = await p.client.findMany({
    where: { companyId: CID },
    include: { legalEntity: true },
  });
  console.log('\nClients:');
  for (const c of clients) {
    console.log(' -', j({ id: c.id, name: c.name, legalEntity: c.legalEntity ? {
      id: c.legalEntity.id,
      name: c.legalEntity.legalName,
      idType: c.legalEntity.identificationType,
      idNum: c.legalEntity.identificationNumber,
      economicActivityCode: c.legalEntity.economicActivityCode,
    } : null }));
  }

  // Orders
  const orders = await p.order.findMany({
    where: { companyId: CID },
    include: {
      fiscalApproval: true,
      invoices: { include: { fiscalIntent: true, fiscalSnapshot: true } },
    },
    orderBy: { id: 'desc' },
    take: 5,
  });
  console.log('\nRecent orders (newest first):');
  for (const o of orders) {
    const invCount = o.invoices.length;
    const intentStatus = o.invoices[0]?.fiscalIntent?.status;
    const clave = o.invoices[0]?.fiscalIntent?.clave;
    const docId = o.invoices[0]?.fiscalIntent?.billingFiscalDocumentId;
    const approvalActivity = o.fiscalApproval?.receiverEconomicActivityCode;
    console.log(' -', j({ id: o.id, status: o.status, paymentCondition: o.paymentCondition, invoices: invCount, intentStatus, clave, docId, approvalActivity }));
  }

  // ClientLegalEntity fields inspection
  const entity = await p.clientLegalEntity.findFirst({ where: { companyId: CID } });
  if (entity) {
    console.log('\nLegalEntity fields:', j(entity));
  }

  // OrderFiscalApproval sample fields
  const ofa = await p.orderFiscalApproval.findFirst({ orderBy: { id: 'desc' } });
  if (ofa) {
    console.log('\nOrderFiscalApproval sample:', j(ofa));
  } else {
    console.log('\nNo OrderFiscalApproval records found');
  }

  // Warehouse stock for sandbox product
  if (products.length > 0) {
    const stock = await p.warehouseStock.findMany({
      where: { productId: products[0].id },
      select: { quantity: true, reservedQuantity: true, warehouse: { select: { name: true } } },
    });
    console.log('\nWarehouseStock for product[0]:', j(stock));
  }

  // Scheduler state
  const [pending, retryable, processing] = await Promise.all([
    p.invoiceFiscalIntent.count({ where: { status: 'PENDING' } }),
    p.invoiceFiscalIntent.count({ where: { status: 'ERROR_RETRYABLE' } }),
    p.invoiceFiscalIntent.count({ where: { status: 'PROCESSING' } }),
  ]);
  console.log('\nScheduler state: PENDING=' + pending + ' ERROR_RETRYABLE=' + retryable + ' PROCESSING=' + processing);

  await p.$disconnect();
  console.log('\n=== DONE ===');
}

main().catch((e) => { process.stderr.write(e.stack + '\n'); process.exit(1); });
