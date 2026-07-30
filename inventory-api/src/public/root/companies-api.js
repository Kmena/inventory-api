(function attachRootCompaniesApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listCompanies(session) {
    return inventoryAuth.fetchJson(session, '/api/companies/root/companies', {
      fallbackMessage: 'No se pudieron cargar las empresas.',
    });
  }

  async function createCompany(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/companies/root/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear la empresa.',
    });
  }

  async function updateCompanyStatus(session, companyId, isActive) {
    return inventoryAuth.fetchJson(session, `/api/companies/root/companies/${encodeURIComponent(companyId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
      fallbackMessage: 'No se pudo actualizar el estado de la empresa.',
    });
  }

  rootShell.register('companiesApi', {
    createCompany,
    listCompanies,
    updateCompanyStatus,
  });
}(window));
