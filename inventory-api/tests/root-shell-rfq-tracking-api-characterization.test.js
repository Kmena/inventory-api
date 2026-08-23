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

test('rfqTrackingApi calls approved RFQ tracking endpoints', async () => {
  const calls = [];
  const browserWindow = {
    InventoryAuth: {
      fetchJson: async (session, url, options = {}) => {
        calls.push({ session, url, options });
        return { ok: true };
      },
    },
  };
  const context = vm.createContext({ window: browserWindow, Map, URLSearchParams });
  browserWindow.window = browserWindow;

  executeRootScript('registry.js', context);
  executeRootScript('rfq-tracking-api.js', context);

  const api = browserWindow.RootShell.require('rfqTrackingApi');
  const session = { user: { id: 1 } };

  await api.listTracking(session);
  await api.submitManualResponse(session, 22, {
    currency: 'CRC',
    items: [{ productId: 10, quantity: 2, unitPrice: 100 }],
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, '/api/procurement/rfq-tracking');
  assert.equal(calls[0].options.fallbackMessage, 'No se pudo cargar el seguimiento de cotizaciones RFQ.');
  assert.equal(calls[1].url, '/api/procurement/rfq-invitations/22/manual-response');
  assert.equal(calls[1].options.method, 'POST');
});
