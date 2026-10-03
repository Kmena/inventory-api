'use strict';

const { mapInventoriUnitToBillingUnit } = require('./fiscal-unit-mapping.service');
const {
  calculateTaxAmount,
  getOrderCurrency,
  resolvePaymentMethod,
  resolveSaleCondition,
  resolveTaxMetadata,
} = require('./fiscal-readiness.service');

function toNumber(value) {
  return Number(value || 0);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildFiscalSnapshotData({ order, invoice, receiver, config }) {
  const currency = getOrderCurrency(order).toUpperCase();
  const saleCondition = resolveSaleCondition(order.paymentCondition);
  const creditTermDays = saleCondition === '02' ? Number(order.client?.paymentDays ?? 30) : null;
  const paymentMethod = resolvePaymentMethod(order.paymentCondition);

  const lines = (order.items || []).map((item, index) => {
    const product = item.product || {};
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const totalDiscount = roundMoney(item.totalDiscount);
    const subtotal = roundMoney(Math.max(0, quantity * unitPrice - totalDiscount));
    const taxMetadata = resolveTaxMetadata(product);
    const taxAmount = calculateTaxAmount(subtotal, taxMetadata.taxRate);

    return {
      lineNumber: index + 1,
      productId: item.productId?.toString() || product.id?.toString() || null,
      orderItemId: item.id?.toString() || null,
      cabysCode: product.cabysCode,
      description: product.name || item.description || 'Linea facturada',
      commercialUnit: product.unit || null,
      fiscalUnit: mapInventoriUnitToBillingUnit(product.unit, product),
      quantity,
      unitPrice,
      discountPercent: toNumber(item.discountPercent),
      discountAmount: toNumber(item.discountAmount),
      totalDiscount,
      discountCode: totalDiscount > 0 ? '07' : null,
      discountNature: totalDiscount > 0 ? 'Descuento Comercial' : null,
      discountOther: null,
      taxCode: taxMetadata.taxCode,
      taxRateCode: taxMetadata.taxRateCode,
      taxRate: taxMetadata.taxRate,
      taxAmount,
      subtotal,
      total: roundMoney(subtotal + taxAmount),
    };
  });

  const totals = lines.reduce((accumulator, line) => ({
    subtotal: roundMoney(accumulator.subtotal + line.subtotal),
    tax: roundMoney(accumulator.tax + line.taxAmount),
    discount: roundMoney(accumulator.discount + line.totalDiscount),
    total: roundMoney(accumulator.total + line.total),
  }), { subtotal: 0, tax: 0, discount: 0, total: 0 });

  const header = {
    currency,
    exchangeRate: '1.00000',
    saleCondition,
    paymentMethod,
    creditTermDays,
    billingTenantId: config?.billingTenantId || null,
    billingCompanyId: config?.billingCompanyId || null,
    billingEnvironment: config?.billingEnvironment || null,
  };

  // ── RFR-TASK-401: Immutable receiver activity selection ────────────────────────────
  // Source of truth for the selected receiver economic activity:
  //   NEW-FLOW  (order.fiscalApproval != null): frozen value from OrderFiscalApproval.
  //             MUST NOT be re-resolved from live Client/ClientStore/ClientLegalEntity data.
  //   LEGACY    (order.fiscalApproval == null): P0 fallback — receiver.economicActivityCode.
  //             This covers orders approved before Wave 3 OR when Billing was disabled at approval.
  // Once this snapshot is created, selectedEconomicActivityCode is immutable.
  const fiscalApproval = order.fiscalApproval ?? null;
  const selectedEconomicActivityCode = fiscalApproval
    ? fiscalApproval.receiverEconomicActivityCode   // new-flow: frozen at approval
    : (receiver.economicActivityCode ?? null);       // legacy: P0 fallback

  return {
    companyId: order.companyId,
    orderId: order.id,
    invoiceId: invoice.id,
    receiverSourceType: receiver.sourceType,
    receiverSourceId: receiver.sourceId,
    currency,
    saleCondition,
    paymentMethod,
    creditTermDays,
    headerSnapshot: header,
    receiverSnapshot: {
      ...receiver,
      sourceId: receiver.sourceId == null ? null : receiver.sourceId.toString(),
      // P0 compat fields preserved — existing snapshots and Billing contract unchanged.
      economicActivityCode: receiver.economicActivityCode || null,
      economicActivityName: receiver.economicActivityName || null,
      // P1 field: authoritative activity for this invoice (Wave 4).
      // New-flow: equals fiscalApproval.receiverEconomicActivityCode (frozen at approval).
      // Legacy: receiver.economicActivityCode or null (P0 behavior).
      selectedEconomicActivityCode,
      // Audit flag: distinguishes new-flow (Wave 3+) from legacy/billing-disabled orders.
      isNewFlowOrder: fiscalApproval != null,
    },
    linesSnapshot: lines,
    totalsSnapshot: totals,
    mappingVersion: 'inventori-billing-foundation-p0-v1',
  };
}

function createInvoiceFiscalSnapshot(snapshotData, db) {
  return db.invoiceFiscalSnapshot.upsert({
    where: { invoiceId: snapshotData.invoiceId },
    create: snapshotData,
    update: {},
  });
}

function buildIdempotencyKey(companyId, invoiceId) {
  return `inventori:${companyId.toString()}:invoice:${invoiceId.toString()}`;
}

function createInvoiceFiscalIntent({ companyId, invoiceId, config, idempotencyKey }, db) {
  return db.invoiceFiscalIntent.upsert({
    where: { invoiceId },
    create: {
      companyId,
      invoiceId,
      billingIntegrationConfigId: config.id,
      status: 'PENDING',
      idempotencyKey,
      attemptCount: 0,
    },
    update: {},
  });
}

module.exports = {
  buildFiscalSnapshotData,
  buildIdempotencyKey,
  createInvoiceFiscalIntent,
  createInvoiceFiscalSnapshot,
};
