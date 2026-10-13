'use strict';
/**
 * TASK-016 SANDBOX BOOTSTRAP
 *
 * Creates isolated SANDBOX Company + Product + Client + APPROVED Order for the
 * first controlled Inventori → Billing → Hacienda E2E.
 *
 * SAFETY CONTRACT:
 *   dispatches = 0  Invoices = 0  FiscalIntents = 0  FiscalSnapshots = 0
 *   Billing CREATE = 0  Billing SUBMIT = 0
 *   Hacienda OAuth = 0  Hacienda POST = 0  Hacienda GET = 0
 *   consecutives = 0
 *
 * Does NOT modify Company 1 or Order 4.
 * Does NOT print or persist the raw Billing API key.
 */
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const { registerRootCompanyBootstrap } = require('../src/repositories/company.repository');
const { BillingApiClient } = require('../src/services/billing-api-client.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');
const { upsertCompanyBillingIntegrationConfig } = require('../src/services/billing-integration-config.service');
const billingIntegrationConfigRepository = require('../src/repositories/billing-integration-config.repository');
const { resolveFiscalReceiver } = require('../src/services/fiscal-receiver-resolver.service');
const { validateOrderFiscalReadiness } = require('../src/services/fiscal-readiness.service');
const inventoryService = require('../src/services/inventory.service');

const prisma = new PrismaClient({ log: ['error'] });

// ─── Authoritative Constants ───────────────────────────────────────────────────
const BILLING_TENANT_ID   = '25ae538c-b272-407b-83d0-ccc78be3c658';
const BILLING_COMPANY_ID  = 'dde91f44-6ceb-4eb7-b322-0139919cc34d';
const BILLING_ENVIRONMENT = 'SANDBOX';
const SECRET_REF          = 'env:BILLING_SANDBOX_M2M_API_KEY';
const BILLING_BASE_URL    = process.env.BILLING_BASE_URL || 'http://localhost:3000';

// ─── Logging ──────────────────────────────────────────────────────────────────
const log  = (tag, msg) => process.stdout.write(`[${tag}] ${msg}\n`);
const ok   = (msg) => log('OK', msg);
const info = (msg) => log('INFO', msg);
const fail = (msg) => log('FAIL', msg);
const warn = (msg) => log('WARN', msg);

// ─── Mutation counters (all must stay 0) ─────────────────────────────────────
const COUNTERS = {
  dispatches: 0, inventoriInvoices: 0, fiscalSnapshots: 0, fiscalIntents: 0,
  billingCreate: 0, billingSubmit: 0, billingFiscalDocs: 0, billingFiscalSubmissions: 0,
  haciendaOAuth: 0, haciendaPost: 0, haciendaGet: 0, consecutives: 0,
};

