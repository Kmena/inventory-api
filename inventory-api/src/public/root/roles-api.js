(function attachRootRolesApi(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  async function listPermissions(session) {
    return inventoryAuth.fetchJson(session, '/api/roles/permissions', {
      fallbackMessage: 'No se pudieron cargar los permisos disponibles.',
    });
  }

  async function listRoles(session) {
    return inventoryAuth.fetchJson(session, '/api/roles/company', {
      fallbackMessage: 'No se pudieron cargar los roles de la empresa.',
    });
  }

  async function createRole(session, payload) {
    return inventoryAuth.fetchJson(session, '/api/roles/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el rol.',
    });
  }

  async function updateRole(session, roleId, payload) {
    return inventoryAuth.fetchJson(session, `/api/roles/company/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudieron guardar los cambios del rol.',
    });
  }

  rootShell.register('rolesApi', {
    createRole,
    listPermissions,
    listRoles,
    updateRole,
  });
}(window));
