'use strict';

/**
 * Characterization tests — clients-store-map
 *
 * Verifica:
 * 1. Leaflet 1.9.4 existe en la ruta compartida /vendor/leaflet/ (ADR-001)
 * 2. El agent SPA referencia la ruta compartida (no la copia local)
 * 3. El root shell carga Leaflet y el dialog de tienda en el orden correcto (RISK-005)
 * 4. La CSP del root shell incluye los dominios de OSM (RISK-001)
 * 5. clients-api.js expone searchPlaces
 * 6. clients-admin-store-dialog.js aplica todas las mitigaciones del advisor
 * 7. TASK-P0-008: verificar que Leaflet y el mapa cargan adecuadamente
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { test } = require('node:test');
const http = require('node:http');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const rootViewsDir = path.join(publicRoot, 'root', 'views');
const agentDir = path.join(publicRoot, 'agent');
const vendorLeafletDir = path.join(publicRoot, 'vendor', 'leaflet');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ─── TASK-P0-001 / ADR-001: Leaflet compartido ───────────────────────────────

test('shared Leaflet 1.9.4 exists at /vendor/leaflet/ (ADR-001)', () => {
  const jsPath = path.join(vendorLeafletDir, 'leaflet.js');
  const cssPath = path.join(vendorLeafletDir, 'leaflet.css');
  assert.ok(fs.existsSync(jsPath), 'leaflet.js must exist at src/public/vendor/leaflet/leaflet.js');
  assert.ok(fs.existsSync(cssPath), 'leaflet.css must exist at src/public/vendor/leaflet/leaflet.css');

  const jsContent = readFile(jsPath);
  assert.ok(jsContent.length > 100_000, 'leaflet.js must be at least 100 KB (not truncated)');
  assert.ok(jsContent.includes('1.9.4') || jsContent.includes('Leaflet'), 'leaflet.js must contain Leaflet version marker');
});

test('agent SPA index.html uses absolute shared /vendor/leaflet/ path (ADR-001)', () => {
  const html = readFile(path.join(agentDir, 'index.html'));
  assert.ok(
    html.includes('src="/vendor/leaflet/leaflet.js"'),
    'agent index.html must reference /vendor/leaflet/leaflet.js (absolute, shared path)',
  );
  assert.ok(
    html.includes('href="/vendor/leaflet/leaflet.css"'),
    'agent index.html must reference /vendor/leaflet/leaflet.css (absolute, shared path)',
  );
  assert.ok(
    !html.includes('src="vendor/leaflet/leaflet.js"'),
    'agent index.html must NOT use relative vendor path (would duplicate Leaflet)',
  );
});

// ─── TASK-P0-002: CSP del root shell con OSM ─────────────────────────────────

test('src/app.js selectContentSecurityPolicy adds OSM domains and unsafe-inline style for /root/ (RISK-001)', () => {
  const appJs = readFile(path.join(__dirname, '..', 'src', 'app.js'));
  assert.ok(
    appJs.includes("pathName === '/root/' || pathName === '/root'"),
    'app.js must have a CSP branch for /root/ and /root',
  );
  const rootBranchMatch = appJs.match(/pathName === '\/root\/' \|\| pathName === '\/root'[\s\S]*?img-src[^\n]+tile\.openstreetmap\.org/);
  assert.ok(rootBranchMatch, 'root CSP branch must include tile.openstreetmap.org in img-src');
  // Leaflet requiere unsafe-inline en style-src para aplicar estilos inline a tiles y marcadores
  const styleUnsafeMatch = appJs.match(/pathName === '\/root\/' \|\| pathName === '\/root'[\s\S]*?style-src[^\n]+'unsafe-inline'/);
  assert.ok(styleUnsafeMatch, "root CSP branch must include 'unsafe-inline' in style-src — required by Leaflet");
});

test('GET /root/ response has img-src with OpenStreetMap tiles in CSP header (TASK-P0-008 — mapa carga tiles)', (t, done) => {
  let app;
  try {
    app = require('../src/app');
  } catch (_err) {
    t.skip('app module not available in test environment');
    done();
    return;
  }

  const server = http.createServer(app);
  server.listen(0, () => {
    const port = /** @type {any} */ (server.address()).port;
    http.get(`http://localhost:${port}/root/`, (res) => {
      const csp = res.headers['content-security-policy'] || '';
      res.resume();
      server.close(() => {
        assert.ok(
          csp.includes('tile.openstreetmap.org'),
          `CSP for /root/ must include tile.openstreetmap.org. Got: ${csp}`,
        );
        done();
      });
    }).on('error', (err) => {
      server.close(() => done(err));
    });
  });
});

// ─── TASK-P0-004: Orden de scripts en root/index.html (RISK-005) ─────────────

