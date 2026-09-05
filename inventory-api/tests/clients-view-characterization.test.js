const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function executeRootScript(relativePath, context) {
  const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function createHarness(options = {}) {
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map, Set, URLSearchParams });
  browserWindow.window = browserWindow;
  executeRootScript('registry.js', context);
  browserWindow.InventoryAuth = {
    fetchJson: options.fetchJson || (async () => []),
    buildHeaders: () => ({}),
    handleUnauthorized: () => {},
  };
  executeRootScript('ui.js', context);
  executeRootScript('clients-api.js', context);
  executeRootScript('views/clients-admin.helpers.js', context);
  executeRootScript('views/clients-admin.renderers.js', context);
  executeRootScript('views/clients-admin.state.js', context);
  // clients-admin-store-dialog must be registered before clients-admin.js (RISK-005)
  executeRootScript('views/clients-admin-store-dialog.js', context);
  executeRootScript('views/clients-admin.js', context);
  return browserWindow.RootShell;
}

test('clients helpers keep local filters and payload shaping bounded to approved fields', () => {
  const rootShell = createHarness();
  const helpers = rootShell.require('views.clientsAdminHelpers');

  const filtered = helpers.filterClients(
    [
      { id: 1, name: 'Cliente Norte', code: 'CN-01', phone: '111', clientClassificationId: 9, isActive: true, storesCount: 1, documents: [] },
      { id: 2, name: 'Cliente Sur', code: 'CS-02', phone: '222', clientClassificationId: 10, isActive: false, storesCount: 0, documents: [{}] },
    ],
    'sur',
    '10',
    'inactive',
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 2);
  assert.equal(JSON.stringify(helpers.summarizeClients(filtered)), JSON.stringify({
    total: 1,
    active: 0,
    withStores: 0,
    withDocuments: 1,
  }));

  const formDataSource = new Map([
    ['name', 'Cliente Demo'],
    ['clientClassificationId', '11'],
    ['legalName', 'Demo Legal SA'],
    ['commercialName', 'Demo Comercial'],
    ['province', 'San José'],
    ['canton', 'Escazú'],
    ['district', 'San Rafael'],
    ['paymentType', 'CREDIT'],
  ]);
  const formData = {
    get(key) {
      return formDataSource.has(key) ? formDataSource.get(key) : null;
    },
  };
  const payload = helpers.buildClientPayload(formData);
  assert.equal(payload.clientClassificationId, 11);
  assert.equal(payload.name, 'Cliente Demo');
  assert.equal(payload.legalName, 'Demo Legal SA');
  assert.equal(payload.commercialName, 'Demo Comercial');
  assert.equal(payload.province, 'San José');
  assert.equal(payload.canton, 'Escazú');
  assert.equal(payload.district, 'San Rafael');
  assert.equal(payload.paymentType, 'CREDIT');
  // AC-013: creditLimit and creditBalance must not appear in the client payload (store-level fields)
  assert.equal('creditLimit' in payload, false);
  assert.equal('creditBalance' in payload, false);

  const storeFormDataSource = new Map([
    ['name', 'Sucursal Centro'],
    ['subregionId', '44'],
    ['creditLimit', '1800.50'],
    ['currency', 'USD'],
    ['phone', '2222-1111'],
  ]);
  const storePayload = helpers.buildStorePayload({
    get(key) {
      return storeFormDataSource.has(key) ? storeFormDataSource.get(key) : null;
    },
  });
  assert.equal(storePayload.name, 'Sucursal Centro');
  assert.equal(storePayload.subregionId, 44);
  assert.equal(storePayload.creditLimit, 1800.5);
  assert.equal(storePayload.currency, 'USD');
  assert.equal(storePayload.phone, '2222-1111');

  const zeroCreditPayload = helpers.buildStorePayload({
    get(key) {
      if (key === 'name') return 'Sucursal Sin Crédito';
      if (key === 'subregionId') return '55';
      if (key === 'creditLimit') return '0';
      return null;
    },
  });
  assert.equal('creditLimit' in zeroCreditPayload, false);

  const inheritedFiscalPayload = helpers.buildStorePayload({
    get(key) {
      if (key === 'name') return 'Sucursal Heredada';
      if (key === 'subregionId') return '66';
      if (key === 'billingMode') return 'inherit';
      if (key === 'legalName') return 'No debe viajar';
      return null;
    },
  });
  assert.equal('legalName' in inheritedFiscalPayload, false);

  const overrideFiscalPayload = helpers.buildStorePayload({
    get(key) {
      if (key === 'name') return 'Sucursal Propia';
      if (key === 'subregionId') return '77';
      if (key === 'billingMode') return 'override';
      if (key === 'legalName') return 'Sucursal Fiscal SA';
      if (key === 'documentType') return 'JURIDICA';
      if (key === 'legalId') return '3-101-999999';
      return null;
    },
  });
  assert.equal(overrideFiscalPayload.legalName, 'Sucursal Fiscal SA');
  assert.equal(overrideFiscalPayload.documentType, 'JURIDICA');
  assert.equal(overrideFiscalPayload.legalId, '3-101-999999');
});

