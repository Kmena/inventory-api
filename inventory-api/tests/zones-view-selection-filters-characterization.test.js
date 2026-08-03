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

function createHelpersHarness() {
  const browserWindow = {};
  const context = vm.createContext({
    Map,
    window: browserWindow,
  });
  browserWindow.window = browserWindow;
  browserWindow.document = { body: { classList: { add() {}, remove() {} } }, activeElement: null };
  browserWindow.HTMLElement = class HTMLElement {};

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml(value) {
      return String(value);
    },
  });
  executeRootScript(path.join('views', 'zones-admin.helpers.js'), context);

  return browserWindow.RootShell.require('views.zonesAdminHelpers');
}

function createZonesFixture() {
  return [
    {
      id: 1,
      name: 'Zona Norte',
      routeCode: 'ZN-01',
      subregions: [
        { id: 101, name: 'Subzona Norte 1', routeCode: 'SN-01' },
        { id: 102, name: 'Subzona Centro', routeCode: 'SC-02' },
      ],
    },
    {
      id: 2,
      name: 'Zona Sur',
      routeCode: 'ZS-02',
      subregions: [
        { id: 201, name: 'Subzona Sur 1', routeCode: 'SS-01' },
      ],
    },
  ];
}

test('zones helpers filter zones locally by name and route code', () => {
  const helpers = createHelpersHarness();
  const zones = createZonesFixture();

  assert.deepEqual(helpers.getFilteredZones(zones, ''), zones);
  assert.deepEqual(helpers.getFilteredZones(zones, 'sur').map((zone) => zone.id), [2]);
  assert.deepEqual(helpers.getFilteredZones(zones, 'zn-01').map((zone) => zone.id), [1]);
});

test('zones helpers keep the selected zone when still visible and otherwise fall back to the first filtered zone', () => {
  const helpers = createHelpersHarness();
  const zones = createZonesFixture();

  assert.equal(helpers.getSelectedZone(zones, 2, '').id, 2);
  assert.equal(helpers.getSelectedZone(zones, 2, 'norte').id, 1);
  assert.equal(helpers.getSelectedZone(zones, null, 'sur').id, 2);
  assert.equal(helpers.getSelectedZone(zones, 999, 'missing'), null);
});

test('zones helpers filter subregions only inside the selected zone', () => {
  const helpers = createHelpersHarness();
  const zones = createZonesFixture();
  const selectedZone = zones[0];

  assert.deepEqual(helpers.getFilteredSubregions(selectedZone, '').map((subregion) => subregion.id), [101, 102]);
  assert.deepEqual(helpers.getFilteredSubregions(selectedZone, 'centro').map((subregion) => subregion.id), [102]);
  assert.deepEqual(Array.from(helpers.getFilteredSubregions(selectedZone, 'ss-01')), []);
  assert.deepEqual(Array.from(helpers.getFilteredSubregions(null, 'anything')), []);
});