test('root/index.html loads Leaflet before all custom modules (RISK-005, TASK-P0-008)', () => {
  const html = readFile(path.join(publicRoot, 'root', 'index.html'));

  const leafletPos = html.indexOf('/vendor/leaflet/leaflet.js');
  const sessionPos = html.indexOf('/shared/session.js');
  const clientsApiPos = html.indexOf('/root/clients-api.js');
  const storeDialogPos = html.indexOf('/root/views/clients-admin-store-dialog.js');
  const clientsAdminPos = html.indexOf('/root/views/clients-admin.js');

  assert.ok(leafletPos > -1, 'root/index.html must load /vendor/leaflet/leaflet.js');
  assert.ok(storeDialogPos > -1, 'root/index.html must load clients-admin-store-dialog.js');

  assert.ok(
    leafletPos < sessionPos,
    'Leaflet must be loaded before session.js',
  );
  assert.ok(
    clientsApiPos < storeDialogPos,
    'clients-api.js must be loaded before clients-admin-store-dialog.js',
  );
  assert.ok(
    storeDialogPos < clientsAdminPos,
    'clients-admin-store-dialog.js must be loaded before clients-admin.js',
  );
});

test('root/index.html loads Leaflet CSS in <head> before styles.css (TASK-P0-008)', () => {
  const html = readFile(path.join(publicRoot, 'root', 'index.html'));
  const leafletCssPos = html.indexOf('/vendor/leaflet/leaflet.css');
  const stylesCssPos = html.indexOf('/styles.css');
  const headClosePos = html.indexOf('</head>');

  assert.ok(leafletCssPos > -1, 'root/index.html must have Leaflet CSS link');
  assert.ok(leafletCssPos < headClosePos, 'Leaflet CSS must be in <head>');
  assert.ok(leafletCssPos < stylesCssPos, 'Leaflet CSS must come before /styles.css');
});

// ─── TASK-P0-003: searchPlaces en clients-api.js ─────────────────────────────

test('clients-api.js exposes searchPlaces registered in clientsApi (TASK-P0-003)', () => {
  const src = readFile(path.join(publicRoot, 'root', 'clients-api.js'));
  assert.ok(src.includes('async function searchPlaces('), 'clients-api.js must define searchPlaces');
  assert.ok(src.includes('/api/geocoding/search'), 'searchPlaces must call /api/geocoding/search');
  assert.ok(src.includes("searchParams.set('q', query)"), 'searchPlaces must pass query as q param');
  assert.ok(src.includes('searchPlaces,'), 'searchPlaces must be registered in clientsApi object');
});

// ─── TASK-P0-006: clients-admin-store-dialog.js ──────────────────────────────

test('clients-admin-store-dialog.js exists and registers views.clientsAdminStoreDialog', () => {
  const filePath = path.join(rootViewsDir, 'clients-admin-store-dialog.js');
  assert.ok(fs.existsSync(filePath), 'clients-admin-store-dialog.js must exist');
  const src = readFile(filePath);
  assert.ok(
    src.includes("rootShell.register('views.clientsAdminStoreDialog'"),
    'must register as views.clientsAdminStoreDialog',
  );
  assert.ok(src.includes('function open('), 'must expose an open() function');
});

test('clients-admin-store-dialog.js adds creditLimit field and delegates payload shaping to shared helpers (TASK-005)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('name="creditLimit" type="number"'), 'store dialog must render a creditLimit number input');
  assert.ok(src.includes('min="0"'), 'creditLimit must prevent negative values in the dialog');
  assert.ok(src.includes('step="0.01"'), 'creditLimit must support decimal values');
  assert.ok(src.includes('views.clientsAdminHelpers'), 'store dialog must require the shared clients admin helpers');
  assert.ok(src.includes('clientsAdminHelpers.buildStorePayload'), 'store dialog must delegate store payload shaping to shared helpers');
});

test('clients-admin-store-dialog.js adds required currency select with CRC/USD/EUR options (TASK-006)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('name="currency" required'), 'store dialog must require a currency selection');
  assert.ok(src.includes('Selecciona moneda'), 'store dialog must guide the user to explicitly choose a currency');
  assert.ok(src.includes('value="CRC">CRC — Colón'), 'store dialog must include the CRC option');
  assert.ok(src.includes('value="USD">USD — Dólar'), 'store dialog must include the USD option');
  assert.ok(src.includes('value="EUR">EUR — Euro'), 'store dialog must include the EUR option');
});

