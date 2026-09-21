'use strict';

const prisma = require('../lib/prisma');
const invoiceRepository = require('../repositories/invoice.repository');
const paymentRepository = require('../repositories/payment.repository');
const { getActorUserId } = require('./approval-baseline.service');
const entitlementService = require('./entitlement.service');

const nodeEnv = process.env.NODE_ENV || 'production';

/**
 * Structured log helper for billing-trigger events.
 * Follows the same JSON format used by the request logger.
 * @param {'info'|'warn'|'error'} level
 * @param {string} code
 * @param {bigint|number|string|null|undefined} orderId
 * @param {string} message
 * @param {Error} [cause]
 */
function logBillingEvent(level, code, orderId, message, cause) {
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  if (nodeEnv === 'development') {
    logFn(`[billing-trigger] ${message}`, orderId != null ? `orderId=${orderId}` : '', cause || '');
    return;
  }
  const payload = { level, environment: nodeEnv, code, orderId: orderId != null ? String(orderId) : null, message };
  if (cause) {
    payload.errorMessage = cause.message || String(cause);
  }
  logFn(JSON.stringify(payload));
}

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

function resolveInvoiceItemKind(product) {
  if (product?.commercialBehavior === 'ENTITLEMENT') {
    return 'ENTITLEMENT';
  }
  if (product?.controlsInventory === false || product?.productNature === 'SERVICE') {
    return 'SERVICE';
  }
  return 'PHYSICAL_GOOD';
}

function buildInvoiceItemSnapshots(invoice, order) {
  return (order.items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const totalDiscount = Number(item.totalDiscount || 0);
    const subtotal = Math.max(0, quantity * unitPrice - totalDiscount);
    const product = item.product || null;

    return {
      invoiceId: invoice.id,
      orderItemId: item.id ?? null,
      productId: item.productId ?? product?.id ?? null,
      companyId: order.companyId,
      lineKind: resolveInvoiceItemKind(product),
      descriptionSnapshot: product?.name || item.description || 'Linea facturada',
      productCodeSnapshot: product?.code || null,
      quantity,
      unitPrice,
      discountPercent: Number(item.discountPercent || 0),
      discountAmount: Number(item.discountAmount || 0),
      taxCategorySnapshot: product?.taxCategory || null,
      taxRateSnapshot: product?.taxRate == null ? null : Number(product.taxRate),
      subtotal,
      tax: 0,
      total: subtotal,
    };
  });
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
    logBillingEvent('warn', 'billing_trigger_skip_no_client', order.id, 'Order has no clientId, skipping auto-billing');
    return null;
  }

  // Guard 3: idempotency — skip if invoice already exists for this order
  const existing = await db.invoice.findFirst({ where: { orderId: order.id } });
  if (existing) {
    logBillingEvent('info', 'billing_trigger_skip_idempotent', order.id, 'Invoice already exists for order, skipping');
    return null;
  }

  const invoiceAmount = calculateInvoiceAmount(order.items || []);
  const dueAt = calculateDueAt(order.paymentCondition, client?.paymentDays);
  const number = await generateUniqueInvoiceNumber(order.id, db);

  // Create invoice and immutable billed-line snapshots.
  const invoice = await invoiceRepository.createInvoice({
    clientId: order.clientId,
    orderId: order.id,
    number,
    amount: invoiceAmount,
    dueAt,
  }, db);
  await invoiceRepository.createInvoiceItems(buildInvoiceItemSnapshots(invoice, order), db);

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
  } else if (order.paymentCondition === 'CREDIT') {
    await entitlementService.activateEntitlementsForApprovedCreditInvoice(invoice, auth, null, db);
  }

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
    return await prisma.$transaction((tx) => executeBillingLogic(order, client, auth, tx));
  } catch (err) {
    logBillingEvent('error', 'billing_trigger_failed', order?.id, 'Billing trigger failed for order', err);
    return null;
  }
}

module.exports = {
  generateBillingOnDispatch,
  // exported for testing
  calculateInvoiceAmount,
  calculateDueAt,
  executeBillingLogic,
  buildInvoiceItemSnapshots,
  resolveInvoiceItemKind,
};
