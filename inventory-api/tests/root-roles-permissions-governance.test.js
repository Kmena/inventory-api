const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'root', relativePath), 'utf8');
}

test('roles-permissions view keeps the metadata-enriched catalog path required for production permissions', () => {
  const rolesAdminSource = readRootFile(path.join('views', 'roles-admin.js'));
  const uiSource = readRootFile('ui.js');

  assert.match(rolesAdminSource, /rolesApi\.listPermissions\(session\)/);
  assert.match(rolesAdminSource, /\[p\.displayLabel, p\.businessDescription, p\.moduleCategory, p\.code, p\.module, p\.action\]/);
  assert.match(rolesAdminSource, /groupPermissionsByCategory\(filtered\)/);
  assert.match(rolesAdminSource, /permission\.displayLabel \|\| permission\.code/);
  assert.match(uiSource, /production: 'Produccion'/);
  assert.match(uiSource, /'production'/);
});