test('clients api keeps taxpayer lookup aligned with the authenticated backend contract', async () => {
  const requests = [];
  const rootShell = createHarness({
    fetchJson: async (_session, url) => {
      requests.push(url);
      return { name: 'Cliente Hacienda', economicActivityCode: '6201', economicActivityName: 'Servicios' };
    },
  });
  const clientsApi = rootShell.require('clientsApi');

  const taxpayer = await clientsApi.lookupTaxpayer({ token: 'session' }, '3-101-123456');

  assert.equal(requests[0], '/api/taxpayers/lookup?identification=3-101-123456');
  assert.equal(taxpayer.economicActivityCode, '6201');
});

test('clients renderer and state seams preserve contextual detail summaries and selection helpers', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.clientsAdminRenderers');
  const state = rootShell.require('views.clientsAdminState');

  const html = renderers.renderClientDetail(
    {
      id: 301,
      name: 'Cliente Norte',
      code: 'CN-01',
      phone: '555-0201',
      clientClassificationId: 1,
      classification: { id: 1, name: 'Preferente' },
      documentType: 'NIT',
      documents: [{ id: 1, documentType: 'NIT', fileName: 'nit.pdf' }],
      stores: [{ id: 10, name: 'Tienda 1', code: 'T-01', subregionName: 'Subzona Norte', currency: 'USD', creditLimit: 1000, creditBalance: 250 }],
      references: [{ id: 20, name: 'Banco Demo', contact: 'Ana', phone1: '555' }],
      isActive: true,
    },
    [{ id: 1, name: 'Preferente' }],
    [{ value: 'NIT', label: 'NIT' }],
    [{ id: 101, name: 'Subzona Norte', regionName: 'Zona Norte' }],
    true,
  );

  assert.match(html, /Detalle contextual/);
  assert.match(html, /Agregar tienda/);
  assert.match(html, /Descargar/);
  assert.match(html, /Moneda: USD/);
  assert.match(html, /Usado: \$250\.00 · Disponible: \$750\.00/);
  assert.match(html, /Facturación: hereda datos fiscales del cliente/);
  assert.doesNotMatch(html, /Saldo:/);
  // AC-012: missing client fields now editable in the edit form (TASK-008)
  assert.match(html, /name="legalName"/);
  assert.match(html, /name="commercialName"/);
  assert.match(html, /name="province"/);
  assert.match(html, /name="canton"/);
  assert.match(html, /name="district"/);
  // credit feedback container must be a div with aria-live so renderInlineMessage (block element) is valid HTML
  assert.match(html, /class="clients-store-credit-msg" aria-live="polite"/);
  assert.equal(state.buildClientsListSummary(4, 2), '2 de 4 clientes visibles con el filtro actual.');
  assert.equal(state.getSelectedClient([{ id: 1, name: 'Cliente' }], {}, 1)?.name, 'Cliente');
});

test('clients view render keeps client detail secondary to the clients workspace', () => {
  const rootShell = createHarness();
  const view = rootShell.require('views.clientsAdmin');
  const html = view.render({ user: { companyId: '77' } });

  assert.match(html, /Clientes/);
  assert.match(html, /Selecciona un cliente/);
  assert.doesNotMatch(html, /client-detail|client_detail/);
  assert.match(html, /Nuevo cliente/);
});

test('clients admin document download handler uses blob/ObjectURL download flow (TASK-001)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');

  assert.match(source, /const \{ blob, fileName \} = await clientsApi\.downloadDocument\(/);
  assert.match(source, /URL\.createObjectURL\(/);
  assert.match(source, /URL\.revokeObjectURL\(/);
  assert.match(source, /downloadButton\.textContent = 'Descargando\.\.\.';/);
  assert.match(source, /Descarga iniciada en el navegador\./);
  assert.doesNotMatch(source, /Descarga autenticada solicitada correctamente\./);
});

test('clients document form renders file picker with hidden derived fields (TASK-002)', () => {
  const renderersSource = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.renderers.js'), 'utf8');

  assert.match(renderersSource, /input name="documentFile" type="file"/);
  assert.match(renderersSource, /accept="\.pdf,\.jpg,\.jpeg,\.png,\.webp,\.doc,\.docx"/);
  assert.match(renderersSource, /input name="fileName" type="hidden"/);
  assert.match(renderersSource, /input name="mimeType" type="hidden"/);
  assert.match(renderersSource, /input name="fileContentBase64" type="hidden"/);
  assert.match(renderersSource, /clients-document-file-feedback/);
  assert.doesNotMatch(renderersSource, /<textarea name="fileContentBase64"/);
});

test('clients renderer shows store-specific fiscal summary when overrides are present (TASK-007)', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.clientsAdminRenderers');

  const html = renderers.renderClientDetail(
    {
      id: 305,
      name: 'Cliente Fiscal',
      code: 'CF-01',
      phone: '555-0204',
      stores: [{ id: 12, name: 'Tienda Fiscal', code: 'TF-01', subregionName: 'Subzona Este', currency: 'CRC', creditLimit: 100, creditBalance: 30, legalName: 'Tienda Fiscal SA', documentType: 'JURIDICA', legalId: '3-101-555555' }],
      documents: [],
      references: [],
      isActive: true,
    },
    [],
    [],
    [],
    true,
  );

  assert.match(html, /Facturación: datos fiscales propios de la tienda/);
  assert.match(html, /Razón social: Tienda Fiscal SA/);
  assert.match(html, /Identificación: JURIDICA · 3-101-555555/);
});

