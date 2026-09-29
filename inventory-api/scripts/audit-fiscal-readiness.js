'use strict';
/**
 * Steps 8, 9, 10 — Inventori Local Readiness, Candidate Order Discovery, Scheduler State
 *
 * SAFE — read-only. No dispatch, no invoice creation, no fiscal intent creation.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });
const s = (k, v) => (typeof v === 'bigint' ? v.toString() : v);

const COMPANY_ID = 1n; // Inventori Demo company

async function main() {
  // ─── STEP 8: Billing Integration Config ────────────────────────────────────
  process.stdout.write('=== STEP 8 — Company Billing Integration Config ===\n');
  const billingConfig = await prisma.companyBillingIntegrationConfig.findUnique({
    where: { companyId: COMPANY_ID },
  });
  process.stdout.write('billingIntegrationConfig: ' + JSON.stringify(billingConfig, s, 2) + '\n');
  process.stdout.write('integrationEnabled: ' + Boolean(billingConfig?.enabled) + '\n');
  process.stdout.write('billingMappingPresent: ' + Boolean(
    billingConfig?.billingTenantId && billingConfig?.billingCompanyId
  ) + '\n');
  process.stdout.write('credentialRefPresent: ' + Boolean(billingConfig?.billingCredentialSecretRef) + '\n');

  // ─── STEP 9: Candidate Order Discovery ─────────────────────────────────────
  process.stdout.write('\n=== STEP 9 — Candidate Order Discovery ===\n');

  // Find orders for Company 1 that:
  // - are not yet dispatched (status not DELIVERED/FULFILLED)
  // - have no existing Invoice
  // - have no existing FiscalIntent (via invoice)
  // - have CRC currency (via client store or product)
  // - have complete info for dispatch

  const orders = await prisma.order.findMany({
    where: {
      companyId: COMPANY_ID,
      status: {
        in: ['APPROVED', 'IN_PRODUCTION'],
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
              cabysCode: true,
              currency: true,
              taxExempt: true,
              taxRate: true,
            },
          },
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          legalEntity: true,
          paymentDays: true,
        },
      },
      clientStore: {
        select: {
          id: true,
          name: true,
          currency: true,
          legalEntity: true,
        },
      },
      invoices: {
        select: {
          id: true,
          status: true,
          orderId: true,
          fiscalIntent: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
    take: 20, // safety limit
  });

  process.stdout.write('Orders found (non-dispatched): ' + orders.length + '\n\n');

  const candidates = [];

  for (const order of orders) {
    const invoiceCount = order.invoices.length;
    const fiscalIntentCount = order.invoices.filter(inv => inv.fiscalIntent).length;

    const hasInvoice = invoiceCount > 0;
    const hasFiscalIntent = fiscalIntentCount > 0;

    // Currency check
    const storeCurrency = order.clientStore?.currency || '';
    const productCurrency = (order.items || []).map(i => i.product?.currency || '').find(Boolean) || '';
    const currency = (storeCurrency || productCurrency || 'CRC').toUpperCase();

    // Receiver check
    const hasClientLegalEntity = Boolean(
      order.clientStore?.legalEntity || order.client?.legalEntity
    );

    // CAByS check
    const allHaveCabys = order.items.every(i => i.product?.cabysCode);
    const missingCabys = order.items.filter(i => !i.product?.cabysCode).map(i => i.productId?.toString());

    // Fiscal unit check
    const allHaveUnit = order.items.every(i => i.product?.unit);

    // Tax metadata check  
    const validTax = order.items.every(i => {
      const taxRate = Number(i.product?.taxRate || 0);
      return taxRate >= 0;
    });

    // Discount check
    const hasDiscount = order.items.some(i => Number(i.discountPercent || 0) > 0 || Number(i.discountAmount || 0) > 0);

    // Credit terms check
    const paymentCondition = order.paymentCondition || 'CASH';
    const creditTermValid = paymentCondition !== 'CREDIT' || Number(order.client?.paymentDays || 0) > 0;

    const isCandidate = !hasInvoice && !hasFiscalIntent && currency === 'CRC'
      && paymentCondition === 'CASH' && !hasDiscount
      && allHaveCabys && allHaveUnit && validTax && creditTermValid;

    const sanitized = {
      orderId: order.id.toString(),
      status: order.status,
      paymentCondition: order.paymentCondition,
      currency,
      invoiceCount,
      fiscalIntentCount,
      hasClientLegalEntity,
      allHaveCabys,
      missingCabys,
      allHaveUnit,
      validTax,
      hasDiscount,
      creditTermValid,
      itemCount: order.items.length,
      isCandidate,
    };

    if (orders.length <= 5 || isCandidate) {
      process.stdout.write('Order ' + order.id.toString() + ': ' + JSON.stringify(sanitized, null, 2) + '\n');
    }

    if (isCandidate) {
      candidates.push(sanitized);
    }
  }

  process.stdout.write('\n--- Candidates Summary ---\n');
  process.stdout.write('Total candidates: ' + candidates.length + '\n');
  if (candidates.length > 0) {
    process.stdout.write('Recommended TASK-016 candidate: Order ' + candidates[0].orderId + '\n');
    process.stdout.write('Candidate details: ' + JSON.stringify(candidates[0], null, 2) + '\n');
  } else {
    process.stdout.write('No clean CASH/CRC candidates without invoice/intent found\n');
  }

  // ─── STEP 10: Scheduler State ───────────────────────────────────────────────
  process.stdout.write('\n=== STEP 10 — Fiscal Scheduler State ===\n');

  const schedulerEnabled = process.env.FISCAL_SCHEDULER_ENABLED === 'true';
  process.stdout.write('schedulerEnabled (from env): ' + schedulerEnabled + '\n');

  // Count intents by status
  const pendingCount = await prisma.invoiceFiscalIntent.count({
    where: { status: 'PENDING' },
  });
  const errorRetryableCount = await prisma.invoiceFiscalIntent.count({
    where: { status: 'ERROR_RETRYABLE' },
  });
  const processingCount = await prisma.invoiceFiscalIntent.count({
    where: { status: 'PROCESSING' },
  });
  const allIntentsCount = await prisma.invoiceFiscalIntent.count();

  process.stdout.write('PENDING intents: ' + pendingCount + '\n');
  process.stdout.write('ERROR_RETRYABLE intents: ' + errorRetryableCount + '\n');
  process.stdout.write('PROCESSING intents: ' + processingCount + '\n');
  process.stdout.write('Total intents: ' + allIntentsCount + '\n');

  if (pendingCount > 0 || errorRetryableCount > 0 || processingCount > 0) {
    process.stdout.write('[WARN] Unexpected eligible intents exist — STOP before recommending TASK-016\n');
    const eligibleIntents = await prisma.invoiceFiscalIntent.findMany({
      where: {
        status: { in: ['PENDING', 'ERROR_RETRYABLE', 'PROCESSING'] },
      },
      select: {
        id: true,
        companyId: true,
        invoiceId: true,
        status: true,
        idempotencyKey: true,
        billingFiscalDocumentId: true,
        createdAt: true,
      },
    });
    process.stdout.write('Eligible intents: ' + JSON.stringify(eligibleIntents, s, 2) + '\n');
  } else {
    process.stdout.write('[OK] No unexpected eligible intents\n');
  }

  // Also count total invoices and fiscal snapshots
  const totalInvoices = await prisma.invoice.count({ where: { companyId: COMPANY_ID } });
  const totalSnapshots = await prisma.invoiceFiscalSnapshot.count({ where: { companyId: COMPANY_ID } });
  process.stdout.write('\nCompany 1 invoices: ' + totalInvoices + '\n');
  process.stdout.write('Company 1 fiscal snapshots: ' + totalSnapshots + '\n');

  return {
    billingConfig: billingConfig ? JSON.parse(JSON.stringify(billingConfig, s)) : null,
    candidates,
    schedulerEnabled,
    pendingCount,
    errorRetryableCount,
    processingCount,
    totalInvoices,
    totalSnapshots,
  };
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    process.stderr.write('ERROR: ' + err.message + '\n');
    prisma.$disconnect();
    process.exit(1);
  });
