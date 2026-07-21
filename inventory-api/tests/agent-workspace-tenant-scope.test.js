const test = require('node:test');
const assert = require('node:assert/strict');

const agentWorkspaceService = require('../src/services/agent-workspace.service');
const agentWorkspaceRepository = require('../src/repositories/agent-workspace.repository');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, agentWorkspaceRepository[key]);
    agentWorkspaceRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        agentWorkspaceRepository[key] = value;
      }
    });
}

test('listAgentDashboard rejects authenticated users without company scope', async () => {
  await assert.rejects(
    () => agentWorkspaceService.listAgentDashboard({ companyId: null, sub: '10' }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listAgentDashboard rejects users without authenticated subject', async () => {
  await assert.rejects(
    () => agentWorkspaceService.listAgentDashboard({ companyId: '7', sub: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listAgentDashboard scopes repository access to the authenticated company and agent user', async () => {
  let receivedAgentLookup = null;
  let receivedStoreLookup = null;

  const dashboard = await withRepositoryStubs(
    {
      findAgentUser: async (userId, companyId) => {
        receivedAgentLookup = { userId, companyId };
        return {
          id: userId,
          companyId,
          fullName: 'Agente Uno',
          username: 'agente1',
          role: { code: 'sales_agent', name: 'Agente' },
          salesRouteAssignments: [{ salesRoute: { id: 4n, code: 'R-4', name: 'Ruta 4', visitFrequencyDays: 7, nearLimitDays: 2 } }],
        };
      },
      findVisibleStoresForAgent: async (companyId, assignedRouteIds) => {
        receivedStoreLookup = { companyId, assignedRouteIds };
        return [];
      },
    },
    () => agentWorkspaceService.listAgentDashboard({ companyId: '7', sub: '15' }),
  );

  assert.deepEqual(receivedAgentLookup, { userId: 15n, companyId: 7n });
  assert.deepEqual(receivedStoreLookup, { companyId: 7n, assignedRouteIds: [4n] });
  assert.equal(dashboard.agent.id, 15n);
  assert.equal(dashboard.summary.routesAssignedCount, 1);
});

test('listAgentDashboard rejects authenticated company users without agent workspace profile', async () => {
  await withRepositoryStubs(
    {
      findAgentUser: async () => ({
        id: 15n,
        fullName: 'Admin Empresa',
        username: 'admin1',
        role: { code: 'admin', name: 'Administrador', rolePermissions: [] },
        salesRouteAssignments: [],
      }),
    },
    async () => {
      await assert.rejects(
        () => agentWorkspaceService.listAgentDashboard({ companyId: '7', sub: '15' }),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'forbidden');
          return true;
        },
      );
    },
  );
});
