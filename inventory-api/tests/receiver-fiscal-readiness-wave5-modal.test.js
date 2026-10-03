'use strict';

/**
 * Wave 5 — Fiscal Approval Modal tests
 * RFR-TASK-501: FiscalApprovalModal component
 *
 * Test strategy:
 *   A — Source-level governance (static checks on source files)
 *   B — Pure rendering functions (_buildModalContent, _renderBlockedContent, etc.)
 *   C — API client (getFiscalReadinessPreview, approveOrder body extension)
 *   D — approvals-admin.js integration (source-level)
 *   E — Responsive / accessibility source checks
 *   F — Double-submit / stale-data source checks
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const rootPublicPath  = path.join(__dirname, '..', 'src', 'public', 'root');
const rootViewsPath   = path.join(rootPublicPath, 'views');
const modalSrc        = fs.readFileSync(path.join(rootViewsPath, 'fiscal-approval-modal.js'), 'utf8');
const orderApiSrc     = fs.readFileSync(path.join(rootPublicPath, 'orders-api.js'), 'utf8');
const approvalsAdminSrc = fs.readFileSync(path.join(rootViewsPath, 'approvals-admin.js'), 'utf8');
const indexHtmlSrc    = fs.readFileSync(path.join(rootPublicPath, 'index.html'), 'utf8');

// ─── helpers ──────────────────────────────────────────────────────────────────

function executeRootScript(relativePath, context) {
  const src = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(src, context, { filename: relativePath });
}

function createContext(extra = {}) {
  const bw = { ...extra };
  const ctx = vm.createContext({ Map, Set, window: bw });
  bw.window = bw;
  return { bw, ctx };
}

function buildModalHarness() {
  const { bw, ctx } = createContext();
  executeRootScript('registry.js', ctx);
  executeRootScript('views/fiscal-approval-modal.js', ctx);
  return bw.RootShell.require('views.fiscalApprovalModal');
}

function buildOrdersApiHarness() {
  const fetchCalls = [];
  const { bw, ctx } = createContext({
    InventoryAuth: {
      fetchJson(_session, url, opts) {
        fetchCalls.push({ url, opts });
        return Promise.resolve({ ok: true });
      },
    },
  });
  executeRootScript('registry.js', ctx);
  // orders-api.js uses `typeof globalThis !== 'undefined' ? globalThis : window`.
  // In vm.createContext the sandbox is globalThis but RootShell + InventoryAuth are
  // registered on `window` (bw). Mirror them so both access paths work.
  ctx.RootShell = bw.RootShell;
  ctx.InventoryAuth = bw.InventoryAuth;
  executeRootScript('orders-api.js', ctx);
  return { api: bw.RootShell.require('ordersApi'), fetchCalls };
}

// Minimal preview DTO builders

function readyPreview(overrides = {}) {
  return {
    orderId: '42',
    fiscalBillingEnabled: true,
    receiverState: 'READY',
    receiver: {
      legalName: 'Comercial Demo S.A.',
      identificationType: 'JURIDICA',
      identificationNumber: '3101000000',
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: '2025-06-01T14:30:00.000Z',
    },
    eligibleActivities: [
      { code: '620100', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' },
    ],
    autoSelectedCode: '620100',
    ...overrides,
  };
}

function blockedPreview(receiverState, overrides = {}) {
  return {
    orderId: '77',
    fiscalBillingEnabled: true,
    receiverState,
    receiver: { legalName: 'Cliente SA', identificationType: 'JURIDICA', identificationNumber: '3101000001', verificationStatus: receiverState, lastVerifiedAt: null },
    eligibleActivities: [],
    autoSelectedCode: null,
    ...overrides,
  };
}

function _billingDisabledPreview() {
  return {
    orderId: '99',
    fiscalBillingEnabled: false,
    receiverState: null,
    receiver: null,
    eligibleActivities: [],
    autoSelectedCode: null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// A — Source governance
// ──────────────────────────────────────────────────────────────────────────────

test('[A-01] fiscal-approval-modal.js registers views.fiscalApprovalModal', () => {
  assert.match(modalSrc, /rootShell\.register\('views\.fiscalApprovalModal'/);
});

test('[A-02] fiscal-approval-modal.js exposes openFiscalApprovalModal', () => {
  assert.match(modalSrc, /openFiscalApprovalModal/);
});

test('[A-03] fiscal-approval-modal.js contains ZERO Hacienda URL references', () => {
  assert.doesNotMatch(modalSrc, /hacienda\.go\.cr/i);
  assert.doesNotMatch(modalSrc, /\/fe\/ae/);
});

test('[A-04] fiscal-approval-modal.js contains ZERO direct Billing host references', () => {
  assert.doesNotMatch(modalSrc, /billing[_-]host/i);
  assert.doesNotMatch(modalSrc, /billingApi/);
});

test('[A-05] fiscal-approval-modal.js does NOT store fiscal data in localStorage or sessionStorage', () => {
  assert.doesNotMatch(modalSrc, /localStorage/);
  assert.doesNotMatch(modalSrc, /sessionStorage/);
});

test('[A-06] fiscal-approval-modal.js does NOT log sensitive receiver data to console', () => {
  // No console.log in the modal
  assert.doesNotMatch(modalSrc, /console\.log/);
});

test('[A-07] BLOCKED_MESSAGES covers all api-contract.md receiverState values', () => {
  assert.match(modalSrc, /IDENTITY_INCOMPLETE/);
  assert.match(modalSrc, /IDENTITY_INVALID/);
  assert.match(modalSrc, /UNVERIFIED/);
  assert.match(modalSrc, /NOT_FOUND/);
  assert.match(modalSrc, /VERIFICATION_UNAVAILABLE/);
  assert.match(modalSrc, /ACTIVITIES_MISSING/);
});

test('[A-08] fiscal-approval-modal.js sets role=dialog and aria-modal via setAttribute', () => {
  // The overlay uses setAttribute calls (billing-admin.js pattern)
  assert.match(modalSrc, /'role'.*'dialog'/);
  assert.match(modalSrc, /'aria-modal'/);
});

test('[A-09] fiscal-approval-modal.js uses radio inputs for activity selection', () => {
  assert.match(modalSrc, /type="radio"/);
  assert.match(modalSrc, /name="rfr-activity"/);
});

test('[A-10] fiscal-approval-modal.js has fieldset/legend for keyboard accessibility', () => {
  assert.match(modalSrc, /<fieldset/);
  assert.match(modalSrc, /<legend/);
});

test('[A-11] fiscal-approval-modal.js confirm button has aria-disabled attribute', () => {
  assert.match(modalSrc, /aria-disabled/);
});

test('[A-11b] fiscal-approval-modal.js labels blocked approvals as blocked, not confirmable', () => {
  assert.match(modalSrc, /Aprobación bloqueada/);
  assert.match(modalSrc, /receiverState === 'READY'/);
});

test('[A-12] fiscal-approval-modal.js handles ESC key via keydown listener', () => {
  assert.match(modalSrc, /Escape/);
  assert.match(modalSrc, /addEventListener\('keydown'/);
});

test('[A-13] fiscal-approval-modal.js removes keydown listener on cleanup', () => {
  assert.match(modalSrc, /removeEventListener/);
});

test('[A-14] index.html loads fiscal-approval-modal.js before approvals-admin.js', () => {
  // Use src="..." prefixes to avoid matching the comment line which also mentions approvals-admin.js
  const modalPos     = indexHtmlSrc.indexOf('src="/root/views/fiscal-approval-modal.js"');
  const approvalsPos = indexHtmlSrc.indexOf('src="/root/views/approvals-admin.js"');
  assert.ok(modalPos > -1,     'fiscal-approval-modal.js script tag must be in index.html');
  assert.ok(approvalsPos > -1, 'approvals-admin.js script tag must be in index.html');
  assert.ok(modalPos < approvalsPos, 'fiscal-approval-modal.js must load before approvals-admin.js');
});

// ──────────────────────────────────────────────────────────────────────────────
// B — Pure rendering functions
// ──────────────────────────────────────────────────────────────────────────────

test('[B-01] _buildModalContent: READY + 1 activity → confirmDisabled=false', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(readyPreview());
  assert.equal(confirmDisabled, false);
});

test('[B-02] _buildModalContent: READY + 2 activities, no autoSelected → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const preview = readyPreview({
    eligibleActivities: [
      { code: '620100', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' },
      { code: '471100', description: 'Comercio al por menor', haciendaStatus: 'A', haciendaType: 'S' },
    ],
    autoSelectedCode: null,
  });
  const { confirmDisabled } = modal._buildModalContent(preview);
  assert.equal(confirmDisabled, true);
});

test('[B-03] _buildModalContent: READY + 2 activities + autoSelected → confirmDisabled=false', () => {
  const modal = buildModalHarness();
  const preview = readyPreview({
    eligibleActivities: [
      { code: '620100', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' },
      { code: '471100', description: 'Comercio al por menor', haciendaStatus: 'A', haciendaType: 'S' },
    ],
    autoSelectedCode: '620100',
  });
  const { confirmDisabled } = modal._buildModalContent(preview);
  assert.equal(confirmDisabled, false);
});

test('[B-04] _buildModalContent: UNVERIFIED → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(blockedPreview('UNVERIFIED'));
  assert.equal(confirmDisabled, true);
});

test('[B-05] _buildModalContent: NOT_FOUND → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(blockedPreview('NOT_FOUND'));
  assert.equal(confirmDisabled, true);
});

test('[B-06] _buildModalContent: IDENTITY_INCOMPLETE → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(blockedPreview('IDENTITY_INCOMPLETE'));
  assert.equal(confirmDisabled, true);
});

test('[B-07] _buildModalContent: VERIFICATION_UNAVAILABLE → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(blockedPreview('VERIFICATION_UNAVAILABLE'));
  assert.equal(confirmDisabled, true);
});

test('[B-08] _buildModalContent: ACTIVITIES_MISSING → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(blockedPreview('ACTIVITIES_MISSING'));
  assert.equal(confirmDisabled, true);
});

test('[B-09] _buildModalContent: IDENTITY_INVALID → confirmDisabled=true', () => {
  const modal = buildModalHarness();
  const { confirmDisabled } = modal._buildModalContent(blockedPreview('IDENTITY_INVALID'));
  assert.equal(confirmDisabled, true);
});

test('[B-10] _renderBlockedContent: UNVERIFIED contains canonical Spanish message', () => {
  const modal = buildModalHarness();
  const html = modal._renderBlockedContent('UNVERIFIED', null);
  assert.match(html, /Identidad no verificada con Hacienda\./);
});

test('[B-11] _renderBlockedContent: NOT_FOUND contains canonical Spanish message', () => {
  const modal = buildModalHarness();
  const html = modal._renderBlockedContent('NOT_FOUND', null);
  assert.match(html, /Esta identificación no existe en Hacienda\./);
});

test('[B-12] _renderBlockedContent: ACTIVITIES_MISSING contains canonical Spanish message', () => {
  const modal = buildModalHarness();
  const html = modal._renderBlockedContent('ACTIVITIES_MISSING', null);
  assert.match(html, /No hay actividades económicas/);
});

test('[B-13] _renderBlockedContent: VERIFICATION_UNAVAILABLE contains canonical Spanish message', () => {
  const modal = buildModalHarness();
  const html = modal._renderBlockedContent('VERIFICATION_UNAVAILABLE', null);
  assert.match(html, /No fue posible verificar con Hacienda/);
});

test('[B-13b] _renderBlockedContent: renders explicit blocking reasons', () => {
  const modal = buildModalHarness();
  const html = modal._renderBlockedContent('IDENTITY_INCOMPLETE', null, [
    { field: 'email', message: 'Falta Correo electrónico para facturas.' },
    { field: 'identificationType', message: 'Falta Tipo de identificación.' },
  ]);
  assert.match(html, /Qué falta corregir/);
  assert.match(html, /Correo electrónico para facturas/);
  assert.match(html, /Tipo de identificación/);
});

test('[B-14] _renderBlockedContent: renders receiver legalName when present', () => {
  const modal = buildModalHarness();
  const html = modal._renderBlockedContent('UNVERIFIED', { legalName: 'Demo SA <Corp>' });
  // legalName is escaped
  assert.match(html, /Demo SA &lt;Corp&gt;/);
});

test('[B-15] _renderReceiverInfo: shows "Datos fiscales verificados"', () => {
  const modal = buildModalHarness();
  const html = modal._renderReceiverInfo({
    legalName: 'Comercial Demo S.A.',
    identificationType: 'JURIDICA',
    identificationNumber: '3101000000',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: '2025-06-01T14:30:00.000Z',
  });
  assert.match(html, /Datos fiscales verificados/);
  assert.match(html, /Comercial Demo S\.A\./);
  assert.match(html, /3101000000/);
});

test('[B-16] _renderReceiverInfo: escapes HTML in legalName', () => {
  const modal = buildModalHarness();
  const html = modal._renderReceiverInfo({
    legalName: '<script>alert(1)</script>',
    identificationType: 'FISICA',
    identificationNumber: '123456789',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: null,
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('[B-17] _renderReceiverInfo: does NOT expose verificationStatus field value to UI', () => {
  // The modal must not render "VERIFIED" as a raw string (use human-readable label)
  const modal = buildModalHarness();
  const html = modal._renderReceiverInfo({
    legalName: 'Test SA',
    identificationType: 'JURIDICA',
    identificationNumber: '3101000000',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: null,
  });
  // Raw backend enum value should not be shown verbatim
  assert.doesNotMatch(html, />\s*VERIFIED\s*</);
});

test('[B-18] _renderActivitiesSection: single activity is rendered with code and description', () => {
  const modal = buildModalHarness();
  const html = modal._renderActivitiesSection(
    [{ code: '620100', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' }],
    '620100',
  );
  assert.match(html, /620100/);
  assert.match(html, /Desarrollo de software/);
  assert.match(html, /type="radio"/);
  assert.match(html, /checked/);
});

test('[B-19] _renderActivitiesSection: multiple activities — none pre-checked when autoSelectedCode=null', () => {
  const modal = buildModalHarness();
  const html = modal._renderActivitiesSection(
    [
      { code: '620100', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' },
      { code: '471100', description: 'Comercio al por menor', haciendaStatus: 'A', haciendaType: 'S' },
    ],
    null,
  );
  assert.match(html, /620100/);
  assert.match(html, /471100/);
  // Neither should be checked
  assert.doesNotMatch(html, /checked/);
});

test('[B-20] _renderActivitiesSection: zero activities → empty string', () => {
  const modal = buildModalHarness();
  const html = modal._renderActivitiesSection([], null);
  assert.equal(html.trim(), '');
});

test('[B-21] _renderActivitiesSection: uses fieldset aria-labelledby for accessibility', () => {
  const modal = buildModalHarness();
  const html = modal._renderActivitiesSection(
    [{ code: '620100', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' }],
    null,
  );
  assert.match(html, /<fieldset/);
  assert.match(html, /aria-labelledby/);
});

test('[B-22] _renderActivitiesSection: shows "Principal" for haciendaType P', () => {
  const modal = buildModalHarness();
  const html = modal._renderActivitiesSection(
    [{ code: '620100', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P' }],
    null,
  );
  assert.match(html, /Principal/);
});

test('[B-23] _renderActivitiesSection: shows "Activa" badge for haciendaStatus A', () => {
  const modal = buildModalHarness();
  const html = modal._renderActivitiesSection(
    [{ code: '620100', description: 'Dev', haciendaStatus: 'A', haciendaType: 'P' }],
    null,
  );
  assert.match(html, /Activa/);
});

test('[B-24] _buildModalContent: READY body contains receiver info and activity section', () => {
  const modal = buildModalHarness();
  const { body } = modal._buildModalContent(readyPreview());
  assert.match(body, /Datos fiscales verificados/);
  assert.match(body, /620100/);
});

// ──────────────────────────────────────────────────────────────────────────────
// C — orders-api.js extension
// ──────────────────────────────────────────────────────────────────────────────

test('[C-01] orders-api.js registers getFiscalReadinessPreview in ordersApi', () => {
  assert.match(orderApiSrc, /getFiscalReadinessPreview/);
  assert.match(orderApiSrc, /rootShell\.register\('ordersApi'/);
  const registrationBlock = orderApiSrc.slice(orderApiSrc.indexOf("rootShell.register('ordersApi'"));
  assert.match(registrationBlock, /getFiscalReadinessPreview/);
});

test('[C-02] getFiscalReadinessPreview calls /fiscal-readiness-preview endpoint', () => {
  assert.match(orderApiSrc, /fiscal-readiness-preview/);
});

test('[C-03] getFiscalReadinessPreview uses GET (no method override = GET by default)', () => {
  // The function should not set method:'POST'
  const fnSrc = orderApiSrc.slice(
    orderApiSrc.indexOf('async function getFiscalReadinessPreview'),
    orderApiSrc.indexOf('async function approveOrder'),
  );
  assert.doesNotMatch(fnSrc, /method:\s*['"]POST['"]/);
});

test('[C-04] getFiscalReadinessPreview calls correct URL via API', async () => {
  const { api, fetchCalls } = buildOrdersApiHarness();
  await api.getFiscalReadinessPreview({ user: { id: '1' } }, '42');
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/api\/orders\/42\/fiscal-readiness-preview/);
});

test('[C-05] approveOrder with body sends JSON body with receiverEconomicActivityCode', async () => {
  const { api, fetchCalls } = buildOrdersApiHarness();
  await api.approveOrder({ user: { id: '1' } }, '42', { receiverEconomicActivityCode: '620100' });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].opts.method, 'POST');
  const sentBody = JSON.parse(fetchCalls[0].opts.body);
  assert.equal(sentBody.receiverEconomicActivityCode, '620100');
});

test('[C-06] approveOrder WITHOUT body sends no body (backward-compatible legacy approval)', async () => {
  const { api, fetchCalls } = buildOrdersApiHarness();
  await api.approveOrder({ user: { id: '1' } }, '42');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].opts.body, undefined);
  assert.equal(fetchCalls[0].opts.headers, undefined);
});

test('[C-07] approveOrder body does NOT include companyId, legalName, or Billing secrets', async () => {
  const { api, fetchCalls } = buildOrdersApiHarness();
  await api.approveOrder({ user: { id: '1' } }, '42', { receiverEconomicActivityCode: '620100' });
  const sentBody = JSON.parse(fetchCalls[0].opts.body);
  assert.ok(!('companyId' in sentBody),    'must not send companyId');
  assert.ok(!('legalName' in sentBody),    'must not send legalName');
  assert.ok(!('billingCompanyId' in sentBody), 'must not send billingCompanyId');
  assert.ok(!('isVerified' in sentBody),   'must not send isVerified');
  assert.ok(!('ready' in sentBody),        'must not send ready');
});

// ──────────────────────────────────────────────────────────────────────────────
// D — approvals-admin.js integration (source-level)
// ──────────────────────────────────────────────────────────────────────────────

test('[D-01] approvals-admin.js calls getFiscalReadinessPreview before approving', () => {
  assert.match(approvalsAdminSrc, /getFiscalReadinessPreview/);
});

test('[D-02] approvals-admin.js branches on fiscalBillingEnabled', () => {
  assert.match(approvalsAdminSrc, /fiscalBillingEnabled/);
});

test('[D-03] approvals-admin.js opens fiscal modal when billing is enabled', () => {
  assert.match(approvalsAdminSrc, /openFiscalApprovalModal/);
});

test('[D-04] approvals-admin.js sends receiverEconomicActivityCode in approve body', () => {
  assert.match(approvalsAdminSrc, /receiverEconomicActivityCode/);
});

test('[D-05] approvals-admin.js does NOT approve when activityCode is null (cancel path)', () => {
  // The source must check activityCode === null before calling approveOrder
  assert.match(approvalsAdminSrc, /activityCode === null/);
});

test('[D-06] approvals-admin.js restores button on cancel (disabled=false, text reset)', () => {
  // After cancel, btn.disabled = false and btn.textContent = '✓ Aprobar'
  const cancelBlock = approvalsAdminSrc.slice(
    approvalsAdminSrc.indexOf('activityCode === null'),
    approvalsAdminSrc.indexOf('activityCode === null') + 200,
  );
  assert.match(cancelBlock, /btn\.disabled = false/);
  assert.match(cancelBlock, /Aprobar/);
});

test('[D-07] approvals-admin.js re-enables button on preview fetch failure (error path)', () => {
  // The approve handler is bound via .querySelectorAll('.approvals-approve-btn').
  // Find that section using the querySelectorAll line as anchor.
  const anchor = approvalsAdminSrc.indexOf(".querySelectorAll('.approvals-approve-btn')");
  assert.ok(anchor > -1, 'approvals-approve-btn handler must exist');
  const handlerSection = approvalsAdminSrc.slice(anchor, anchor + 1600);
  assert.match(handlerSection, /btn\.disabled = false/);
  assert.match(handlerSection, /btn\.textContent/);
  assert.match(handlerSection, /Aprobar/);
});

test('[D-08] approvals-admin.js has double-click guard (btn.disabled check)', () => {
  assert.match(approvalsAdminSrc, /if \(btn\.disabled\) return/);
});

test('[D-09] approvals-admin.js requires views.fiscalApprovalModal lazily inside handler', () => {
  assert.match(approvalsAdminSrc, /rootShell\.require\('views\.fiscalApprovalModal'\)/);
});

test('[D-10] approvals-admin.js billing-disabled path calls approveOrder without body', () => {
  // The direct-approve path (billing disabled) must NOT pass receiverEconomicActivityCode
  const billingDisabledPath = approvalsAdminSrc.slice(
    approvalsAdminSrc.indexOf('!preview.fiscalBillingEnabled'),
    approvalsAdminSrc.indexOf('Billing enabled'),
  );
  assert.match(billingDisabledPath, /approveOrder\(session, orderId\)/);
  assert.doesNotMatch(billingDisabledPath, /receiverEconomicActivityCode/);
});

// ──────────────────────────────────────────────────────────────────────────────
// E — Responsive / accessibility source checks
// ──────────────────────────────────────────────────────────────────────────────

test('[E-01] modal has max-width:560px (desktop cap) and width:100% (mobile fill)', () => {
  assert.match(modalSrc, /max-width:560px/);
  assert.match(modalSrc, /width:100%/);
});

test('[E-02] modal has max-height:90vh and overflow-y:auto (internal scroll on small viewports)', () => {
  assert.match(modalSrc, /max-height:90vh/);
  assert.match(modalSrc, /overflow-y:auto/);
});

test('[E-03] modal overlay uses padding:16px (prevents edge-to-edge on narrow viewport)', () => {
  assert.match(modalSrc, /padding:16px/);
});

test('[E-04] confirm and cancel buttons have min-height:44px (mobile tap target)', () => {
  assert.match(modalSrc, /min-height:44px/);
});

test('[E-05] activity items use word-break:break-word (long descriptions wrap)', () => {
  assert.match(modalSrc, /word-break:break-word/);
});

test('[E-06] activity items use flex-wrap:wrap (activity item header line wraps on narrow screens)', () => {
  assert.match(modalSrc, /flex-wrap:wrap/);
});

test('[E-07] overlay uses position:fixed;inset:0 for full-screen cover', () => {
  assert.match(modalSrc, /position:fixed/);
  assert.match(modalSrc, /inset:0/);
});

test('[E-08] modal has aria-labelledby pointing to the modal title', () => {
  // setAttribute call sets aria-labelledby on the overlay
  assert.match(modalSrc, /'aria-labelledby'.*'rfr-modal-title'/);
  // The title element has id="rfr-modal-title" in the innerHTML template
  assert.match(modalSrc, /id="rfr-modal-title"/);
});

test('[E-09] activity radios have aria-label for screen-reader descriptions', () => {
  assert.match(modalSrc, /aria-label="Actividad/);
});

test('[E-10] modal calls .focus() on initial mount for keyboard accessibility', () => {
  assert.match(modalSrc, /\.focus\(\)/);
});

// ──────────────────────────────────────────────────────────────────────────────
// F — Double-submit / stale-data / security checks
// ──────────────────────────────────────────────────────────────────────────────

test('[F-01] modal has confirming flag to prevent double-submit', () => {
  assert.match(modalSrc, /confirming/);
  assert.match(modalSrc, /confirming = true/);
});

test('[F-02] modal confirm handler early-returns if already confirming', () => {
  assert.match(modalSrc, /if \(confirming \|\| confirmBtn\.disabled\) return/);
});

test('[F-03] on stale POST failure the catch block in approvals-admin re-enables button', () => {
  // Use the querySelectorAll anchor to find the actual event handler, not the HTML template.
  const anchor = approvalsAdminSrc.indexOf(".querySelectorAll('.approvals-approve-btn')");
  assert.ok(anchor > -1, 'approve-btn handler section must exist');
  const handlerSection = approvalsAdminSrc.slice(anchor, anchor + 1600);
  assert.match(handlerSection, /showToast/);
  assert.match(handlerSection, /btn\.disabled = false/);
  assert.match(handlerSection, /Aprobar/);
});

test('[F-04] modal cleanup removes keydown listener to prevent memory leak', () => {
  // cleanup() calls removeEventListener('keydown', onKeyDown)
  assert.match(modalSrc, /removeEventListener/);
  assert.match(modalSrc, /'keydown'/);
});

test('[F-05] modal overlay.remove() is called on cleanup (no zombie overlays)', () => {
  assert.match(modalSrc, /overlay\.remove\(\)/);
});

test('[F-06] modal does not expose Billing credentials or internal IDs', () => {
  assert.doesNotMatch(modalSrc, /billingSecret/i);
  assert.doesNotMatch(modalSrc, /clientLegalEntityId/);
  assert.doesNotMatch(modalSrc, /billingCompanyId/);
});
