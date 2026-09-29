'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: ['error'] });

async function main() {
  // Find candidate orders — Company 1, non-dispatched
  const orders = await p.order.findMany({
    where: {
      companyId: 1n,
      status: { notIn: ['DELIVERED', 'FULFILLED', 'CANCELLED', 'REJECTED'] },
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
        include: {
          legalEntity: { select: { id: true, identificationType: true, identificationNumber: true } },
        },
      },
      clientStore: {
        include: {
          legalEntity: { select: { id: true, identificationType: true, identificationNumber: true } },
        },
      },
      invoices: {
        include: {
          fiscalIntent: { select: { id: true, status: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
    take: 20,
  });

  process.stdout.write('Non-dispatched orders for Company 1: ' + orders.length + '\n\n');

  const candidates = [];

  for (const order of orders) {
    const hasInvoice = order.invoices.length > 0;
    const hasFiscalIntent = order.invoices.some(inv => inv.fiscalIntent);

    const storeCurrency = order.clientStore?.currency || '';
    const productCurrency = (order.items || []).map(i => i.product?.currency || '').find(Boolean) || '';
    const currency = (storeCurrency || productCurrency || 'CRC').toUpperCase();

    const receiverLegal = order.clientStore?.legalEntity || order.client?.legalEntity;
    const hasReceiverLegalEntity = Boolean(receiverLegal);

    const allHaveCabys = order.items.every(i => i.product?.cabysCode);
    const missingCabys = order.items.filter(i => !i.product?.cabysCode).map(i => i.productId?.toString());
    const allHaveUnit = order.items.every(i => i.product?.unit);
    const validTax = order.items.every(i => Number(i.product?.taxRate ?? 0) >= 0);
    const hasDiscount = order.items.some(i => Number(i.discountPercent || 0) > 0 || Number(i.discountAmount || 0) > 0);
    const paymentCondition = order.paymentCondition || 'CASH';
    const creditTermValid = paymentCondition !== 'CREDIT' || Number(order.client?.paymentDays || 0) > 0;

    const isDispatchEligible = order.status === 'APPROVED'; // Only APPROVED orders can be dispatched
    const isCleanCandidate = isDispatchEligible
      && !hasInvoice && !hasFiscalIntent
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
      hasInvoice,
      hasFiscalIntent,
      hasReceiverLegalEntity,
      allHaveCabys,
      missingCabys: missingCabys.length > 0 ? missingCabys : undefined,
      allHaveUnit,
      validTax,
      hasDiscount,
      creditTermValid,
      itemCount: order.items.length,
      isDispatchEligible,
      isCleanCandidate,
    };

    process.stdout.write('Order ' + order.id.toString() + ': ' + JSON.stringify(summary) + '\n');

    if (isCleanCandidate) {
      const items = order.items.map(i => ({
        productId: i.product?.id?.toString(),
        name: i.product?.name,
        unit: i.product?.unit,
        cabysCode: i.product?.cabysCode,
        taxRate: i.product?.taxRate,
        taxExempt: i.product?.taxExempt,
        currency: i.product?.currency,
      }));
      candidates.push({ ...summary, items });
    }
  }

  process.stdout.write('\n=== Candidate Summary ===\n');
  process.stdout.write('Total candidates: ' + candidates.length + '\n');
  if (candidates.length > 0) {
    process.stdout.write('Recommended TASK-016 candidate: Order ' + candidates[0].orderId + '\n');
    process.stdout.write(JSON.stringify(candidates[0], null, 2) + '\n');
  } else {
    process.stdout.write('No clean CASH/CRC APPROVED candidates without Invoice/FiscalIntent found\n');
    process.stdout.write('Note: All non-dispatched orders are DRAFT (not dispatch eligible)\n');
  }
}

main()
  .then(() => p.$disconnect())
  .catch(err => {
    process.stderr.write('ERROR: ' + err.message + '\n');
    p.$disconnect();
    process.exit(1);
  });