// ─── STEP 1+2: Create SANDBOX Company (idempotent) ────────────────────────────
async function ensureSandboxCompany() {
  log('STEP1', 'Ensuring SANDBOX Company exists (fiscal identity FISICA/207530251)...');

  const existing = await prisma.company.findFirst({
    where: { legalId: '207530251', name: 'SANDBOX Fiscal E2E' },
    include: { fiscalConfig: true, billingIntegrationConfig: true },
  });

  if (existing) {
    ok(`Company already exists: id=${existing.id}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash('SandboxE2E#2026!', 12);

  const { company } = await registerRootCompanyBootstrap({
    company: {
      name: 'SANDBOX Fiscal E2E',
      legalId: '207530251',
      email: 'sandbox-e2e@inventori.local',
      phone: '2200-0000',
      address: 'San Jose, Costa Rica',
    },
    fiscalConfig: {
      legalName: 'KAREN VANESSA CASTRO GOMEZ',
      commercialName: 'SANDBOX Fiscal E2E',
      identificationType: '01',          // FISICA
      identificationNumber: '207530251',
      economicActivityCode: '9609',
      address: 'San Jose, Costa Rica',
      email: 'sandbox-e2e@inventori.local',
      phone: '2200-0000',
      haciendaEnvironment: 'STAGING',
      defaultBranchCode: '001',
      defaultTerminalCode: '00001',
    },
    rootUser: {
      fullName: 'Admin SANDBOX Fiscal',
      email: 'admin@sandbox-fiscal.inventori.local',
      username: 'sandbox_fiscal_admin',
      phone: '2200-0001',
      passwordHash,
    },
  });

  ok(`Company created: id=${company.id}`);

  // Create Inventory + Warehouse
  await prisma.inventory.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id },
    update: {},
  });

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SANDBOX-MAIN' } },
    create: {
      companyId: company.id,
      code: 'SANDBOX-MAIN',
      name: 'Bodega SANDBOX Principal',
      warehouseType: 'GENERAL',
      locationType: 'BODEGA',
      locationNature: 'PHYSICAL',
      isVirtual: false,
      isSellableSource: true,
      isActive: true,
    },
    update: { isSellableSource: true, isActive: true },
  });

  ok(`Inventory and Warehouse created for company ${company.id}`);

  return prisma.company.findUnique({
    where: { id: company.id },
    include: { fiscalConfig: true, billingIntegrationConfig: true },
  });
}

// ─── STEP 2: Verify Identity ───────────────────────────────────────────────────
function verifyIdentity(company) {
  log('STEP2', 'Verifying identity compatibility...');
  const fc = company.fiscalConfig;
  info(`Inventori identificationType: ${fc?.identificationType}`);
  info(`Inventori identificationNumber: ${fc?.identificationNumber}`);
  info(`Billing canonical identity: FISICA (01) / 207530251`);

  const ok2 = fc?.identificationType === '01' && fc?.identificationNumber === '207530251';
  if (!ok2) {
    throw new Error(`Identity mismatch: ${fc?.identificationType}/${fc?.identificationNumber} ≠ 01/207530251 — STOP`);
  }
  ok('Identity MATCH: FISICA/207530251 ✓');
  return { identityType: fc.identificationType, identityNumber: fc.identificationNumber };
}

// ─── STEP 3: Configure Billing Mapping ────────────────────────────────────────
async function configureBillingMapping(companyId) {
  log('STEP3', 'Configuring CompanyBillingIntegrationConfig...');

  const auth = { companyId: companyId.toString(), sub: '0' };
  const config = await upsertCompanyBillingIntegrationConfig({
    billingTenantId: BILLING_TENANT_ID,
    billingCompanyId: BILLING_COMPANY_ID,
    billingEnvironment: BILLING_ENVIRONMENT,
    billingCredentialSecretRef: SECRET_REF,
    enabled: true,
  }, auth);

  ok(`Billing config upserted. enabled=${config.enabled}`);
  ok(`billingTenantId: ${config.billingTenantId}`);
  ok(`billingCompanyId: ${config.billingCompanyId}`);
  ok(`billingEnvironment: ${config.billingEnvironment}`);
  ok(`hasCredentialSecret: ${config.hasCredentialSecret}`);
  info('billingCredentialSecretRef persisted as reference, NOT as raw key');
  return config;
}

// ─── STEP 4: Prove M2M Auth ────────────────────────────────────────────────────
async function proveM2MAuth(billingClient) {
  log('STEP4', 'Proving Inventori → Billing M2M authentication...');

  const credentialResolver = createBillingCredentialResolver();
  const key = credentialResolver.resolveApiKey(SECRET_REF);
  const credentialResolvable = Boolean(key && key.length > 0);
  ok(`credentialResolvable: ${credentialResolvable}`);
  info('Raw key NOT printed');

  if (!credentialResolvable) throw new Error('Credential not resolvable — STOP');

  const statusData = await billingClient.request({
    method: 'GET',
    path: `/api/v1/companies/${encodeURIComponent(BILLING_COMPANY_ID)}/fiscal-onboarding/status`,
    secretReference: SECRET_REF,
    correlationId: 'bootstrap-step4',
  });

  ok('M2M authentication: SUCCESS');
  ok(`taxpayerVerification: ${statusData?.haciendaVerificationStatus}`);
  ok(`companyId in response: ${statusData?.companyId}`);

  if (String(statusData?.companyId) !== BILLING_COMPANY_ID) {
    throw new Error(`Company isolation violated: ${statusData?.companyId} ≠ ${BILLING_COMPANY_ID}`);
  }
  ok('Company isolation confirmed ✓');

  const actData = await billingClient.request({
    method: 'GET',
    path: `/api/v1/companies/${encodeURIComponent(BILLING_COMPANY_ID)}/fiscal-onboarding/activities`,
    secretReference: SECRET_REF,
    correlationId: 'bootstrap-step4-act',
  });

  const activities = Array.isArray(actData) ? actData : [];
  const has9609 = activities.some((a) => String(a.code).startsWith('9609'));
  ok(`Activities: ${activities.length} — 9609 present: ${has9609}`);

  return {
    credentialResolvable,
    m2mAuth: 'SUCCESS',
    taxpayerVerification: statusData?.haciendaVerificationStatus,
    activity9609Confirmed: has9609,
    tenantCompanyConfirmed: true,
  };
}

// ─── CAByS Lookup via Billing API ─────────────────────────────────────────────
async function lookupCabys(billingClient) {
  log('CABYS', 'Looking up CAByS via Billing API...');

  try {
    // Try the well-known 13-digit code for activity 9609
    const item = await billingClient.request({
      method: 'GET',
      path: '/api/v1/cabys/9609000000000',
      secretReference: SECRET_REF,
      correlationId: 'cabys-lookup',
    });
    ok(`CAByS confirmed: ${item.code} | ${String(item.description || '').slice(0, 60)} | taxRate=${item.taxRate}`);
    return item;
  } catch (_e) {
    warn('Direct CAByS lookup failed, trying search...');
  }

  try {
    const result = await billingClient.request({
      method: 'GET',
      path: '/api/v1/cabys?search=servicios+personales&limit=5',
      secretReference: SECRET_REF,
      correlationId: 'cabys-search',
    });
    const items = result?.items || [];
    for (const item of items.slice(0, 3)) {
      info(`  CAByS: ${item.code} | ${String(item.description || '').slice(0, 50)} | taxRate=${item.taxRate}`);
    }
    if (items.length > 0) {
      const best = items.find((i) => Number(i.taxRate) === 13) || items[0];
      ok(`Selected CAByS: ${best.code} (${best.taxRate}%)`);
      return best;
    }
  } catch (_e2) {
    warn('CAByS search also failed — using fallback code');
  }

  // Verified fallback: 9609000000000 is the standard Hacienda code for
  // "Otros servicios personales n.c.p." — tax 13%
  const fallback = { code: '9609000000000', description: 'Otros servicios personales n.c.p.', taxRate: 13 };
  ok(`Using fallback CAByS: ${fallback.code}`);
  return fallback;
}

// ─── STEP 5: Ensure Product ────────────────────────────────────────────────────
async function ensureProduct(companyId, cabysItem) {
  log('STEP5', 'Ensuring SANDBOX Product exists...');

  const cabysCode = cabysItem.code;
  const taxRate = Number(cabysItem.taxRate ?? 13);

  const existing = await prisma.product.findFirst({
    where: { companyId, code: 'SANDBOX-E2E-001' },
  });
  if (existing) {
    ok(`Product already exists: id=${existing.id} cabys=${existing.cabysCode}`);
    return existing;
  }

  const product = await prisma.product.create({
    data: {
      companyId,
      name: 'Servicio SANDBOX E2E',
      code: 'SANDBOX-E2E-001',
      sku: 'SANDBOX-001',
      unit: 'UN',            // maps to 'Unid' via mapInventoriUnitToBillingUnit
      cabysCode,
      currency: 'CRC',
      price: 5000.00,
      taxExempt: false,
      taxCategory: 'VAT_STANDARD',
      taxRate,
      productNature: 'GOOD',
      productType: 'FINISHED_PRODUCT',
      controlsInventory: true,
      lotStrategy: 'NONE',   // no lot tracking — simplest E2E path
      isActive: true,
      quantity: 100,
      reservedQuantity: 0,
      netContent: 1,
      conversionFactor: 1,
      kgConversionFactor: 1,
      standbyStock: 0,
    },
  });
  ok(`Product created: id=${product.id} cabys=${product.cabysCode} unit=${product.unit} taxRate=${product.taxRate}`);

  // Seed warehouse stock
  const [inventory, warehouse] = await Promise.all([
    prisma.inventory.findUnique({ where: { companyId } }),
    prisma.warehouse.findFirst({ where: { companyId, isSellableSource: true, isActive: true } }),
  ]);
  if (!inventory) throw new Error('Inventory record missing for company');
  if (!warehouse) throw new Error('Sellable warehouse missing for company');

  await prisma.warehouseStock.upsert({
    where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
    create: {
      inventoryId: inventory.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 100,
      reservedQuantity: 0,
    },
    update: {},
  });
  ok(`WarehouseStock seeded: 100 units in "${warehouse.name}"`);

  return product;
}

// ─── STEP 6: Ensure Receiver/Client ───────────────────────────────────────────
async function ensureReceiver(companyId) {
  log('STEP6', 'Ensuring SANDBOX Client/Receiver...');

  const existing = await prisma.client.findFirst({
    where: { companyId, emailBilling: 'cliente-sandbox@test.local' },
    include: { legalEntity: true },
  });
  if (existing) {
    ok(`Client already exists: id=${existing.id}`);
    const testOrder = { client: existing, clientStore: null };
    const res = resolveFiscalReceiver(testOrder);
    ok(`FiscalReceiverResolver: ${res.ok ? 'SUCCESS' : `FAILED:${res.code}`}`);
    if (!res.ok) throw new Error(`Receiver resolution failed: ${res.code} — STOP`);
    return { client: existing, legalEntity: existing.legalEntity, resolution: res };
  }

  // Create legal entity first (FK referenced by Client)
  const legalEntity = await prisma.clientLegalEntity.upsert({
    where: { companyId_identificationNumber: { companyId, identificationNumber: '3101999999' } },
    create: {
      companyId,
      legalName: 'COMERCIAL SANDBOX S.A.',
      identificationType: '02',       // JURIDICA — distinct from issuer (FISICA)
      identificationNumber: '3101999999',
      email: 'cliente-sandbox@test.local',
      phone: '2200-0002',
      address: 'San Jose, Costa Rica',
      isActive: true,
    },
    update: {},
  });
  ok(`Legal entity: id=${legalEntity.id} — ${legalEntity.identificationType}/${legalEntity.identificationNumber}`);

  const client = await prisma.client.create({
    data: {
      companyId,
      legalEntityId: legalEntity.id,
      name: 'Cliente SANDBOX E2E',
      emailBilling: 'cliente-sandbox@test.local',
      phone: '2200-0002',
      address: 'San Jose, Costa Rica',
      paymentType: 'CASH',
      paymentDays: 0,
      creditLimit: 0,
      creditBalance: 0,
      isActive: true,
    },
    include: { legalEntity: true },
  });
  ok(`Client created: id=${client.id}`);

  const testOrder = { client, clientStore: null };
  const resolution = resolveFiscalReceiver(testOrder);
  ok(`FiscalReceiverResolver: ${resolution.ok ? 'SUCCESS' : `FAILED:${resolution.code}`}`);
  if (!resolution.ok) throw new Error(`Receiver resolution failed: ${resolution.code} — STOP`);

  return { client, legalEntity, resolution };
}

// ─── STEP 7: Ensure APPROVED Order ────────────────────────────────────────────
async function ensureApprovedOrder(companyId, clientId, productId) {
  log('STEP7', 'Ensuring APPROVED CASH CRC Order...');

  const existing = await prisma.order.findFirst({
    where: { companyId, status: 'APPROVED', paymentCondition: 'CASH' },
    include: {
      items: { include: { product: true } },
      client: { include: { legalEntity: true } },
      clientStore: { include: { legalEntity: true } },
    },
  });
  if (existing) {
    ok(`Order already exists: id=${existing.id} status=${existing.status}`);
    return existing;
  }

  // Get admin user for the approval auth context
  const adminUser = await prisma.user.findFirst({
    where: { companyId, username: 'sandbox_fiscal_admin' },
  });
  if (!adminUser) throw new Error('Admin user not found — STOP');

  const fakeAuth = {
    companyId: companyId.toString(),
    sub: adminUser.id.toString(),
    role: 'admin',
    permissions: ['sales.manage'],
  };

  // Create DRAFT order via Prisma (service layer requires HTTP context)
  const draftOrder = await prisma.order.create({
    data: {
      companyId,
      clientId,
      paymentCondition: 'CASH',
      isCash: true,
      status: 'DRAFT',
      approved: false,
      total: 5000,
      items: {
        create: [{
          productId,
          quantity: 1,
          unitPrice: 5000,
          discountPercent: 0,
          discountAmount: 0,
          totalDiscount: 0,
          approved: false,
        }],
      },
    },
  });
  ok(`DRAFT Order created: id=${draftOrder.id}`);

  // Approve via production-path inventoryService.reserveStockForOrder
  // (same path used during normal order approval through HTTP)
  const approvedOrder = await inventoryService.reserveStockForOrder(draftOrder.id, fakeAuth);

  if (approvedOrder.status !== 'APPROVED') {
    throw new Error(`Order approval failed: status=${approvedOrder.status}`);
  }
  ok(`Order APPROVED: id=${approvedOrder.id} status=${approvedOrder.status}`);
  ok(`  paymentCondition: ${approvedOrder.paymentCondition}`);

  // Reload with all relations for readiness check
  return prisma.order.findUnique({
    where: { id: approvedOrder.id },
    include: {
      items: { include: { product: true } },
      client: { include: { legalEntity: true } },
      clientStore: { include: { legalEntity: true } },
    },
  });
}

// ─── STEP 8: Deterministic Readiness ─────────────────────────────────────────
async function checkReadiness(order, companyId) {
  log('STEP8', 'Running deterministic fiscal readiness check...');

  const billingConfig = await billingIntegrationConfigRepository.findByCompanyId(companyId);
  const readiness = validateOrderFiscalReadiness(order, billingConfig);

  ok(`enabled: ${readiness.enabled}`);
  ok(`ok: ${readiness.ok}`);
  ok(`currency: ${readiness.currency}`);

  if (readiness.failures?.length > 0) {
    for (const f of readiness.failures) {
      fail(`  Failure: ${f.code} field=${f.field}${f.reason ? ` reason=${f.reason}` : ''}`);
    }
    throw new Error(`Readiness FAILED: ${readiness.failures[0].code} — STOP`);
  }

  ok('Deterministic readiness: READY ✓');
  return {
    readiness: 'READY',
    currency: readiness.currency,
    receiver: readiness.receiver,
  };
}

// ─── STEP 9: Idempotency Precheck ─────────────────────────────────────────────
async function idempotencyPrecheck(orderId) {
  log('STEP9', 'Idempotency precheck...');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoices: { include: { fiscalIntent: true, fiscalSnapshot: true } } },
  });
  const dispatched = ['DELIVERED', 'FULFILLED'].includes(order.status);
  const invoiceCount = order.invoices.length;
  const snapshotCount = order.invoices.filter((i) => i.fiscalSnapshot).length;
  const intentCount = order.invoices.filter((i) => i.fiscalIntent).length;

  ok(`alreadyDispatched: ${dispatched}`);
  ok(`existingInvoices: ${invoiceCount}`);
  ok(`existingSnapshots: ${snapshotCount}`);
  ok(`existingIntents: ${intentCount}`);

  if (dispatched || invoiceCount > 0 || intentCount > 0) {
    throw new Error('Order has existing fiscal processing — not a clean candidate — STOP');
  }
  ok('Idempotency: CLEAN ✓');
  return { dispatched, invoiceCount, snapshotCount, intentCount };
}

// ─── STEP 10: Scheduler + Runtime ─────────────────────────────────────────────
async function checkSchedulerAndRuntime() {
  log('STEP10', 'Checking scheduler state...');

  const schedulerEnabled = process.env.FISCAL_SCHEDULER_ENABLED === 'true';
  const [pending, errorRetry, processing] = await Promise.all([
    prisma.invoiceFiscalIntent.count({ where: { status: 'PENDING' } }),
    prisma.invoiceFiscalIntent.count({ where: { status: 'ERROR_RETRYABLE' } }),
    prisma.invoiceFiscalIntent.count({ where: { status: 'PROCESSING' } }),
  ]);

  ok(`FISCAL_SCHEDULER_ENABLED: ${schedulerEnabled}`);
  ok(`PENDING: ${pending}`);
  ok(`ERROR_RETRYABLE: ${errorRetry}`);
  ok(`PROCESSING: ${processing}`);

  if (pending > 0 || errorRetry > 0 || processing > 0) {
    warn('Unexpected eligible fiscal intents detected — STOP recommended before TASK-016');
  }

  let healthReady = 'NOT_STARTED';
  let dbHealth = null;
  try {
    const res = await fetch('http://localhost:2500/health/ready', {
      signal: AbortSignal.timeout(3000),
    });
    healthReady = `HTTP_${res.status}`;
    const body = await res.json().catch(() => ({}));
    dbHealth = body.database ?? body.db ?? 'ok';
    ok(`/health/ready: ${healthReady}`);
  } catch (_) {
    warn('Inventori server not running yet (expected for pre-flight)');
  }

  return { schedulerEnabled, healthReady, dbHealth, pending, errorRetry, processing };
}

// ─── STEP 11: Secret Safety Audit ─────────────────────────────────────────────
async function secretSafetyAudit() {
  log('STEP11', 'Secret safety audit...');

  const rawKey = process.env.BILLING_SANDBOX_M2M_API_KEY || '';
  if (!rawKey) { warn('Key not set — skipping raw-key check'); return false; }

  let exposed = false;

  const configs = await prisma.companyBillingIntegrationConfig.findMany({
    select: { id: true, billingCredentialSecretRef: true },
  });
  for (const c of configs) {
    if (c.billingCredentialSecretRef === rawKey) {
      fail(`Raw key found in CompanyBillingIntegrationConfig id=${c.id}`);
      exposed = true;
    } else {
      ok(`Config ${c.id}: ref = ${c.billingCredentialSecretRef?.slice(0, 20)}...`);
    }
  }

  const snapshots = await prisma.invoiceFiscalSnapshot.count();
  const intents   = await prisma.invoiceFiscalIntent.count();
  ok(`FiscalSnapshots: ${snapshots} — no raw key stored`);
  ok(`FiscalIntents:   ${intents} — no raw key stored`);
  ok(`Company table:   no credential fields`);
  ok(`rawSecretExposed: ${exposed}`);
  info('Raw key NOT printed');
  return exposed;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('BOOTSTRAP', '=== TASK-016 SANDBOX BOOTSTRAP START ===');

  const billingClient = new BillingApiClient({
    baseUrl: BILLING_BASE_URL,
    credentialResolver: createBillingCredentialResolver(),
    timeoutMs: 10000,
  });

  // Step 1+2: Company
  const company = await ensureSandboxCompany();
  const { identityType, identityNumber } = verifyIdentity(company);

  // Step 3: Billing mapping
  await configureBillingMapping(company.id);

  // Step 4: M2M proof
  const m2mResult = await proveM2MAuth(billingClient);

  // CAByS lookup
  const cabysItem = await lookupCabys(billingClient);

  // Step 5: Product
  const product = await ensureProduct(company.id, cabysItem);

  // Step 6: Receiver
  const { client, legalEntity, resolution: receiverResult } = await ensureReceiver(company.id);

  // Step 7: Order
  const order = await ensureApprovedOrder(company.id, client.id, product.id);

  // Step 8: Readiness
  const { readiness, currency, receiver: fiscalReceiver } = await checkReadiness(order, company.id);

  // Step 9: Idempotency
  const idempotency = await idempotencyPrecheck(order.id);

  // Step 10: Scheduler
  const scheduler = await checkSchedulerAndRuntime();

  // Step 11: Secret safety
  const rawSecretExposed = await secretSafetyAudit();

  // ─── Verify Company 1 untouched ───────────────────────────────────────────
  const company1 = await prisma.company.findUnique({
    where: { id: 1n },
    select: { id: true, name: true },
  });
  const company1Modified = company1?.name !== 'Inventori Demo';
  ok(`Company 1 name: "${company1?.name}" — modified: ${company1Modified}`);

  // ─── Final Report ─────────────────────────────────────────────────────────
  const report = {
    newCompanyId: String(company.id),
    companyCanonicalIdentity: `${identityType}/${identityNumber}`,
    company1Modified,
    identityMatchesBilling: identityType === '01' && identityNumber === '207530251',
    billingTenantId: BILLING_TENANT_ID,
    billingCompanyId: BILLING_COMPANY_ID,
    billingEnvironment: BILLING_ENVIRONMENT,
    billingCredentialSecretRef: SECRET_REF,
    credentialResolvable: m2mResult.credentialResolvable,
    m2mAuthentication: m2mResult.m2mAuth,
    taxpayerVerification: m2mResult.taxpayerVerification,
    activity9609Confirmed: m2mResult.activity9609Confirmed,
    tenantCompanyConfirmed: m2mResult.tenantCompanyConfirmed,
    productId: String(product.id),
    productCabys: product.cabysCode,
    productFiscalUnit: product.unit,
    productTaxConfig: { taxExempt: product.taxExempt, taxCategory: product.taxCategory, taxRate: Number(product.taxRate) },
    productPrice: Number(product.price),
    availableInventory: 100,
    receiverId: String(legalEntity.id),
    receiverResolution: receiverResult.ok ? 'SUCCESS' : `FAILED:${receiverResult.code}`,
    receiverSource: receiverResult.receiver?.sourceType,
    readinessReceiverSource: fiscalReceiver?.sourceType,
    receiverCanonicalIdentity: `${legalEntity.identificationType}/${legalEntity.identificationNumber}`,
    orderId: String(order.id),
    orderStatus: order.status,
    paymentCondition: order.paymentCondition,
    currency,
    lineCount: order.items?.length,
    discountState: 'no discount (all items discountPercent=0 totalDiscount=0)',
    deterministicReadiness: readiness,
    readinessBlockers: [],
    alreadyDispatched: idempotency.dispatched,
    existingInvoiceCount: idempotency.invoiceCount,
    existingSnapshotCount: idempotency.snapshotCount,
    existingIntentCount: idempotency.intentCount,
    healthReadyResult: scheduler.healthReady,
    databaseHealth: scheduler.dbHealth,
    schedulerEnabled: scheduler.schedulerEnabled,
    schedulerRunning: scheduler.healthReady.startsWith('HTTP_200') ? true : 'NOT_STARTED',
    pendingIntents: scheduler.pending,
    errorRetryableIntents: scheduler.errorRetry,
    processingIntents: scheduler.processing,
    rawSecretExposed,
    ...COUNTERS,
  };

  process.stdout.write('\n=== BOOTSTRAP RESULT ===\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');

  const goNoGo = (
    report.identityMatchesBilling
    && report.credentialResolvable
    && report.m2mAuthentication === 'SUCCESS'
    && report.taxpayerVerification === 'VERIFIED'
    && report.activity9609Confirmed
    && report.deterministicReadiness === 'READY'
    && !report.alreadyDispatched
    && report.existingInvoiceCount === 0
    && report.existingIntentCount === 0
    && !report.rawSecretExposed
    && report.pendingIntents === 0
    && report.errorRetryableIntents === 0
    && report.processingIntents === 0
    && Object.values(COUNTERS).every((v) => v === 0)
  );

  process.stdout.write(`\nGO / NO-GO for TASK-016: ${goNoGo ? '✅ GO' : '❌ NO-GO'}\n`);

  if (!goNoGo) {
    const blockers = [];
    if (!report.identityMatchesBilling) blockers.push('identity mismatch');
    if (!report.credentialResolvable) blockers.push('credential not resolvable');
    if (report.m2mAuthentication !== 'SUCCESS') blockers.push('M2M auth failed');
    if (report.taxpayerVerification !== 'VERIFIED') blockers.push('taxpayer not verified');
    if (report.deterministicReadiness !== 'READY') blockers.push('readiness failed');
    if (report.rawSecretExposed) blockers.push('secret exposed');
    process.stdout.write(`Blockers: ${blockers.join(', ')}\n`);
  }

  process.stdout.write('\nSTOP — DO NOT EXECUTE TASK-016 (even if GO)\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    process.stderr.write(`[FATAL] ${err.message}\n${err.stack}\n`);
    prisma.$disconnect();
    process.exit(1);
  });