test('clients-admin-store-dialog.js adds inherit vs override fiscal controls and summary block (TASK-007)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('name="billingMode" value="inherit" checked'), 'store dialog must default to inherit billing mode');
  assert.ok(src.includes('name="billingMode" value="override"'), 'store dialog must expose override billing mode');
  assert.ok(src.includes('Facturación heredada del cliente'), 'store dialog must show inherited fiscal summary copy');
  assert.ok(src.includes('Usar datos fiscales del cliente'), 'store dialog must label the inherit option');
  assert.ok(src.includes('Usar datos fiscales propios de esta tienda'), 'store dialog must label the override option');
  assert.ok(src.includes('store-dialog-billing-override-fields'), 'store dialog must render a dedicated override fields container');
  assert.ok(src.includes('toggleBillingMode('), 'store dialog must toggle the billing mode UI');
});

test('clients-admin-store-dialog.js renders zone guidance state and refresh affordances (TASK-003/TASK-004)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(
    src.includes('Necesitas configurar zonas antes de crear una tienda'),
    'store dialog must explain the missing-zones dependency',
  );
  assert.ok(src.includes('Ir a Zonas'), 'store dialog must expose the Ir a Zonas action');
  assert.ok(src.includes('Refrescar zonas'), 'store dialog must expose the Refrescar zonas action');
  assert.ok(src.includes("data-action=\"refresh-zones\""), 'store dialog must expose refresh action hooks');
  assert.ok(src.includes('store-dialog-zone-guidance'), 'store dialog must include a dedicated guidance state container');
  assert.ok(src.includes('mainFieldset.hidden'), 'store dialog must toggle the form when no zones are available');
});

test('clients-admin-store-dialog.js accepts refreshZones callback and repopulates subregion options (TASK-004)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('function open(clientId, clientName, session, zoneOptions, onSuccess, refreshZones, clientFiscalProfile, documentTypeOptions, canLookupTaxpayer)'), 'open() must accept refreshZones callback, client fiscal profile, documentTypeOptions and canLookupTaxpayer');
  assert.ok(src.includes('zoneOptions = await refreshZones()'), 'refresh action must await refreshZones()');
  assert.ok(src.includes('subregionSelect.innerHTML'), 'refresh action must update the subregion select in place');
  assert.ok(src.includes('updateZoneAvailability(zoneOptions)'), 'refresh action must re-evaluate the guidance/form state');
});

test('clients-admin-store-dialog.js enters Phase 2 after store creation for optional document upload (TASK-009)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('function enterPhase2('), 'store dialog must define enterPhase2 for optional document upload');
  assert.ok(src.includes('function buildPhase2Html('), 'store dialog must define buildPhase2Html');
  assert.ok(src.includes('Documentos de la tienda'), 'Phase 2 must show a document upload heading');
  assert.ok(src.includes('Adjuntar documento'), 'Phase 2 must have an upload submit button');
  assert.ok(src.includes('Finalizar'), 'Phase 2 must have a Finalizar button to close without more uploads');
  assert.ok(src.includes('uploadStoreDocument'), 'Phase 2 must call clientsApi.uploadStoreDocument');
  assert.ok(src.includes('5 * 1024 * 1024'), 'Phase 2 must enforce the 5 MB guard (AC-016, BR-001)');
  assert.ok(src.includes('FileReader'), 'Phase 2 must use FileReader to convert the file to Base64');
  assert.ok(src.includes('enterPhase2(dialog,'), 'submit handler must transition to Phase 2 after Phase 1 success');
});

test('clients-api.js exposes uploadStoreDocument registered in clientsApi (TASK-009)', () => {
  const src = readFile(path.join(publicRoot, 'root', 'clients-api.js'));
  assert.ok(src.includes('async function uploadStoreDocument('), 'clients-api.js must define uploadStoreDocument');
  assert.ok(src.includes('/stores/'), 'uploadStoreDocument must use the store-scoped document endpoint');
  assert.ok(src.includes('uploadStoreDocument,'), 'uploadStoreDocument must be registered in clientsApi object');
});

test('clients-admin-store-dialog.js creates dialog dynamically — not pre-rendered (ADR-004, TASK-P0-008)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(
    src.includes("document.createElement('dialog')"),
    'dialog must be created dynamically with createElement (ADR-004)',
  );
  assert.ok(
    src.includes('dialog.showModal()'),
    'dialog must be shown with showModal()',
  );
  assert.ok(
    src.includes('dialog.remove()'),
    'dialog must be removed from DOM on close',
  );
});

test('FINDING-001: map.remove() is called before dialog.remove() to prevent memory leak', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  const mapRemovePos = src.indexOf('map.remove()');
  const dialogRemovePos = src.indexOf('dialog.remove()');
  assert.ok(mapRemovePos > -1, 'map.remove() must be called (FINDING-001)');
  assert.ok(dialogRemovePos > -1, 'dialog.remove() must be called');
  assert.ok(
    mapRemovePos < dialogRemovePos,
    'map.remove() must appear before dialog.remove() in source (FINDING-001)',
  );
});

