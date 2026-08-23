const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function createHarness() {
  const browserWindow = {
    InventoryAuth: { fetchJson: async () => null, bootstrapSession: async () => null },
    InventorySession: { read: () => null },
  };
  const context = vm.createContext({ window: browserWindow, Map, URLSearchParams });
  browserWindow.window = browserWindow;

  function executeRootScript(relativePath) {
    vm.runInContext(readRootFile(relativePath), context, { filename: relativePath });
  }

  // registry.js sets window.RootShell — must run first
  executeRootScript('registry.js');
  executeRootScript('ui.js');

  // Register stubs required at module initialisation time
  browserWindow.RootShell.register('sessionAdapter', {
    hasPermission: (session, permission) => Boolean(session?.user?.permissions?.includes(permission)),
    isAuthenticated: (session) => Boolean(session?.user?.id),
    readSnapshot: () => null,
    bootstrap: async () => null,
    getActorType: () => 'unknown',
  });
  browserWindow.RootShell.register('rfqTrackingApi', {
    listTracking: async () => [],
    submitManualResponse: async () => null,
    cancelRequest: async () => null,
  });

  executeRootScript('views/rfq-tracking-admin.renderers.js');
  executeRootScript('views/rfq-tracking-admin.js');

  return browserWindow.RootShell;
}

const sampleItems = [
  { productId: 1, productName: 'Azúcar', quantity: 10, unit: 'KG' },
  { productId: 2, productName: 'Sal', quantity: 5, unit: 'KG' },
];

const sampleRequest = {
  purchaseRequestId: 5,
  title: 'Compra semanal',
  createdAt: '2026-08-13T00:00:00.000Z',
  itemCount: 2,
  status: 'OPEN',
  quotationCount: 1,
  respondedInvitationCount: 1,
  manualResponseCount: 0,
  publicResponseCount: 1,
  hasInvitations: true,
  items: sampleItems,
  invitations: [{
    id: 1, supplierId: 10, supplierName: 'Proveedor Uno', supplierEmail: 'uno@example.com',
    status: 'RESPONDED', responseSource: 'PUBLIC_TOKEN',
    expiresAt: '2026-08-21T00:00:00.000Z', respondedAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z',
  }],
  quotations: [{
    id: 99, supplierId: 10, status: 'SUBMITTED', responseSource: 'PUBLIC_TOKEN',
    supplierName: 'Proveedor Uno', currency: 'CRC',
    items: [{ productId: 1, productName: 'Azúcar', quantity: 10, unitPrice: 800, leadTimeDays: 2, notes: null }],
  }],
};

// ─── Layout & wiring ──────────────────────────────────────────────────────────

test('rfq tracking view render exposes dedicated tracking workspace and manual response dialog', () => {
  const rootShell = createHarness();
  const view = rootShell.require('views.rfqTrackingAdmin');
  const markup = view.render();

  assert.match(markup, /Seguimiento de cotizaciones/);
  assert.match(markup, /Solicitudes abiertas/);
  assert.match(markup, /commercial-layout/);
  assert.match(markup, /commercial-list-card/);
  assert.match(markup, /commercial-detail-card/);
  assert.match(markup, /rfq-tracking-sidebar/);
  assert.match(markup, /rfq-tracking-detail-panel/);
  assert.match(markup, /rfq-tracking-detail-region/);
  assert.match(markup, /rfq-tracking-list-region/);
  assert.match(markup, /rfq-tracking-sidebar-list/);
  assert.match(markup, /rfq-tracking-manual-dialog/);
  assert.match(markup, /Actualizar/);
});

test('rfq tracking view render includes cancel confirmation dialog', () => {
  const rootShell = createHarness();
  const markup = rootShell.require('views.rfqTrackingAdmin').render();

  assert.match(markup, /rfq-tracking-cancel-dialog/);
  assert.match(markup, /rfq-tracking-cancel-confirm-button/);
  assert.match(markup, /rfq-tracking-cancel-close-button/);
  assert.match(markup, /rfq-tracking-cancel-abort-button/);
  assert.match(markup, /rfq-tracking-cancel-name/);
  assert.match(markup, /Sí, cancelar solicitud/);
  assert.match(markup, /Mantener abierta/);
});

test('rfq tracking renderers expose sidebar item, detail placeholder and request detail functions', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');

  assert.equal(typeof renderers.renderRequestListItem, 'function');
  assert.equal(typeof renderers.renderDetailPlaceholder, 'function');
  assert.equal(typeof renderers.renderRequestDetail, 'function');
  assert.equal(typeof renderers.renderManualResponseDialog, 'function');
  assert.equal(typeof renderers.renderEmptyState, 'function');
});

// ─── Sidebar item ─────────────────────────────────────────────────────────────

test('rfq tracking renderers renderRequestListItem produces sidebar button with state badge', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestListItem(sampleRequest);

  assert.match(html, /commercial-list-item/);
  assert.match(html, /data-request-id="5"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Compra semanal/);
  assert.match(html, /2 producto/);
  assert.match(html, /Con respuestas/);
  assert.match(html, /1 inv\./);
});

