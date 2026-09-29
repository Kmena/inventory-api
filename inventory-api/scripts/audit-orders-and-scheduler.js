'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: ['error'] });
const s = (k, v) => (typeof v === 'bigint' ? v.toString() : v);

async function main() {
  // ─── Invoices & Fiscal state ────────────────────────────────────────────────
  const totalInvoices = await p.invoice.count();
  const totalSnapshots = await p.invoiceFiscalSnapshot.count();
  const totalIntents = await p.invoiceFiscalIntent.count();

  process.stdout.write('=== Invoice/Fiscal Counts ===\n');
  process.stdout.write('total invoices: ' + totalInvoices + '\n');
  process.stdout.write('total fiscal snapshots: ' + totalSnapshots + '\n');
  process.stdout.write('total fiscal intents: ' + totalIntents + '\n');

  // ─── Scheduler State ────────────────────────────────────────────────────────
  process.stdout.write('\n=== STEP 10 — Scheduler ===\n');
  process.stdout.write('FISCAL_SCHEDULER_ENABLED: ' + process.env.FISCAL_SCHEDULER_ENABLED + '\n');

  const pendingCount = await p.invoiceFiscalIntent.count({ where: { status: 'PENDING' } });
  const errorRetryCount = await p.invoiceFiscalIntent.count({ where: { status: 'ERROR_RETRYABLE' } });
  const processingCount = await p.invoiceFiscalIntent.count({ where: { status: 'PROCESSING' } });

  process.stdout.write('PENDING intents: ' + pendingCount + '\n');
  process.stdout.write('ERROR_RETRYABLE intents: ' + errorRetryCount + '\n');
  process.stdout.write('PROCESSING intents: ' + processingCount + '\n');

  const hasEligibleIntents = pendingCount > 0 || errorRetryCount > 0 || processingCount > 0;
  if (hasEligibleIntents) {
    process.stdout.write('[WARN] Eligible intents exist — STOP before TASK-016\n');
    const eligible = await p.invoiceFiscalIntent.findMany({
      where: { status: { in: ['PENDING', 'ERROR_RETRYABLE', 'PROCESSING'] } },
      select: { id: true, companyId: true, invoiceId: true, status: true },
    });
    process.stdout.write('Eligible: ' + JSON.stringify(eligible, s, 2) + '\n');
  } else {
    process.stdout.write('[OK] No eligible intents\n');
  }

  // ─── Orders for Company 1 ───────────────────────────────────────────────────
  process.stdout.write('\n=== STEP 9 — Company 1 Orders ===\n');

  const allOrderStatuses = await p.order.groupBy({
    by: ['status'],
    where: { companyId: 1n },
    _count: { _all: true },
  });
  process.stdout.write('Order status distribution:\n' + JSON.stringify(allOrderStatuses, s, 2) + '\n');

  // APPROVED orders specifically
  const approvedOrders = await p.order.findMany({
    where: { companyId: 1n, status: 'APPROVED' },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, unit: true, cabysCode: true, currency: true, taxExempt: true, taxRate: true },
          },
        },
      },
      client: {
        select: { id: true, name: true, paymentDays: true },
        include: { legalEntity: true },
      },
      clientStore: {
        select: { id: true, name: true, currency: true },
        include: { legalEntity: true },
      },
      invoices: {
        select: { id: true, status: true },
        include: { fiscalIntent: { select: { id: true, status: true } } },
      },
    },
    orderBy: { id: 'asc' },
    take: 10,
  });

  process.stdout.write('APPROVED orders: ' + approvedOrders.length + '\n');

  const candidates = [];

  for (const order of approvedOrders) {
    const hasInvoice = order.invoices.length > 0;
    const hasFiscalIntent = order.invoices.some(inv => inv.fiscalIntent);

    const storeCurrency = order.clientStore?.currency || '';
    const productCurrency = (order.items || []).map(i => i.product?.currency || '').find(Boolean) || '';
    const currency = (storeCurrency || productCurrency || 'CRC').toUpperCase();

    const hasReceiverLegalEntity = Boolean(order.clientStore?.legalEntity || order.client?.legalEntity);
    const allHaveCabys = order.items.every(i => i.product?.cabysCode);
    const allHaveUnit = order.items.every(i => i.product?.unit);
    const validTax = order.items.every(i => Number(i.product?.taxRate ?? 0) >= 0);
    const hasDiscount = order.items.some(i => Number(i.discountPercent || 0) > 0 || Number(i.discountAmount || 0) > 0);
    const paymentCondition = order.paymentCondition || 'CASH';
    const creditTermValid = paymentCondition !== 'CREDIT' || Number(order.client?.paymentDays || 0) > 0;

    const isCleanCandidate = !hasInvoice && !hasFiscalIntent
      && currency === 'CRC'
      && paymentCondition === 'CASH'
      && !hasDiscount
      && allHaveCabys
      && allHaveUnit
      && validTax;

    const summary = {
      orderId: order.id.toString(),
      status: order.status,
      paymentCondition,
      currency,
      invoiceCount: order.invoices.length,
      fiscalIntentCount: order.invoices.filter(inv => inv.fiscalIntent).length,
      hasReceiverLegalEntity,
      allHaveCabys,
      allHaveUnit,
      validTax,
      hasDiscount,
      creditTermValid,
      itemCount: order.items.length,
      isCleanCandidate,
    };

    process.stdout.write('Order ' + order.id.toString() + ': ' + JSON.stringify(summary) + '\n');

    if (isCleanCandidate) {
      // Get more detail
      const items = order.items.map(i => ({
        productId: i.product?.id?.toString(),
        productName: i.product?.name,
        unit: i.product?.unit,
        cabysCode: i.product?.cabysCode,
        taxRate: i.product?.taxRate,
        taxExempt: i.product?.taxExempt,
        currency: i.product?.currency,
      }));
      candidates.push({ ...summary, items });
    }
  }

  process.stdout.write('\n--- Candidate Summary ---\n');
  process.stdout.write('Clean candidates: ' + candidates.length + '\n');
  if (candidates.length > 0) {
    process.stdout.write('Recommended TASK-016 candidate: Order ' + candidates[0].orderId + '\n');
    process.stdout.write(JSON.stringify(candidates[0], null, 2) + '\n');
  } else {
    process.stdout.write('No clean candidates found in APPROVED status\n');
    // Check DELIVERED too
    const deliveredCount = await p.order.count({ where: { companyId: 1n, status: { in: ['DELIVERED', 'FULFILLED'] } } });
    process.stdout.write('DELIVERED/FULFILLED (already dispatched): ' + deliveredCount + '\n');
  }
}

main()
  .then(() => p.$disconnect())
  .catch(err => {
    process.stderr.write('ERROR: ' + err.message + '\n');
    p.$disconnect();
    process.exit(1);
  });