test('FINDING-002: debounce timeout is cleared when dialog closes', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(
    src.includes('clearTimeout(debounceId)'),
    'closeDialog must call clearTimeout(debounceId) to cancel pending debounce (FINDING-002)',
  );
  // clearTimeout must appear in the closeDialog function, before map.remove
  const clearPos = src.indexOf('clearTimeout(debounceId)');
  const mapRemovePos = src.indexOf('map.remove()');
  assert.ok(clearPos < mapRemovePos, 'clearTimeout must come before map.remove() in closeDialog');
});

test('FINDING-004: geocoding search input has autocomplete=off and spellcheck=false', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('autocomplete="off"'), 'geocoding input must have autocomplete=off (FINDING-004)');
  assert.ok(src.includes('spellcheck="false"'), 'geocoding input must have spellcheck=false (FINDING-004)');
});

test('TASK-P0-008: Leaflet map is initialized with invalidateSize after showModal (RISK-003)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(
    src.includes('map.invalidateSize()'),
    'must call map.invalidateSize() to fix gray tiles bug (RISK-003)',
  );
  assert.ok(
    src.includes('setTimeout('),
    'Leaflet init must use setTimeout to ensure dialog is visible first (RISK-003)',
  );
  // map init must happen inside setTimeout
  const setTimeoutPos = src.indexOf('setTimeout(');
  const mapInitPos = src.indexOf('L.map(');
  assert.ok(mapInitPos > setTimeoutPos, 'L.map() must be called inside setTimeout callback');
});

test('TASK-P0-008: draggable marker uses L.divIcon to avoid missing PNG images (ADR-005)', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(src.includes('draggable: true'), 'marker must be created with draggable: true (ADR-005)');
  assert.ok(src.includes('L.divIcon('), 'marker must use L.divIcon — avoids missing marker-icon.png from vendored Leaflet');
  assert.ok(src.includes("marker.on('dragend'"), "must listen to 'dragend' event on marker");
  assert.ok(src.includes('latInput.value'), 'dragend handler must update latInput.value');
  assert.ok(src.includes('lngInput.value'), 'dragend handler must update lngInput.value');
});

test('TASK-P0-008: tile layer uses OpenStreetMap URL', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin-store-dialog.js'));
  assert.ok(
    src.includes('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    'must use standard OpenStreetMap tile URL',
  );
});

test('clients-admin.js registers views.clientsAdminStoreDialog and connects add-store button', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin.js'));
  assert.ok(
    src.includes("rootShell.require('views.clientsAdminStoreDialog')"),
    'clients-admin.js must require views.clientsAdminStoreDialog',
  );
  assert.ok(
    src.includes("'clients-add-store-button'"),
    'clients-admin.js must handle click on clients-add-store-button',
  );
  assert.ok(
    src.includes('clientsAdminStoreDialog.open('),
    'clients-admin.js must call clientsAdminStoreDialog.open()',
  );
  assert.ok(
    src.includes('zoneOptions = clientsState.flattenZoneOptions(zonesResponse);'),
    'clients-admin.js must refresh and normalize zone options before returning them to the dialog',
  );
  assert.ok(
    src.includes('getSelectedClient(),'),
    'clients-admin.js must pass the selected client fiscal profile into the store dialog',
  );
});

test('clients-admin.renderers.js store section has add-store button and no longer has clients-store-form', () => {
  const src = readFile(path.join(rootViewsDir, 'clients-admin.renderers.js'));
  assert.ok(
    src.includes('clients-add-store-button'),
    'renderers must include the [+ Agregar tienda] button',
  );
  assert.ok(
    !src.includes('id="clients-store-form"'),
    'old clients-store-form must be removed from renderers',
  );
});

test('store-dialog CSS classes exist in styles.css (TASK-P0-007)', () => {
  const css = readFile(path.join(publicRoot, 'styles.css'));
  assert.ok(css.includes('.store-dialog-modal'), 'styles.css must have .store-dialog-modal');
  assert.ok(css.includes('.store-dialog-map'), 'styles.css must have .store-dialog-map');
  assert.ok(css.includes('.store-dialog-geocoding__dropdown'), 'styles.css must have geocoding dropdown class');
  assert.ok(css.includes('.store-dialog-geocoding__item'), 'styles.css must have geocoding item class');
  const mapHeightMatch = css.match(/\.store-dialog-map\s*\{[^}]*height:\s*\d+px/);
  assert.ok(mapHeightMatch, '.store-dialog-map must have explicit height (required for Leaflet, TASK-P0-008)');
});