test('clients renderer shows Sin límite when store credit limit is zero or missing (TASK-006)', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.clientsAdminRenderers');

  const html = renderers.renderClientDetail(
    {
      id: 401,
      name: 'Cliente Sur',
      code: 'CS-99',
      phone: '555-0202',
      stores: [{ id: 55, name: 'Tienda Libre', code: 'TL-01', subregionName: 'Subzona Sur', currency: 'CRC', creditLimit: 0, creditBalance: 25 }],
      documents: [],
      references: [],
      isActive: true,
    },
    [],
    [],
    [],
    true,
  );

  assert.match(html, /Usado: ₡25\.00 · Disponible: Sin límite configurado/);
});

test('clients renderer does not mislabel null store currency as CRC (TASK-006)', () => {
  const rootShell = createHarness();
  const renderers = rootShell.require('views.clientsAdminRenderers');

  const html = renderers.renderClientDetail(
    {
      id: 402,
      name: 'Cliente Legacy',
      code: 'CL-01',
      phone: '555-0203',
      stores: [{ id: 56, name: 'Tienda Legacy', code: 'TL-02', subregionName: 'Subzona Oeste', currency: null, creditLimit: 100, creditBalance: 40 }],
      documents: [],
      references: [],
      isActive: true,
    },
    [],
    [],
    [],
    true,
  );

  assert.match(html, /Moneda: Sin definir/);
  assert.match(html, /Usado: 40\.00 · Disponible: 60\.00/);
  assert.doesNotMatch(html, /Moneda: CRC/);
});

test('clients admin uses renderInlineMessage for credit mini-form success and error feedback (TASK-008)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');

  // AC-014: success feedback uses renderInlineMessage, not plain textContent
  assert.match(source, /renderInlineMessage\('Limite de credito guardado\.'\)/);
  // AC-015: error feedback uses renderInlineMessage with 'error' tone
  assert.match(source, /renderInlineMessage\(err\.message \|\| 'No se pudo guardar el limite de credito\.', 'error'\)/);
  // must not regress to bare textContent assignment for credit feedback
  assert.doesNotMatch(source, /msgEl\.textContent = '✓ Guardado'/);
  assert.doesNotMatch(source, /msgEl\.textContent = err\.message \|\| 'Error'/);
});

test('clients admin wires FileReader conversion and 5 MB guard for document upload (TASK-002)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');

  assert.match(source, /new globalScope\.FileReader\(/);
  assert.match(source, /MAX_DOCUMENT_FILE_SIZE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(source, /Procesando archivo\.\.\./);
  assert.match(source, /El archivo supera el máximo permitido de 5 MB\./);
  assert.match(source, /Selecciona un archivo PDF, JPG, PNG, WebP, DOC o DOCX\./);
  assert.match(source, /Archivo listo:/);
});

