const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('FB7 client policies are permission-based and no longer role-code based', () => {
  const { ACCESS_POLICIES } = require('../src/security/access-policy-registry');
  const expected = {
    'client.list': ['clients.view', 'clients.view.all'],
    'client.list-company': ['clients.view', 'clients.view.all'],
    'client.classifications.list-company': ['clients.view', 'clients.view.all'],
    'client.document-types.list': ['clients.view', 'clients.view.all'],
    'client.create-company': ['clients.create'],
    'client.store.create': ['clients.create'],
    'client.document.upload': ['clients.documents.upload'],
    'client.reference.create': ['clients.references.create'],
    'client.document.download': ['clients.documents.download'],
    'client.detail': ['clients.view', 'clients.view.all'],
    'client.create-legacy': ['clients.create'],
    'client.update': ['clients.edit'],
    'client.delete': ['clients.delete'],
    'client.store.credit.manage': ['clients.credit.manage'],
  };

  for (const [policyId, permissions] of Object.entries(expected)) {
    assert.equal(ACCESS_POLICIES[policyId].mode, 'permission', `${policyId} must use permission authorization`);
    assert.deepEqual(ACCESS_POLICIES[policyId].permissions, permissions, `${policyId} permission mapping changed`);
    assert.equal(ACCESS_POLICIES[policyId].roles, undefined, `${policyId} must not depend on role codes`);
    assert.notEqual(ACCESS_POLICIES[policyId].actorScope, 'company-admin', `${policyId} must not keep admin-only actor scope`);
  }
});

test('FB7 client scope implementation uses active route assignment to subregion store path', () => {
  const repositorySource = read('src/repositories/client.repository.js');
  const serviceSource = read('src/services/client.service.js');

  assert.match(repositorySource, /findRouteScopedCompanyClients/);
  assert.match(repositorySource, /stores:\s*\{\s*some:/);
  assert.match(repositorySource, /isActive:\s*true/);
  assert.match(repositorySource, /subregion:\s*\{/);
  assert.match(repositorySource, /salesRoutes:\s*\{/);
  assert.match(repositorySource, /assignments:\s*\{/);
  assert.match(repositorySource, /userId/);

  assert.match(serviceSource, /hasAllCompanyClientScope\(auth\)/);
  assert.match(serviceSource, /clients\.view\.all/);
  assert.match(serviceSource, /clients\.view/);
  assert.match(serviceSource, /assertClientInActorScope/);
});

test('FB7 backfill is additive and does not escalate custom roles to all-company, delete, or credit', () => {
  const migration = read('prisma/migrations/20261016000000_fb6_fb7_permission_catalog_backfill/migration.sql');

  assert.match(migration, /legacy_permission\."code" = 'clients\.manage'/);
  assert.match(migration, /'clients\.view'/);
  assert.match(migration, /'clients\.create'/);
  assert.match(migration, /'clients\.edit'/);
  assert.match(migration, /'clients\.references\.create'/);
  assert.match(migration, /'clients\.documents\.upload'/);
  assert.match(migration, /'clients\.documents\.download'/);
  assert.match(migration, /does NOT grant clients\.view\.all, clients\.delete, or clients\.credit\.manage/);
  assert.match(migration, /r\."code" IN \('sales', 'sales_supervisor'\)[\s\S]*'clients\.view\.all'/);
});

test('frontend client actions depend on permissions instead of role code', () => {
  const viewSource = read('src/public/root/views/clients-admin.js');
  const rendererSource = read('src/public/root/views/clients-admin.renderers.js');

  assert.match(viewSource, /permissionSet\.has\('clients\.create'\)/);
  assert.match(viewSource, /permissionSet\.has\('clients\.edit'\)/);
  assert.match(viewSource, /permissionSet\.has\('clients\.references\.create'\)/);
  assert.match(viewSource, /permissionSet\.has\('clients\.documents\.upload'\)/);
  assert.match(viewSource, /permissionSet\.has\('clients\.documents\.download'\)/);
  assert.match(viewSource, /permissionSet\.has\('clients\.credit\.manage'\)/);
  assert.match(viewSource, /permissionSet\.has\('clients\.delete'\)/);
  assert.match(viewSource, /permissionSet\.has\('integration\.taxpayer\.lookup'\)/);
  assert.match(viewSource, /canEditClient \|\| !canLookupTaxpayer/);
  assert.doesNotMatch(viewSource, /canDeactivate\s*=\s*session\?\.user\?\.role\?\.code === 'admin'/);

  assert.match(rendererSource, /canEditClient/);
  assert.match(rendererSource, /canCreateReference/);
  assert.match(rendererSource, /canUploadDocument/);
  assert.match(rendererSource, /canDownloadDocument/);
  assert.match(rendererSource, /canManageCredit/);
  assert.match(rendererSource, /canDeactivate/);
  assert.match(rendererSource, /canLookupTaxpayer/);
  assert.match(rendererSource, /canEditClient && canLookupTaxpayer/);
});
