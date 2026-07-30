const test = require('node:test');
const assert = require('node:assert/strict');

const companyRoutes = require('../src/routes/company.routes');
const companyService = require('../src/services/company.service');
const companyRepository = require('../src/repositories/company.repository');

function getRouteGuard(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-company-auth-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

test('legacy GET /api/companies keeps global listing unavailable to company admins', async () => {
  const guard = getRouteGuard(companyRoutes, '/', 'get');

  const deniedError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'root', companyId: null });
  assert.equal(allowedError, undefined);
});

test('legacy POST /api/companies keeps global creation unavailable to company admins and tenant-scoped roots', async () => {
  const guard = getRouteGuard(companyRoutes, '/', 'post');

  const deniedCompanyAdminError = await runGuard(guard, { role: 'admin', companyId: '7' });
  assert.equal(deniedCompanyAdminError?.statusCode, 403);
  assert.equal(deniedCompanyAdminError?.code, 'forbidden');

  const deniedTenantRootError = await runGuard(guard, { role: 'root', companyId: '7' });
  assert.equal(deniedTenantRootError?.statusCode, 403);
  assert.equal(deniedTenantRootError?.code, 'forbidden');

  const allowedError = await runGuard(guard, { role: 'root', companyId: null });
  assert.equal(allowedError, undefined);
});

test('companyService.listCompaniesForRoot rejects actors with tenant scope', async () => {
  await assert.rejects(
    () => companyService.listCompaniesForRoot({ role: 'root', companyId: '7' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('companyService.listCompaniesForRoot returns global companies for the root creator', async () => {
  const originalFindAllCompaniesForRoot = companyRepository.findAllCompaniesForRoot;
  const expectedCompanies = [{ id: 1n, name: 'Acme Global' }];
  companyRepository.findAllCompaniesForRoot = async () => expectedCompanies;

  try {
    const companies = await companyService.listCompaniesForRoot({ role: 'root', companyId: null });
    assert.equal(companies, expectedCompanies);
  } finally {
    companyRepository.findAllCompaniesForRoot = originalFindAllCompaniesForRoot;
  }
});

test('companyService.registerCompany rejects actors with tenant scope before persisting', async () => {
  await assert.rejects(
    () => companyService.registerCompany({ name: 'Blocked Company' }, { role: 'root', companyId: '7' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});