// ─── Detail placeholder ───────────────────────────────────────────────────────

test('rfq tracking renderers renderDetailPlaceholder shows instructional empty state', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderDetailPlaceholder();

  assert.match(html, /Selecciona una solicitud/);
  assert.match(html, /empty-state/);
});

// ─── Items section ────────────────────────────────────────────────────────────

test('rfq tracking renderers renderRequestDetail shows products being quoted', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail(sampleRequest, true);

  assert.match(html, /Qué se está cotizando/);
  assert.match(html, /Azúcar/);
  assert.match(html, /Sal/);
  assert.match(html, /data-label="Unidad"/);
});

test('rfq tracking renderers renderRequestDetail shows empty products message when items array is empty', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail({ ...sampleRequest, items: [] }, true);

  assert.match(html, /Qué se está cotizando/);
  assert.match(html, /Sin productos registrados/);
});

// ─── Pending response section ─────────────────────────────────────────────────

test('rfq tracking renderers renderRequestDetail shows pending response section for PREPARED invitations when canManage', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const requestWithPrepared = {
    ...sampleRequest,
    invitations: [{
      id: 2, supplierId: 20, supplierName: 'Prov Pending', supplierEmail: 'prov@test.com',
      status: 'PREPARED', responseSource: null,
      expiresAt: '2026-08-21T00:00:00.000Z', respondedAt: null, createdAt: '2026-08-13T00:00:00.000Z',
    }],
  };

  const htmlManage = renderers.renderRequestDetail(requestWithPrepared, true);
  assert.match(htmlManage, /Pendientes de respuesta manual/);
  assert.match(htmlManage, /rfq-tracking-manual-response-button/);
  assert.match(htmlManage, /Registrar respuesta/);
  assert.match(htmlManage, /Prov Pending/);

  const htmlReadOnly = renderers.renderRequestDetail(requestWithPrepared, false);
  assert.doesNotMatch(htmlReadOnly, /Pendientes de respuesta manual/);
  assert.doesNotMatch(htmlReadOnly, /rfq-tracking-manual-response-button/);
});

test('rfq tracking renderers renderRequestDetail does not show pending section when no PREPARED invitations', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  // All invitations are RESPONDED — no PREPARED
  const html = renderers.renderRequestDetail(sampleRequest, true);

  assert.doesNotMatch(html, /Pendientes de respuesta manual/);
  assert.doesNotMatch(html, /rfq-tracking-manual-response-button/);
});

test('rfq tracking renderers renderRequestDetail does not show Registrar respuesta for expired invitations', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const expiredRequest = {
    ...sampleRequest,
    invitations: [{
      id: 3, supplierId: 30, supplierName: 'Prov Expirado', supplierEmail: null,
      status: 'EXPIRED', responseSource: null,
      expiresAt: '2026-08-10T00:00:00.000Z', respondedAt: null, createdAt: '2026-08-09T00:00:00.000Z',
    }],
  };

  const html = renderers.renderRequestDetail(expiredRequest, true);

  assert.match(html, /Expirada/);
  assert.doesNotMatch(html, /rfq-tracking-manual-response-button/);
  assert.doesNotMatch(html, /Registrar respuesta/);
});

// ─── Invitations table (simplified — no Action/Origin columns) ────────────────

test('rfq tracking renderers renderRequestDetail invitations table shows state, responded date and expiry without action column', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  // Use a request without quotations to isolate the invitations table output
  const requestNoQuotations = { ...sampleRequest, quotations: [] };
  const html = renderers.renderRequestDetail(requestNoQuotations, true);

  assert.match(html, /Invitaciones/);
  assert.match(html, /Proveedor Uno/);
  assert.match(html, /Respondida/);
  // Invitations table must NOT have action or origin column (buttons are in pending section)
  assert.doesNotMatch(html, /data-label="Acción"/);
  // Origen is absent when quotations is empty (no response details section rendered)
  assert.doesNotMatch(html, /data-label="Origen"/);
});

// ─── Operational state ────────────────────────────────────────────────────────

test('rfq tracking renderers renderRequestDetail shows operational state, metrics and supplier status', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail(sampleRequest, true);

  assert.match(html, /Compra semanal/);
  assert.match(html, /Creada:/);
  assert.match(html, /Con respuestas/);
  assert.match(html, /Proveedor Uno/);
  assert.match(html, /Invitaciones: 1/);
  assert.match(html, /Respondidas: 1/);
  assert.match(html, /Estado del request/);
});

test('rfq tracking renderers renderRequestDetail shows Pendiente de invitar for requests without invitations', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail({
    purchaseRequestId: 13,
    title: 'Compra sin invitaciones',
    createdAt: '2026-08-13T00:00:00.000Z',
    itemCount: 3,
    status: 'OPEN',
    quotationCount: 0,
    respondedInvitationCount: 0,
    manualResponseCount: 0,
    publicResponseCount: 0,
    hasInvitations: false,
    items: sampleItems,
    invitations: [],
    quotations: [],
  }, true);

  assert.match(html, /Pendiente de invitar/);
  assert.match(html, /Pendiente de invitar proveedores/);
});

