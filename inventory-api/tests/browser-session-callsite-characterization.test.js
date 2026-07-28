const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('browser session store call sites remain explicitly bounded to auth service, auth middleware and auth routes before persistence migration', () => {
  const authServiceSource = read('src/services/auth.service.js');
  const authenticateSource = read('src/middlewares/authenticate.js');
  const authRoutesSource = read('src/routes/auth.routes.js');

  assert.match(authServiceSource, /await browserSessionService\.createBrowserSession\(user\.id, \{ req \}\)/);
  assert.match(authenticateSource, /await browserSessionService\.getBrowserSession\(browserSessionId, \{ req \}\)/);
  assert.match(authRoutesSource, /await browserSessionService\.invalidateBrowserSession\(req\.browserSessionId, \{ req \}\)/);
});
