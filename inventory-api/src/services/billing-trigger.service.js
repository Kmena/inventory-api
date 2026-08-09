'use strict';

const prisma = require('../lib/prisma');
const invoiceRepository = require('../repositories/invoice.repository');
const paymentRepository = require('../repositories/payment.repository');
const { getActorUserId } = require('./approval-baseline.service');

/**
 * Generates a unique invoice number for the given orderId.
 * Primary format: INV-{orderId}. On collision: INV-{orderId}-{timestamp}.
 * @param {bigint} orderId
 * @param {any} db - Prisma transaction client or default prisma
 * @returns {Promise<string>}
 */
async function generateUniqueInvoiceNumber(orderId, db) {
  const primary = `INV-${orderId}`;
  const existing = await db.invoice.findFirst({ where: { number: primary } });
  if (!existing) {
    return primary;
  }
  return `INV-${orderId}-${Date.now()}`;
}

/**
 * Calculates the invoice amount from order items.
 * @param {Array<{ quantity: any, unitPrice: any, totalDiscount?: any }>} items
 * @returns {number}
 */
function calculateInvoiceAmount(items) {
  const total = (items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice) - Number(item.totalDiscount || 0)),
    0,
  );
  return Math.max(0, total);
}

/**
 * Calculates the due date based on paymentCondition and paymentDays.
 * @param {string} paymentCondition
 * @param {number | null | undefined} paymentDays
 * @returns {Date}
 */
function calculateDueAt(paymentCondition, paymentDays) {
  const now = new Date();
  if (paymentCondition === 'CREDIT') {
    const days = paymentDays ?? 30;
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + days);
    return dueAt;
  }
  return now;
}

/**
 * Core billing logic executed best-effort after dispatch.
 * Separated so tests can inject stubs cleanly.
 * @param {any} order
 * @param {any} client
 * @param {any} auth
 * @param {any} db - Prisma or transaction client
 * @returns {Promise<{ invoice: any, payment: any | null } | null>}
 */
async function executeBillingLogic(order, client, auth, db) {
  // Guard 1: legacy order without paymentCondition
  if (!order.paymentCondition) {
    return null;
  }

  // Guard 2: no clientId
  if (!order.clientId) {
    console.warn('[billing-trigger] Order %s has no clientId, skipping auto-billing', order.id);
    return null;
  }

  // Guard 3: idempotency — skip if invoice already exists for this order
  const existing = await db.invoice.findFirst({ where: { orderId: order.id } });
  if (existing) {
    console.info('[billing-trigger] Invoice already exists for order %s, skipping', order.id);
    return null;
  }

  const invoiceAmount = calculateInvoiceAmount(order.items || []);
  const dueAt = calculateDueAt(order.paymentCondition, client?.paymentDays);
  const number = await generateUniqueInvoiceNumber(order.id, db);

  // Create invoice
  const invoice = await invoiceRepository.createInvoice({
    clientId: order.clientId,
    orderId: order.id,
    number,
    amount: invoiceAmount,
    dueAt,
  }, db);

  let payment = null;

  if (order.paymentCondition === 'CASH') {
    // BR-006: verify no non-cancelled payment already exists for this invoice
    const existingPayment = await db.payment.findFirst({
      where: {
        invoiceId: invoice.id,
        status: { not: 'CANCELLED' },
      },
    });

    if (!existingPayment) {
      const actorId = getActorUserId(auth);
      payment = await paymentRepository.createPayment({
        invoiceId: invoice.id,
        amount: invoiceAmount,
        paymentMethod: 'CASH',
        reference: `COBRO-CONTADO-${order.id}`,
        status: 'PENDING_APPROVAL',
        submittedByUserId: actorId,
        submittedAt: new Date(),
      }, db);
    }
  } else if (order.paymentCondition === 'TRANSFER') {
    const transferMetadata = order.transferMetadata;
    if (transferMetadata) {
      const paymentAmount = Math.min(Number(transferMetadata.amount), invoiceAmount);
      const actorId = getActorUserId(auth);
      payment = await paymentRepository.createPayment({
        invoiceId: invoice.id,
        amount: paymentAmount,
        paymentMethod: 'TRANSFER',
        reference: transferMetadata.reference,
        status: 'PENDING_APPROVAL',
        submittedByUserId: actorId,
        submittedAt: new Date(),
      }, db);
    }
  }
  // CREDIT: no payment created

  return { invoice, payment };
}

/**
 * Public best-effort entry point for billing on dispatch.
 * NEVER throws — all errors are logged and null is returned.
 * This function must be called OUTSIDE the dispatch transaction.
 * @param {any} order
 * @param {any} client
 * @param {any} auth
 * @returns {Promise<{ invoice: any, payment: any | null } | null>}
 */
async function generateBillingOnDispatch(order, client, auth) {
  try {
    return await executeBillingLogic(order, client, auth, prisma);
  } catch (err) {
    console.error('[billing-trigger] Failed for order %s: %o', order?.id, err);
    return null;
  }
}

module.exports = {
  generateBillingOnDispatch,
  // exported for testing
  calculateInvoiceAmount,
  calculateDueAt,
  executeBillingLogic,
};
