'use strict';

const { createHttpError } = require('../lib/errors');
const billingIntegrationConfigRepository = require('../repositories/billing-integration-config.repository');
const { resolveFiscalReceiver } = require('./fiscal-receiver-resolver.service');
const { mapInventoriUnitToBillingUnit } = require('./fiscal-unit-mapping.service');

function toNumber(value) {
  return Number(value || 0);
}

function calculateTaxAmount(subtotal, taxRate) {
  return Math.round((subtotal * (taxRate / 100)) * 100) / 100;
}

function resolveSaleCondition(paymentCondition) {
  return paymentCondition === 'CREDIT' ? '02' : '01';
}

function resolvePaymentMethod(paymentCondition) {
  if (paymentCondition === 'CREDIT') return null;
  if (paymentCondition === 'TRANSFER') return '04';
  return '01';
}

function resolveTaxMetadata(product) {
  const taxRate = toNumber(product?.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return null;
  if (product?.taxExempt || taxRate === 0) {
    return { taxCode: '01', taxRateCode: '01', taxRate: 0 };
  }
  if (taxRate === 13) {
    return { taxCode: '01', taxRateCode: '08', taxRate };
  }
  return { taxCode: '01', taxRateCode: '99', taxRate };
}

function getOrderCurrency(order) {
  const storeCurrency = String(order?.clientStore?.currency || '').trim();
  if (storeCurrency) return storeCurrency;
  const productCurrency = (order?.items || [])
    .map((item) => String(item.product?.currency || '').trim())
    .find(Boolean);
  return productCurrency || 'CRC';
}

function hasBillingConfig(config) {
  return Boolean(config?.billingTenantId
    && config?.billingCompanyId
    && config?.billingEnvironment
    && config?.billingCredentialSecretRef);
}

async function getBillingIntegrationConfig(companyId, db) {
  return billingIntegrationConfigRepository.findByCompanyId(companyId, db);
}

function validateOrderFiscalReadiness(order, config) {
  const failures = [];

  if (!config?.enabled || config?.associationStatus === 'HISTORICAL_ONLY') {
    return { enabled: false, ok: true, failures, config: config || null };
  }

  if (!hasBillingConfig(config)) {
    failures.push({ code: 'BILLING_MAPPING_MISSING', field: 'billingIntegrationConfig' });
  }

  const receiverResult = resolveFiscalReceiver(order);
  if (!receiverResult.ok) {
    failures.push({ code: receiverResult.code, field: 'receiver', reason: receiverResult.reason });
  } else {
    const receiver = receiverResult.receiver;
    const identificationType = String(receiver.identificationType || '').trim().toUpperCase();
    const identificationNumber = String(receiver.identificationNumber || '').trim();
    const email = String(receiver.email || '').trim();
    if (!['01', '02', '03', '04', 'FISICA', 'JURIDICA', 'DIMEX', 'NITE'].includes(identificationType)) {
      failures.push({ code: 'UNSUPPORTED_RECEIVER_IDENTIFICATION_TYPE', field: 'receiver.identificationType' });
    }
    if (!/^\d{1,12}$/.test(identificationNumber)) {
      failures.push({ code: 'INVALID_RECEIVER_IDENTIFICATION_NUMBER', field: 'receiver.identificationNumber' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      failures.push({ code: 'INVALID_RECEIVER_EMAIL', field: 'receiver.email' });
    }
  }

  const currency = getOrderCurrency(order).toUpperCase();
  if (currency !== 'CRC') {
    failures.push({ code: 'UNSUPPORTED_CURRENCY', field: 'currency', value: currency });
  }

  if (order.paymentCondition === 'CREDIT' && !(Number(order.client?.paymentDays ?? 30) > 0)) {
    failures.push({ code: 'CREDIT_TERM_MISSING', field: 'client.paymentDays' });
  }

  for (const item of order.items || []) {
    const product = item.product || {};
    if (!product.cabysCode) {
      failures.push({ code: 'CABYS_MISSING', field: 'product.cabysCode', productId: item.productId });
    } else if (!/^\d{13}$/.test(String(product.cabysCode).trim())) {
      failures.push({ code: 'INVALID_CABYS_CODE', field: 'product.cabysCode', productId: item.productId });
    }

    const fiscalUnit = mapInventoriUnitToBillingUnit(product.unit, product);
    if (!fiscalUnit) {
      failures.push({ code: 'UNSUPPORTED_FISCAL_UNIT', field: 'product.unit', productId: item.productId, value: product.unit });
    }

    if (!resolveTaxMetadata(product)) {
      failures.push({ code: 'INVALID_TAX_METADATA', field: 'product.taxRate', productId: item.productId });
    }

    // TASK-015 NOTE: For P0, Inventori hardcodes discountCode='07' / discountNature='Descuento Comercial'
    // in buildFiscalSnapshotData for all discounted lines. No additional item-level metadata check
    // is needed here because the snapshot builder always supplies these required Hacienda v4.4
    // fields. A previous always-false condition (x > 0 && x < 0) was removed in TASK-015 hardening.
    // If Inventori gains a separate discount-metadata schema field in a future task, re-introduce
    // this check with a correct predicate.
  }

  return {
    enabled: true,
    ok: failures.length === 0,
    failures,
    config,
    receiver: receiverResult.receiver || null,
    currency,
    documentType: 'INVOICE',
  };
}

async function assertOrderFiscalReadiness(order, db) {
  const config = await getBillingIntegrationConfig(order.companyId, db);
  const readiness = validateOrderFiscalReadiness(order, config);
  if (!readiness.ok) {
    throw createHttpError(409, 'El pedido no esta listo para facturacion fiscal', readiness.failures[0]?.code || 'FISCAL_READINESS_FAILED');
  }
  return readiness;
}

module.exports = {
  assertOrderFiscalReadiness,
  calculateTaxAmount,
  getBillingIntegrationConfig,
  getOrderCurrency,
  resolvePaymentMethod,
  resolveSaleCondition,
  resolveTaxMetadata,
  validateOrderFiscalReadiness,
};
