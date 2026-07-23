const test = require('node:test');
const assert = require('node:assert/strict');

const salesRouteService = require('../src/services/sales-route.service');
const salesRouteRepository = require('../src/repositories/sales-route.repository');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, salesRouteRepository[key]);
    salesRouteRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        salesRouteRepository[key] = value;
      }
    });
}

function createRoute(routeId = 5n) {
  return {
    id: routeId,
    code: 'R-5',
    name: 'Ruta 5',
    visitFrequencyDays: 7,
    nearLimitDays: 2,
    isActive: true,
    subzones: [],
    assignments: [],
  };
}

test('saveCompanyRouteSubzones rejects subregions that do not belong to the authenticated company', async () => {
  await withRepositoryStubs(
    {
      findCompanyRouteById: async () => createRoute(),
      findCompanySubregionsByIds: async () => [{ id: 101n }],
    },
    async () => {
      await assert.rejects(
        () => salesRouteService.saveCompanyRouteSubzones(5n, { subregionIds: [101n, 102n] }, { companyId: '7' }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'validation_error');
          return true;
        },
      );
    },
  );
});

test('saveCompanyRouteSubzones rejects conflicting subregion assignments from another route in the same tenant', async () => {
  await withRepositoryStubs(
    {
      findCompanyRouteById: async () => createRoute(),
      findCompanySubregionsByIds: async () => [{ id: 101n }],
      findCompanyRoutesBySubregionIds: async () => [{
        subregion: { name: 'Subzona Norte' },
        salesRoute: { code: 'R-9' },
      }],
    },
    async () => {
      await assert.rejects(
        () => salesRouteService.saveCompanyRouteSubzones(5n, { subregionIds: [101n] }, { companyId: '7' }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          assert.match(error.message, /Subzona Norte/);
          return true;
        },
      );
    },
  );
});

test('saveCompanyRouteSubzones replaces the route subzones after tenant-scoped validation', async () => {
  let replaceCall = null;

  const updatedRoute = await withRepositoryStubs(
    {
      findCompanyRouteById: async () => createRoute(),
      findCompanySubregionsByIds: async (_companyId, ids) => ids.map((id) => ({ id })),
      findCompanyRoutesBySubregionIds: async () => [],
      replaceRouteSubzones: async (companyId, routeId, subregionIds) => {
        replaceCall = { companyId, routeId, subregionIds };
        return {
          ...createRoute(routeId),
          subzones: subregionIds.map((subregionId, index) => ({
            id: BigInt(index + 1),
            subregionId,
            subregion: { id: subregionId, name: `Subzona ${index + 1}`, region: { name: 'Centro' }, stores: [] },
          })),
        };
      },
    },
    () => salesRouteService.saveCompanyRouteSubzones(5n, { subregionIds: [101n, 102n, 101n] }, { companyId: '7' }),
  );

  assert.deepEqual(replaceCall, {
    companyId: 7n,
    routeId: 5n,
    subregionIds: [101n, 102n],
  });
  assert.equal(updatedRoute.subzonesCount, 2);
  assert.deepEqual(updatedRoute.subzoneIds, [101n, 102n]);
});

test('removeCompanyRouteSubzone rejects subzones outside the authenticated company', async () => {
  await withRepositoryStubs(
    {
      findCompanyRouteById: async () => createRoute(),
      findCompanySubregionsByIds: async () => [],
    },
    async () => {
      await assert.rejects(
        () => salesRouteService.removeCompanyRouteSubzone(5n, 101n, { companyId: '7' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('removeCompanyRouteSubzone rejects subzones that are not currently assigned to the route', async () => {
  await withRepositoryStubs(
    {
      findCompanyRouteById: async () => createRoute(),
      findCompanySubregionsByIds: async () => [{ id: 101n }],
      removeRouteSubzone: async () => ({ removedCount: 0, route: createRoute() }),
    },
    async () => {
      await assert.rejects(
        () => salesRouteService.removeCompanyRouteSubzone(5n, 101n, { companyId: '7' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('removeCompanyRouteSubzone removes a company subzone from the route and returns the updated route', async () => {
  let removeCall = null;

  const updatedRoute = await withRepositoryStubs(
    {
      findCompanyRouteById: async () => createRoute(),
      findCompanySubregionsByIds: async () => [{ id: 101n }],
      removeRouteSubzone: async (companyId, routeId, subregionId) => {
        removeCall = { companyId, routeId, subregionId };
        return {
          removedCount: 1,
          route: {
            ...createRoute(routeId),
            subzones: [],
          },
        };
      },
    },
    () => salesRouteService.removeCompanyRouteSubzone(5n, 101n, { companyId: '7' }),
  );

  assert.deepEqual(removeCall, {
    companyId: 7n,
    routeId: 5n,
    subregionId: 101n,
  });
  assert.equal(updatedRoute.subzonesCount, 0);
}
);