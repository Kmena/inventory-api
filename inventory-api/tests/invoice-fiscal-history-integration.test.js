'use strict';
/**
 * Wave 8 — Integration + Full Regression (invoice-fiscal-history-integration.test.js)
 * 82 tests — DB-BACKED (real PostgreSQL) + mocked Billing responses.
 * REQUIRES: INVENTORI_BILLING_POSTGRES_TEST=1
 * No real Hacienda. No real Billing HTTP. Isolated fixtures, cleaned up after.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {
  configureFiscalDisposableDatabase,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

// ── Bootstrap ────────────────────────────────────────────────────────────────
const disposableDatabaseConfig = configureFiscalDisposableDatabase();
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const SKIP = !disposableDatabaseConfig;
const runOpts = { skip: SKIP };

// ── Service imports ──────────────────────────────────────────────────────────
const prisma = require('../src/lib/prisma');
const invoiceService    = require('../src/services/invoice.service');
const invoiceRepository = require('../src/repositories/invoice.repository');
const { getFiscalArtifact, listFiscalArtifacts, buildContentDisposition, INVENTORI_TO_BILLING_ARTIFACT_TYPE } =
  require('../src/services/fiscal-artifact-proxy.service');
const { BillingClientError }           = require('../src/services/billing-api-client.service');
const { resolveCanonicalFiscalStatus } = require('../src/services/fiscal-reconciliation.service');
const { buildFiscalDto, buildFiscalDtoDetail, serializeInvoiceForList, serializeInvoiceForDetail } =
  require('../src/services/invoice.service');
const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
const routesPath     = path.join(__dirname, '..', 'src', 'routes');

before(async () => {
  if (!SKIP) {
    await prisma.$connect();
    await verifyFiscalDisposableDatabase(prisma, disposableDatabaseConfig);
  }
});

after(async () => {
  if (!SKIP) await prisma.$disconnect();
});

// ── Fake Billing client (no real HTTP) ───────────────────────────────────────
class FakeW8BillingClient {
  constructor() { this.calls = []; }
  async getArtifact({ artifactType, secretReference: _s, billingFiscalDocumentId: _d, billingCompanyId: _c }) {
    this.calls.push(artifactType);
    const B = { PDF: Buffer.from('%PDF-1.4 w8'), SIGNED_XML: Buffer.from('<?xml?><FE/>'), HACIENDA_RESPONSE_XML: Buffer.from('<?xml?><MR/>') };
    const bytes = B[artifactType];
    if (!bytes) throw new BillingClientError('nf', { code: 'BILLING_HTTP_ERROR', statusCode: 404, retryable: false });
    return { contentType: artifactType === 'PDF' ? 'application/pdf' : 'application/xml', bytes };
  }
  async listArtifacts() {
    return [
      { id: 'a1', type: 'PDF',                  contentType: 'application/pdf', sha256: 'a', sizeBytes: 10, createdAt: '2025-01-15T00:00:00Z' },
      { id: 'a2', type: 'SIGNED_XML',            contentType: 'application/xml', sha256: 'b', sizeBytes: 20, createdAt: '2025-01-15T00:00:00Z' },
      { id: 'a3', type: 'HACIENDA_RESPONSE_XML', contentType: 'application/xml', sha256: 'c', sizeBytes: 15, createdAt: '2025-01-15T00:00:00Z' },
    ];
  }
}

// ── Fixture helpers ──────────────────────────────────────────────────────────
const createdIds = [];
function sfx() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
async function mkCompany(label) {
  const s = sfx();
  const co = await prisma.company.create({ data: { name: `W8-${label}-${s}`, legalId: `W8-${s}`, email: `w8-${s}@t.local` } });
  createdIds.push(co.id); return co;
}
async function mkClient(coId) {
  const s = sfx();
  return prisma.client.create({ data: { companyId: coId, code: `C-${s}`, name: `Cl-${s}`, legalId: `31${s.slice(0,6)}`, documentType: '02', emailBilling: `c-${s}@t.local` } });
}
async function mkConfig(coId) {
  const s = sfx();
  return prisma.companyBillingIntegrationConfig.create({ data: { companyId: coId, billingTenantId: `t-${s}`, billingCompanyId: `bc-w8-${s}`, billingEnvironment: 'SANDBOX', billingCredentialSecretRef: `env:W8_KEY_${s.toUpperCase().replace(/-/g,'_')}`, enabled: true } });
}
async function mkInvoice(clientId, label, opts = {}) {
  const s = sfx();
  const inv = await prisma.invoice.create({ data: { clientId, number: `W8-INV-${label}-${s}`, amount: 1000, status: opts.status ?? 'PENDING', paidAt: opts.paidAt ?? null } });
  if (opts.intent !== false && opts.companyId) {
    await prisma.invoiceFiscalIntent.create({ data: {
      companyId: opts.companyId, invoiceId: inv.id, billingIntegrationConfigId: opts.configId,
      status: opts.intentStatus ?? 'PENDING', idempotencyKey: `w8:${opts.companyId}:${inv.id}:${s}`,
      billingFiscalDocumentId: opts.billingDocId !== undefined ? opts.billingDocId : `bd-w8-${s}`,
      clave: opts.clave !== undefined ? opts.clave : `506${s.slice(0,10)}`.padEnd(50,'0'),
      consecutive: opts.consecutive !== undefined ? opts.consecutive : '001', nextAttemptAt: null,
      metadata: opts.metadata ?? (opts.intentStatus === 'ACCEPTED' ? { billingAcceptedAt: '2025-01-15T14:30:00.000Z' } : null),
    } });
  }
  return inv;
}
async function cleanup() {
  for (const id of [...createdIds].reverse()) {
    await prisma.invoiceFiscalIntent.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.invoiceFiscalSnapshot.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { client: { companyId: id } } }).catch(() => {});
    await prisma.client.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.companyBillingIntegrationConfig.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
  createdIds.length = 0;
}
const bjr = (_, v) => (typeof v === 'bigint' ? v.toString() : v);

// ── Renderer harness ─────────────────────────────────────────────────────────
function buildRendererHarness() {
  const win = {}; const ctx = vm.createContext({ window: win, Map, Set, URLSearchParams }); win.window = win;
  const exec = (r) => vm.runInContext(fs.readFileSync(path.join(rootPublicPath, r), 'utf8'), ctx, { filename: r });
  win.InventoryAuth = { fetchJson: async () => ({}), buildHeaders: () => ({}), handleUnauthorized: () => {} };
  win.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  exec('registry.js'); exec('ui.js'); exec('billing-api.js');
  exec('views/billing-admin.helpers.js'); exec('views/billing-admin.renderers.js');
  return win.RootShell;
}

// =============================================================================
describe('W8 — Fiscal Invoice History & Detail — Integration', runOpts, () => {
  after(cleanup);

  // ── W8-SMOKE (2) ────────────────────────────────────────────────────────────
  test('[W8-SMOKE-001] [DB] Invoice model reachable', async () => {
    assert.ok(await prisma.invoice.count() >= 0);
  });
  test('[W8-SMOKE-002] [DB] InvoiceFiscalIntent model reachable', async () => {
    assert.ok(await prisma.invoiceFiscalIntent.count() >= 0);
  });

  // ── W8-LIST (13): Invoice list fiscal DTO ────────────────────────────────────
  describe('W8-LIST', () => {
    const W = {};
    before(async () => {
      W.co = await mkCompany('list'); W.cl = await mkClient(W.co.id); W.cfg = await mkConfig(W.co.id);
      const b = { companyId: W.co.id, configId: W.cfg.id };
      for (const st of ['ACCEPTED','PENDING','PROCESSING','REJECTED','ERROR_RETRYABLE','ERROR_FINAL'])
        W[st] = await mkInvoice(W.cl.id, st.slice(0,4), { ...b, intentStatus: st });
      W.NIL  = await mkInvoice(W.cl.id, 'nil', { intent: false });
      W.auth = { companyId: W.co.id.toString() };
      W.list = await invoiceService.listInvoices(W.auth);
      W.json = JSON.stringify(W.list, bjr);
    });
    test('[W8-LIST-001] [DB] invoiceNumber is invoice.number (not DB id) (AC-003)', () => {
      const item = W.list.find((i) => i.id === W.ACCEPTED.id);
      assert.ok(item?.invoiceNumber?.startsWith('W8-INV-'), 'must use invoice.number');
      assert.notEqual(item?.invoiceNumber, item?.id?.toString());
    });
    test('[W8-LIST-002] [DB] ACCEPTED → fiscal.status=ACCEPTED', () => { assert.equal(W.list.find((i) => i.id === W.ACCEPTED.id)?.fiscal?.status, 'ACCEPTED'); });
    test('[W8-LIST-003] [DB] PENDING → fiscal.status=PENDING',   () => { assert.equal(W.list.find((i) => i.id === W.PENDING.id)?.fiscal?.status, 'PENDING'); });
    test('[W8-LIST-004] [DB] PROCESSING → fiscal.status=PROCESSING', () => { assert.equal(W.list.find((i) => i.id === W.PROCESSING.id)?.fiscal?.status, 'PROCESSING'); });
    test('[W8-LIST-005] [DB] REJECTED → fiscal.status=REJECTED', () => { assert.equal(W.list.find((i) => i.id === W.REJECTED.id)?.fiscal?.status, 'REJECTED'); });
    test('[W8-LIST-006] [DB] ERROR_RETRYABLE → fiscal.status=ERROR_RETRYABLE', () => { assert.equal(W.list.find((i) => i.id === W.ERROR_RETRYABLE.id)?.fiscal?.status, 'ERROR_RETRYABLE'); });
    test('[W8-LIST-007] [DB] ERROR_FINAL → fiscal.status=ERROR_FINAL', () => { assert.equal(W.list.find((i) => i.id === W.ERROR_FINAL.id)?.fiscal?.status, 'ERROR_FINAL'); });
    test('[W8-LIST-008] [DB] no intent → fiscal=null (AC-006)', () => { assert.equal(W.list.find((i) => i.id === W.NIL.id)?.fiscal, null); });
    test('[W8-LIST-009] [DB] failureMessage absent (AC-008)', () => { assert.ok(!W.json.includes('"failureMessage"')); });
    test('[W8-LIST-010] [DB] billingFiscalDocumentId absent (AC-010)', () => { assert.ok(!W.json.includes('"billingFiscalDocumentId"')); });
    test('[W8-LIST-011] [DB] idempotencyKey absent (AC-010)', () => { assert.ok(!W.json.includes('"idempotencyKey"')); });
    test('[W8-LIST-012] [DB] billingStatus absent (AC-010)', () => { assert.ok(!W.json.includes('"billingStatus"')); });
    test('[W8-LIST-013] [DB] scope restricted to company (no cross-company leakage)', async () => {
      const other = await invoiceService.listInvoices({ companyId: (W.co.id + 9999n).toString() });
      assert.ok(!other.map((i) => i.id.toString()).includes(W.ACCEPTED.id.toString()));
    });
  });

  // ── W8-DETAIL (12): Invoice detail fiscal DTO ─────────────────────────────
  describe('W8-DETAIL', () => {
    const W = {};
    before(async () => {
      W.co = await mkCompany('det'); W.cl = await mkClient(W.co.id); W.cfg = await mkConfig(W.co.id);
      const b = { companyId: W.co.id, configId: W.cfg.id };
      W.acc  = await mkInvoice(W.cl.id, 'ACC', { ...b, intentStatus: 'ACCEPTED', status: 'PAID', paidAt: new Date() });
      W.pnd  = await mkInvoice(W.cl.id, 'PND', { ...b, intentStatus: 'PENDING', clave: null, consecutive: null });
      W.rej  = await mkInvoice(W.cl.id, 'REJ', { ...b, intentStatus: 'REJECTED' });
      W.nil  = await mkInvoice(W.cl.id, 'NIL', { intent: false });
      W.auth = { companyId: W.co.id.toString() };
    });
    test('[W8-DETAIL-001] [DB] invoiceNumber from invoice.number (AC-003)', async () => {
      const d = await invoiceService.getInvoice(W.acc.id, W.auth);
      assert.ok(d.invoiceNumber.startsWith('W8-INV-')); assert.notEqual(d.invoiceNumber, d.id?.toString());
    });
    test('[W8-DETAIL-002] [DB] ACCEPTED → status/clave/consecutive/acceptedAt present (AC-004)', async () => {
      const d = await invoiceService.getInvoice(W.acc.id, W.auth);
      assert.equal(d.fiscal?.status, 'ACCEPTED');
      assert.ok(d.fiscal?.clave && d.fiscal?.consecutive && d.fiscal?.acceptedAt);
    });
    test('[W8-DETAIL-003] [DB] PENDING → clave/consecutive/acceptedAt null (AC-005)', async () => {
      const d = await invoiceService.getInvoice(W.pnd.id, W.auth);
      assert.equal(d.fiscal?.status, 'PENDING');
      assert.equal(d.fiscal?.clave, null); assert.equal(d.fiscal?.consecutive, null); assert.equal(d.fiscal?.acceptedAt, null);
    });
    test('[W8-DETAIL-004] [DB] no intent → fiscal=null (AC-006)', async () => {
      assert.equal((await invoiceService.getInvoice(W.nil.id, W.auth)).fiscal, null);
    });
    test('[W8-DETAIL-005] [DB] REJECTED → acceptedAt null (AC-007)', async () => {
      const d = await invoiceService.getInvoice(W.rej.id, W.auth);
      assert.equal(d.fiscal?.status, 'REJECTED'); assert.equal(d.fiscal?.acceptedAt, null);
    });
    test('[W8-DETAIL-006] [DB] failureMessage absent (AC-009)', async () => {
      assert.ok(!JSON.stringify(await invoiceService.getInvoice(W.rej.id, W.auth), bjr).includes('"failureMessage"'));
    });
    test('[W8-DETAIL-007] [DB] failureCode absent (AC-011)', async () => {
      assert.ok(!JSON.stringify(await invoiceService.getInvoice(W.rej.id, W.auth), bjr).includes('"failureCode"'));
    });
    test('[W8-DETAIL-008] [DB] billingFiscalDocumentId absent (AC-011)', async () => {
      assert.ok(!JSON.stringify(await invoiceService.getInvoice(W.acc.id, W.auth), bjr).includes('"billingFiscalDocumentId"'));
    });
    test('[W8-DETAIL-009] [DB] idempotencyKey absent (AC-011)', async () => {
      assert.ok(!JSON.stringify(await invoiceService.getInvoice(W.acc.id, W.auth), bjr).includes('"idempotencyKey"'));
    });
    test('[W8-DETAIL-010] [DB] billingStatus absent (AC-011)', async () => {
      assert.ok(!JSON.stringify(await invoiceService.getInvoice(W.acc.id, W.auth), bjr).includes('"billingStatus"'));
    });
    test('[W8-DETAIL-011] [DB] paidAt present in detail DTO', async () => {
      assert.ok('paidAt' in await invoiceService.getInvoice(W.acc.id, W.auth));
    });
    test('[W8-DETAIL-012] [DB] payments array present in detail DTO', async () => {
      assert.ok(Array.isArray((await invoiceService.getInvoice(W.acc.id, W.auth)).payments));
    });
  });

  // ── W8-TENANT (5): Cross-company isolation ────────────────────────────────
  describe('W8-TENANT', () => {
    const A = {}, B = {};
    before(async () => {
      A.co = await mkCompany('tA'); A.cl = await mkClient(A.co.id); A.cfg = await mkConfig(A.co.id);
      A.inv = await mkInvoice(A.cl.id, 'A', { companyId: A.co.id, configId: A.cfg.id, intentStatus: 'ACCEPTED' });
      A.auth = { companyId: A.co.id.toString() };
      B.co = await mkCompany('tB'); B.cl = await mkClient(B.co.id); B.cfg = await mkConfig(B.co.id);
      B.inv = await mkInvoice(B.cl.id, 'B', { companyId: B.co.id, configId: B.cfg.id, intentStatus: 'ACCEPTED' });
    });
    test('[W8-TENANT-001] [DB] Company A cannot access Company B invoice → 404 (AC-034)', async () => {
      await assert.rejects(() => invoiceService.getInvoice(B.inv.id, A.auth),
        (e) => { assert.equal(e.statusCode, 404); assert.equal(e.code, 'not_found'); return true; });
    });
    test('[W8-TENANT-002] [DB] Company A list does not include Company B invoices', async () => {
      const ids = (await invoiceService.listInvoices(A.auth)).map((i) => i.id.toString());
      assert.ok(!ids.includes(B.inv.id.toString()));
    });
    test('[W8-TENANT-003] [DB] Company A cannot list Company B artifacts → 404 (AC-035)', async () => {
      await assert.rejects(() => listFiscalArtifacts(B.inv.id, A.co.id, { billingClient: new FakeW8BillingClient() }),
        (e) => { assert.equal(e.statusCode, 404); return true; });
    });
    test('[W8-TENANT-004] [DB] Company A cannot download Company B artifact → 404 (AC-035)', async () => {
      await assert.rejects(() => getFiscalArtifact(B.inv.id, 'pdf', A.co.id, { billingClient: new FakeW8BillingClient() }),
        (e) => { assert.equal(e.statusCode, 404); return true; });
    });
    test('[W8-TENANT-005] [DB] Non-enumeration: foreign=nonexistent=404', async () => {
      const [eF, eM] = await Promise.all([
        invoiceService.getInvoice(B.inv.id, A.auth).catch((e) => e),
        invoiceService.getInvoice(99999999n, A.auth).catch((e) => e),
      ]);
      assert.equal(eF.statusCode, 404); assert.equal(eM.statusCode, 404); assert.equal(eF.code, eM.code);
    });
  });

  // ── W8-ARTIFACT (12): Artifact proxy ────────────────────────────────────────
  describe('W8-ARTIFACT', () => {
    const W = {};
    before(async () => {
      W.co = await mkCompany('art'); W.cl = await mkClient(W.co.id); W.cfg = await mkConfig(W.co.id);
      const b = { companyId: W.co.id, configId: W.cfg.id };
      W.acc     = await mkInvoice(W.cl.id, 'AA', { ...b, intentStatus: 'ACCEPTED' });
      W.noDocId = await mkInvoice(W.cl.id, 'AP', { ...b, intentStatus: 'PENDING', billingDocId: null, clave: null });
      W.noInt   = await mkInvoice(W.cl.id, 'AN', { intent: false });
    });
    test('[W8-ART-001] [DB] listFiscalArtifacts returns non-empty list for ACCEPTED', async () => {
      const arts = await listFiscalArtifacts(W.acc.id, W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.ok(Array.isArray(arts) && arts.length > 0); assert.ok(arts.every((a) => a.inventoriType));
    });
    test('[W8-ART-002] [DB] listFiscalArtifacts: no billingFiscalDocumentId in response', async () => {
      assert.ok(!JSON.stringify(await listFiscalArtifacts(W.acc.id, W.co.id, { billingClient: new FakeW8BillingClient() })).includes('billingFiscalDocumentId'));
    });
    test('[W8-ART-003] [DB] listFiscalArtifacts: no secretRef in response (AC-036)', async () => {
      assert.ok(!JSON.stringify(await listFiscalArtifacts(W.acc.id, W.co.id, { billingClient: new FakeW8BillingClient() })).includes('billingCredentialSecretRef'));
    });
    test('[W8-ART-004] [DB] getFiscalArtifact PDF proxied exactly (AC-030)', async () => {
      const r = await getFiscalArtifact(W.acc.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.equal(r.contentType, 'application/pdf'); assert.ok(r.bytes.toString().startsWith('%PDF'));
    });
    test('[W8-ART-005] [DB] getFiscalArtifact signed-xml proxied', async () => {
      const r = await getFiscalArtifact(W.acc.id, 'signed-xml', W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.equal(r.contentType, 'application/xml'); assert.ok(r.bytes.toString().includes('<FE'));
    });
    test('[W8-ART-006] [DB] getFiscalArtifact hacienda-response proxied', async () => {
      const r = await getFiscalArtifact(W.acc.id, 'hacienda-response', W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.equal(r.contentType, 'application/xml'); assert.ok(r.bytes.toString().includes('<MR'));
    });
    test('[W8-ART-007] [DB] PENDING + no billingFiscalDocumentId → 422 ARTIFACT_NOT_READY', async () => {
      await assert.rejects(() => getFiscalArtifact(W.noDocId.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() }),
        (e) => { assert.equal(e.statusCode, 422); assert.equal(e.code, 'ARTIFACT_NOT_READY'); return true; });
    });
    test('[W8-ART-008] [DB] no fiscal intent → 422 FISCAL_INTENT_NOT_FOUND', async () => {
      await assert.rejects(() => getFiscalArtifact(W.noInt.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() }),
        (e) => { assert.equal(e.statusCode, 422); assert.equal(e.code, 'FISCAL_INTENT_NOT_FOUND'); return true; });
    });
    test('[W8-ART-009] [DB] billingCompanyId comes from DB config (not caller)', async () => {
      let captured = null;
      const client = { async getArtifact(p) { captured = p.billingCompanyId; return { contentType:'application/pdf', bytes: Buffer.from('%PDF') }; }, async listArtifacts() { return []; } };
      await getFiscalArtifact(W.acc.id, 'pdf', W.co.id, { billingClient: client });
      assert.ok(captured?.startsWith('bc-w8-'), 'billingCompanyId must come from DB config');
    });
    test('[W8-ART-010] [DB] secretRef passed to billing client but never returned in result (AC-036)', async () => {
      let capturedRef = null;
      const client = { async getArtifact(p) { capturedRef = p.secretReference; return { contentType:'application/pdf', bytes: Buffer.from('%PDF') }; }, async listArtifacts() { return []; } };
      const r = await getFiscalArtifact(W.acc.id, 'pdf', W.co.id, { billingClient: client });
      assert.ok(capturedRef?.startsWith('env:'), 'secretRef must be passed to billing');
      assert.ok(!JSON.stringify(r, (k, v) => Buffer.isBuffer(v) ? v.toString() : v).includes(capturedRef));
    });
    test('[W8-ART-011] [DB] Invoice/intent state unchanged after artifact retrieval', async () => {
      const before = await prisma.invoiceFiscalIntent.findUnique({ where: { invoiceId: W.acc.id } });
      await getFiscalArtifact(W.acc.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() });
      const after  = await prisma.invoiceFiscalIntent.findUnique({ where: { invoiceId: W.acc.id } });
      assert.equal(after.status, before.status); assert.equal(after.clave?.toString(), before.clave?.toString());
    });
    test('[W8-ART-012] [DB] Content-Disposition set by Inventori (not forwarded from Billing)', async () => {
      const r = await getFiscalArtifact(W.acc.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.ok(r.contentDisposition?.startsWith('attachment;'), 'contentDisposition must be set by Inventori');
    });
  });

  // ── W8-INDEP (6): Commercial/fiscal independence ──────────────────────────
  describe('W8-INDEP', () => {
    const W = {};
    before(async () => {
      W.co = await mkCompany('ind'); W.cl = await mkClient(W.co.id); W.cfg = await mkConfig(W.co.id);
      const b = { companyId: W.co.id, configId: W.cfg.id };
      W.pA = await mkInvoice(W.cl.id, 'PA', { ...b, status:'PAID',    intentStatus:'ACCEPTED', paidAt: new Date() });
      W.pR = await mkInvoice(W.cl.id, 'PR', { ...b, status:'PAID',    intentStatus:'REJECTED', paidAt: new Date() });
      W.nA = await mkInvoice(W.cl.id, 'NA', { ...b, status:'PENDING', intentStatus:'ACCEPTED' });
      W.auth = { companyId: W.co.id.toString() };
    });
    test('[W8-INDEP-001] [DB] PAID + ACCEPTED: both states preserved', async () => {
      const d = await invoiceService.getInvoice(W.pA.id, W.auth);
      assert.equal(d.status,'PAID'); assert.equal(d.fiscal?.status,'ACCEPTED');
    });
    test('[W8-INDEP-002] [DB] PAID + REJECTED: both states preserved', async () => {
      const d = await invoiceService.getInvoice(W.pR.id, W.auth);
      assert.equal(d.status,'PAID'); assert.equal(d.fiscal?.status,'REJECTED');
    });
    test('[W8-INDEP-003] [DB] PENDING + ACCEPTED: both states independent', async () => {
      const d = await invoiceService.getInvoice(W.nA.id, W.auth);
      assert.equal(d.status,'PENDING'); assert.equal(d.fiscal?.status,'ACCEPTED');
    });
    test('[W8-INDEP-004] [DB] fiscal status not derived from commercial status', async () => {
      assert.notEqual((await invoiceService.getInvoice(W.pR.id, W.auth)).fiscal?.status, 'ACCEPTED');
    });
    test('[W8-INDEP-005] [DB] commercial status not derived from fiscal status', async () => {
      assert.notEqual((await invoiceService.getInvoice(W.nA.id, W.auth)).status, 'ACCEPTED');
    });
    test('[W8-INDEP-006] [DB] artifact download does not change Invoice.status', async () => {
      const before = await prisma.invoice.findUnique({ where: { id: W.pA.id } });
      await getFiscalArtifact(W.pA.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.equal((await prisma.invoice.findUnique({ where: { id: W.pA.id } })).status, before.status);
    });
  });

  // ── W8-E2E (8): Full end-to-end flow ─────────────────────────────────────
  describe('W8-E2E', () => {
    const W = {};
    before(async () => {
      W.co = await mkCompany('e2e'); W.cl = await mkClient(W.co.id); W.cfg = await mkConfig(W.co.id);
      const b = { companyId: W.co.id, configId: W.cfg.id };
      W.acc = await mkInvoice(W.cl.id, 'ACC', { ...b, status:'PAID', intentStatus:'ACCEPTED', paidAt:new Date() });
      for (const st of ['PENDING','PROCESSING','REJECTED','ERROR_RETRYABLE','ERROR_FINAL'])
        W[st] = await mkInvoice(W.cl.id, st.slice(0,3), { ...b, intentStatus: st });
      W.nil  = await mkInvoice(W.cl.id, 'nil', { intent: false });
      W.auth = { companyId: W.co.id.toString() };
    });
    test('[W8-E2E-001] [DB] list shows fiscal.status for ACCEPTED invoice', async () => {
      assert.equal((await invoiceService.listInvoices(W.auth)).find((i) => i.id === W.acc.id)?.fiscal?.status, 'ACCEPTED');
    });
    test('[W8-E2E-002] [DB] detail: ACCEPTED has clave/consecutive/acceptedAt', async () => {
      const d = await invoiceService.getInvoice(W.acc.id, W.auth);
      assert.ok(d.fiscal?.clave && d.fiscal?.consecutive && d.fiscal?.acceptedAt);
    });
    test('[W8-E2E-003] [DB] artifact list available for ACCEPTED invoice', async () => {
      const arts = await listFiscalArtifacts(W.acc.id, W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.ok(arts.some((a) => a.inventoriType === 'pdf'));
    });
    test('[W8-E2E-004] [DB] PDF download proxied through full service layer', async () => {
      const r = await getFiscalArtifact(W.acc.id, 'pdf', W.co.id, { billingClient: new FakeW8BillingClient() });
      assert.ok(r.bytes?.length > 0 && r.contentType === 'application/pdf' && r.contentDisposition?.includes('attachment'));
    });
    test('[W8-E2E-005] [DB] all six fiscal states coexist in one list', async () => {
      const statuses = new Set((await invoiceService.listInvoices(W.auth)).filter((i) => i.fiscal).map((i) => i.fiscal.status));
      for (const st of ['ACCEPTED','PENDING','PROCESSING','REJECTED','ERROR_RETRYABLE','ERROR_FINAL'])
        assert.ok(statuses.has(st), `${st} must be in list`);
    });
    test('[W8-E2E-006] [DB] no-intent invoice coexists with fiscal invoices in list', async () => {
      const nil = (await invoiceService.listInvoices(W.auth)).find((i) => i.id === W.nil.id);
      assert.ok(nil && nil.fiscal === null);
    });
    test('[W8-E2E-007] [DB] cross-company blocked at every step (list + detail)', async () => {
      const oAuth = { companyId: (W.co.id + 99999n).toString() };
      const list = await invoiceService.listInvoices(oAuth);
      assert.ok(!list.map((i) => i.id.toString()).includes(W.acc.id.toString()));
      const err = await invoiceService.getInvoice(W.acc.id, oAuth).catch((e) => e);
      assert.equal(err?.statusCode, 404);
    });
    test('[W8-E2E-008] [DB] invoiceNumber consistent from list to detail (formatted, not DB id)', async () => {
      const list = await invoiceService.listInvoices(W.auth);
      const detail = await invoiceService.getInvoice(W.acc.id, W.auth);
      const listItem = list.find((i) => i.id === W.acc.id);
      assert.equal(listItem.invoiceNumber, detail.invoiceNumber);
      assert.ok(detail.invoiceNumber.startsWith('W8-INV-'));
    });
  });

  // ── W8-AUTH (5): Auth / scope gates ──────────────────────────────────────
  describe('W8-AUTH', () => {
    test('[W8-AUTH-001] [SVC-MOCK] listInvoices: null companyId → 403', async () => {
      await assert.rejects(() => invoiceService.listInvoices({ companyId: null }),
        (e) => { assert.equal(e.statusCode, 403); assert.equal(e.code, 'forbidden'); return true; });
    });
    test('[W8-AUTH-002] [SVC-MOCK] getInvoice: undefined companyId → 403', async () => {
      await assert.rejects(() => invoiceService.getInvoice(1n, { companyId: undefined }),
        (e) => { assert.equal(e.statusCode, 403); return true; });
    });
    test('[W8-AUTH-003] [SRC] invoice.routes.js applies router.use(authenticate)', () => {
      assert.ok(fs.readFileSync(path.join(routesPath, 'invoice.routes.js'), 'utf8').includes('router.use(authenticate)'));
    });
    test('[W8-AUTH-004] [SRC] artifact route checks req.auth?.companyId before proxying', () => {
      assert.ok(fs.readFileSync(path.join(routesPath, 'invoice.routes.js'), 'utf8').includes('req.auth?.companyId'));
    });
    test('[W8-AUTH-005] [SVC-MOCK] companyId string → coerced to BigInt (passthrough to repository)', async () => {
      let captured = null;
      const orig = invoiceRepository.findCompanyInvoices;
      invoiceRepository.findCompanyInvoices = async (id) => { captured = id; return []; };
      try { await invoiceService.listInvoices({ companyId: '42' }); } finally { invoiceRepository.findCompanyInvoices = orig; }
      assert.equal(captured, 42n);
    });
  });

  // ── W8-REG (19): Wave regression guards ──────────────────────────────────
  describe('W8-REG', () => {
    let shell;
    before(() => { shell = buildRendererHarness(); });
    // Wave 1
    test('[W8-REG-001] [UNIT] Wave 1: buildFiscalDto(null)=null', () => { assert.equal(buildFiscalDto(null), null); });
    test('[W8-REG-002] [UNIT] Wave 1: buildFiscalDtoDetail acceptedAt only for ACCEPTED', () => {
      assert.equal(buildFiscalDtoDetail({ status:'REJECTED', clave:'x', consecutive:'1', metadata:{ billingAcceptedAt:'2025-01-01T00:00:00Z' } })?.acceptedAt, null);
    });
    test('[W8-REG-003] [UNIT] Wave 1: serializeInvoiceForList includes invoiceNumber from invoice.number', () => {
      assert.equal(serializeInvoiceForList({ id:1n, number:'INV-99', clientId:1n, amount:0, status:'PENDING', payments:[], fiscalIntent:null }).invoiceNumber, 'INV-99');
    });
    test('[W8-REG-004] [UNIT] Wave 1: serializeInvoiceForDetail has paidAt + payments + fiscal', () => {
      const r = serializeInvoiceForDetail({ id:1n, number:'INV-1', clientId:1n, amount:0, status:'PAID', paidAt:null, payments:[], fiscalIntent:null, order:null });
      assert.ok('paidAt' in r && 'payments' in r && 'fiscal' in r);
    });
    // Wave 2
    test('[W8-REG-005] [RENDER] Wave 2: fiscalStatusListLabel non-empty for all 6 states', () => {
      const bh = shell.require('views.billingAdminHelpers');
      for (const st of ['ACCEPTED','PENDING','PROCESSING','REJECTED','ERROR_RETRYABLE','ERROR_FINAL'])
        assert.ok(bh.fiscalStatusListLabel(st), `must be non-empty for ${st}`);
    });
    test('[W8-REG-006] [RENDER] Wave 2: renderReceivablesTable shows fiscal badge for ACCEPTED', () => {
      const html = shell.require('views.billingAdminRenderers').renderReceivablesTable([{ id:1n, invoiceNumber:'INV-1', clientName:'X', amount:100, pendingAmount:0, status:'PAID', dueAt:null, payments:[], fiscal:{status:'ACCEPTED'} }], {});
      assert.ok(html.includes('Aceptada') || html.includes('✓'));
    });
    // Wave 3
    test('[W8-REG-007] [RENDER] Wave 3: renderInvoiceDetailContent exported', () => {
      assert.equal(typeof shell.require('views.billingAdminRenderers').renderInvoiceDetailContent, 'function');
    });
    test('[W8-REG-008] [SRC] Wave 3: dialog has role="dialog" in billing-admin.js', () => {
      assert.ok(fs.readFileSync(path.join(rootPublicPath, 'views', 'billing-admin.js'), 'utf8').includes('role="dialog"'));
    });
    // Wave 4
    test('[W8-REG-009] [RENDER] Wave 4: renderFiscalStatusSection exported', () => {
      assert.equal(typeof shell.require('views.billingAdminRenderers').renderFiscalStatusSection, 'function');
    });
    test('[W8-REG-010] [RENDER] Wave 4: ACCEPTED section renders clave and consecutive', () => {
      const html = shell.require('views.billingAdminRenderers').renderFiscalStatusSection({ status:'ACCEPTED', clave:'50625TESTCLAVE', consecutive:'00100001', acceptedAt:'2025-01-15T14:30:00.000Z' });
      assert.ok(html.includes('50625TESTCLAVE') && html.includes('00100001'));
    });
    // Wave 5
    test('[W8-REG-011] [RENDER] Wave 5: renderArtifactActions exported', () => {
      assert.equal(typeof shell.require('views.billingAdminRenderers').renderArtifactActions, 'function');
    });
    test('[W8-REG-012] [RENDER] Wave 5: artifact URLs use /api/invoices/ (Inventori proxy, not Billing)', () => {
      const html = shell.require('views.billingAdminRenderers').renderArtifactActions(1, [{ inventoriType:'pdf' }], { escapeHtml:(s)=>s });
      assert.ok(html.includes('/api/invoices/') && !html.includes('http://billing'));
    });
    // Wave 6
    test('[W8-REG-013] [UNIT] Wave 6: INVENTORI_TO_BILLING_ARTIFACT_TYPE has exactly 3 types', () => {
      assert.deepEqual(Object.keys(INVENTORI_TO_BILLING_ARTIFACT_TYPE).sort(), ['hacienda-response','pdf','signed-xml'].sort());
    });
    test('[W8-REG-014] [UNIT] Wave 6: buildContentDisposition has no CRLF', () => {
      const cd = buildContentDisposition('PDF', '50625092600020753025100100001010000000001101924748', 1n);
      assert.ok(!cd.includes('\r') && !cd.includes('\n'));
    });
    // Wave 7
    test('[W8-REG-015] [SRC] Wave 7: dialog has aria-modal="true"', () => {
      assert.ok(fs.readFileSync(path.join(rootPublicPath, 'views', 'billing-admin.js'), 'utf8').includes('aria-modal="true"'));
    });
    test('[W8-REG-016] [RENDER] Wave 7: artifact links have aria-label', () => {
      const html = shell.require('views.billingAdminRenderers').renderArtifactActions('963', [{ inventoriType:'pdf' }], { escapeHtml:(s)=>s }, 'INV-963');
      assert.ok(html.includes('aria-label'));
    });
    test('[W8-REG-017] [RENDER] Wave 7: loading state has role="status"', () => {
      assert.ok(shell.require('views.billingAdminRenderers').renderInvoiceDetailLoading().includes('role="status"'));
    });
    // Reconciliation regression (TASK-013b)
    test('[W8-REG-018] [UNIT] Reconciliation: QUEUED → PROCESSING (TASK-013b)', () => {
      assert.equal(resolveCanonicalFiscalStatus({ fiscalStatus:'QUEUED' }), 'PROCESSING');
    });
    test('[W8-REG-019] [UNIT] Reconciliation: ACCEPTED → ACCEPTED', () => {
      assert.equal(resolveCanonicalFiscalStatus({ fiscalStatus:'ACCEPTED', haciendaStatus:'ACCEPTED' }), 'ACCEPTED');
    });
  });
});