test('clients admin exposes Consultar button in creation dialog gated by integration.taxpayer.lookup (TASK-010)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');
  // Button exists in the create dialog (initially hidden)
  assert.match(source, /id="clients-create-lookup-button".*hidden/, 'create form must render Consultar button as hidden by default');
  // Permission-gated reveal
  assert.match(source, /integration\.taxpayer\.lookup/, 'must gate the Consultar button on integration.taxpayer.lookup permission');
  assert.match(source, /createLookupButton\.hidden = false/, 'must unhide the button when permission is present');
  // Handler fills all required fields (FR-026) and auto-runs when leaving the identification field.
  assert.match(source, /clients-create-lookup-button/, 'must wire the lookup button');
  assert.match(source, /addEventListener\('change', \(\) => triggerCreateLookup\(\)\)/, 'must auto lookup on change after editing legalId');
  assert.match(source, /addEventListener\('focusout', \(\) => triggerCreateLookup\(\)\)/, 'must auto lookup on focusout after editing legalId');
  assert.match(source, /isCreateLookupInProgress/, 'must prevent duplicate create lookups from overlapping events');
  assert.match(source, /event\.key !== 'Enter'/, 'must intercept Enter on legalId instead of submitting the client form');
  assert.match(source, /event\.preventDefault\(\)/, 'must prevent Enter from submitting legalId forms before lookup');
  assert.match(source, /nameInput\.value = taxpayer\.name/, 'create lookup must fill name from taxpayer.name');
  assert.match(source, /legalNameInput\.value = taxpayer\.name/, 'create lookup must fill legalName from taxpayer.name');
  // Non-blocking error messages
  assert.match(source, /No se encontró la identificación en Hacienda/, 'must show 404 non-blocking message');
  assert.match(source, /Consultas temporalmente limitadas/, 'must show 429 non-blocking message');
  assert.match(source, /Hacienda no disponible/, 'must show 502 non-blocking message');
});

test('clients-admin-store-dialog.js exposes Consultar Hacienda in billing override section (TASK-010)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin-store-dialog.js'), 'utf8');
  assert.match(source, /store-dialog-billing-lookup-btn/, 'store dialog must have billing Hacienda lookup button');
  assert.match(source, /canLookupTaxpayer/, 'store dialog must gate billing lookup on canLookupTaxpayer param');
  assert.match(source, /legalNameInput\.value = taxpayer\.name/, 'billing lookup must fill legalName from taxpayer.name (AC-019)');
  assert.match(source, /addEventListener\('change', \(\) => triggerBillingLookup\(\)\)/, 'billing lookup must auto-run on change after editing legalId');
  assert.match(source, /addEventListener\('focusout', \(\) => triggerBillingLookup\(\)\)/, 'billing lookup must auto-run on focusout after editing legalId');
  assert.match(source, /isBillingLookupInProgress/, 'must prevent duplicate billing lookups from overlapping events');
  assert.match(source, /event\.key !== 'Enter'/, 'store billing lookup must intercept Enter on legalId');
  assert.match(source, /event\.preventDefault\(\)/, 'store billing lookup must prevent Enter from submitting the dialog');
});

test('clients admin creation form uses documentType dropdown with 01-04 options (TASK-012)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');
  assert.match(source, /01 — Cédula Física/, 'documentType dropdown must include 01 option');
  assert.match(source, /02 — Cédula Jurídica/, 'documentType dropdown must include 02 option');
  assert.match(source, /03 — DIMEX/, 'documentType dropdown must include 03 option');
  assert.match(source, /04 — NITE/, 'documentType dropdown must include 04 option');
});

test('clients admin creation form has emailBilling with facturas label (TASK-012)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');
  assert.match(source, /Correo electrónico para facturas \(PDF y XML\)/, 'emailBilling label must describe PDF/XML invoice use');
});

test('clients admin creation form has economic activity select and hidden name input (TASK-012)', () => {
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');
  assert.match(source, /id="clients-create-economic-activity".*name="economicActivityCode"/, 'create form must have economic activity select');
  assert.match(source, /id="clients-create-economic-activity-name".*name="economicActivityName"/, 'create form must have hidden economicActivityName input');
});

test('clients admin edit form renderer uses documentType dropdown and updated emailBilling label (TASK-012)', () => {
  const renderersSource = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.renderers.js'), 'utf8');
  assert.match(renderersSource, /01 — Cédula Física/, 'edit form renderer must include 01 option');
  assert.match(renderersSource, /02 — Cédula Jurídica/, 'edit form renderer must include 02 option');
  assert.match(renderersSource, /Correo electrónico para facturas \(PDF y XML\)/, 'edit form emailBilling label must match approved label');
  assert.match(renderersSource, /clients-edit-economic-activity/, 'edit form must have economic activity dropdown');
  assert.match(renderersSource, /clients-edit-economic-activity-name/, 'edit form must have hidden economicActivityName input');
});

test('clients admin loadClients calls listEconomicActivities in Promise.all (TASK-012, AC-025)', () => {
  // Economic activities must be loaded at mount time — no extra fetch on form open
  const source = fs.readFileSync(path.join(rootPublicPath, 'views', 'clients-admin.js'), 'utf8');
  assert.match(
    source,
    /listEconomicActivities\(session\)/,
    'loadClients must call listEconomicActivities(session)',
  );
  // Verify graceful degradation: catch(() => []) ensures mount does not fail if the endpoint is unavailable
  assert.match(
    source,
    /listEconomicActivities\(session\)\.catch\(\(\) => \[\]\)/,
    'listEconomicActivities must degrade gracefully with .catch(() => []) so mount never fails',
  );
});