test('rfq tracking renderers renderRequestDetail excludes initial quotations (responseSource null) from response detail', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const requestWithMixedQuotations = {
    ...sampleRequest,
    invitations: [{
      id: 1, supplierId: 10, supplierName: 'Senac', supplierEmail: 'senac@example.com',
      status: 'RESPONDED', responseSource: 'PUBLIC_TOKEN',
      expiresAt: null, respondedAt: '2026-08-14T10:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z',
    }],
    quotations: [
      {
        id: 200, supplierId: 10, status: 'SUBMITTED', responseSource: null,
        supplierName: 'Senac', currency: 'CRC',
        items: [{ productId: 1, productName: 'Glicelana', quantity: 50, unitPrice: 1560, leadTimeDays: 7, notes: null }],
      },
      {
        id: 201, supplierId: 10, status: 'SUBMITTED', responseSource: 'PUBLIC_TOKEN',
        supplierName: 'Senac', currency: 'CRC',
        items: [{ productId: 1, productName: 'Glicelana', quantity: 50, unitPrice: 2500, leadTimeDays: 3, notes: null }],
      },
    ],
  };

  const html = renderers.renderRequestDetail(requestWithMixedQuotations, true);

  assert.match(html, /PUBLIC_TOKEN/);
  assert.match(html, /2500/);
  assert.doesNotMatch(html, /1560/, 'initial quotation price (responseSource null) must not appear');
  assert.match(html, /Con respuestas/);
});

test('rfq tracking renderers renderRequestDetail shows En seguimiento when invitations exist but none responded', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail({
    purchaseRequestId: 88,
    title: 'Compra esperando',
    createdAt: '2026-08-13T00:00:00.000Z',
    itemCount: 1,
    status: 'OPEN',
    quotationCount: 0,
    respondedInvitationCount: 0,
    manualResponseCount: 0,
    publicResponseCount: 0,
    hasInvitations: true,
    items: sampleItems,
    invitations: [{ id: 5, supplierId: 20, supplierName: 'Prov A', supplierEmail: null, status: 'PREPARED', responseSource: null, expiresAt: null, respondedAt: null, createdAt: '2026-08-13T00:00:00.000Z' }],
    quotations: [],
  }, true);

  assert.match(html, /En seguimiento/);
  assert.doesNotMatch(html, /Con respuestas/);
  assert.doesNotMatch(html, /Detalle de respuestas/);
});

// ─── Close section ────────────────────────────────────────────────────────────

test('rfq tracking renderers renderRequestDetail shows close section for canManage users', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail(sampleRequest, true);

  assert.match(html, /Cerrar solicitud/);
  assert.match(html, /rfq-tracking-cancel-request-button/);
  assert.match(html, /Cancelar solicitud/);
});

test('rfq tracking renderers renderRequestDetail shows Ir a cotizaciones when responses exist', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  // sampleRequest has respondedInvitationCount: 1
  const html = renderers.renderRequestDetail(sampleRequest, true);

  assert.match(html, /rfq-tracking-go-to-quotations-button/);
  assert.match(html, /Ir a cotizaciones/);
});

test('rfq tracking renderers renderRequestDetail hides Ir a cotizaciones when no responses yet', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const noResponseRequest = { ...sampleRequest, respondedInvitationCount: 0 };
  const html = renderers.renderRequestDetail(noResponseRequest, true);

  assert.doesNotMatch(html, /rfq-tracking-go-to-quotations-button/);
  assert.match(html, /rfq-tracking-cancel-request-button/);
});

test('rfq tracking renderers renderRequestDetail hides close section for read-only users', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const html = renderers.renderRequestDetail(sampleRequest, false);

  assert.doesNotMatch(html, /Cerrar solicitud/);
  assert.doesNotMatch(html, /rfq-tracking-cancel-request-button/);
});

// ─── Manual response dialog ───────────────────────────────────────────────────

test('rfq tracking renderers renderManualResponseDialog generates form fields with correct ids and name attributes', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.rfqTrackingAdminRenderers');
  const request = {
    purchaseRequestId: 5,
    items: [
      { productId: 10, productName: 'Azúcar', quantity: 5 },
      { productId: 11, productName: 'Sal', quantity: 10 },
    ],
  };
  const context = { invitationId: 1, purchaseRequestId: 5, supplierName: 'Proveedor Test', request };
  const html = renderers.renderManualResponseDialog(context, request);

  assert.match(html, /id="rfq-tracking-manual-currency"/);
  assert.match(html, /<select/);
  assert.match(html, /value="CRC"/);
  assert.match(html, /value="USD"/);
  assert.match(html, /id="rfq-tracking-manual-notes"/);
  assert.match(html, /<textarea/);
  assert.match(html, /id="rfq-tracking-manual-items-body"/);
  assert.match(html, /data-product-id="10"/);
  assert.match(html, /data-product-id="11"/);
  assert.match(html, /name="quantity"/);
  assert.match(html, /name="unitPrice"/);
  assert.match(html, /name="leadTimeDays"/);
  assert.match(html, /Azúcar/);
  assert.match(html, /Sal/);
});
