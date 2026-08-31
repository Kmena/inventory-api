(function attachRootShellUsersAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  /**
   * Extrae los códigos de permiso de un rol en cualquiera de sus dos formatos:
   *   - `role.permissions: [{ code: string }]` (API enriched)
   *   - `role.rolePermissions: [{ permission: { code: string } }]` (Prisma include)
   */
  function extractPermissionCodes(role) {
    const fromPermissions = (role?.permissions || []).map((p) => p?.code || p);
    const fromRolePermissions = (role?.rolePermissions || []).map((rp) => rp?.permission?.code);
    return [...fromPermissions, ...fromRolePermissions].filter(Boolean).map(normalizeText);
  }

  /**
   * Infiere el dashboard de destino para un rol dado.
   * Espeja la lógica de `resolveLanding()` en permission-governance.service.js:
   *   1. Excepción root global (roleCode='root').
   *   2. Permisos de landing explícitos (root.access > agent.access > warehouse.access).
   *   3. Fallback legacy para role codes históricos.
   *
   * @param {object | null | undefined} role
   * @returns {{ label: string, path: string, note: string | null }}
   */
  function inferDashboard(role) {
    const roleCode = role?.code;

    // 1. Excepción plataforma — root sin companyId maneja esto aparte
    if (roleCode === 'root') {
      return { label: 'Root', path: '/root/', note: null };
    }

    const permCodes = extractPermissionCodes(role);

    // 2. Permisos de landing explícitos — misma prioridad que el backend
    //    root.access (0) > agent.access (1) > warehouse.access (2)
    if (permCodes.includes('root.access')) {
      const note = roleCode === 'admin' ? 'administrador' : null;
      return { label: 'Root', path: '/root/', note };
    }

    if (permCodes.includes('agent.access')) {
      return { label: 'Agent', path: '/agent/', note: null };
    }

    if (permCodes.includes('warehouse.access')) {
      return { label: 'Warehouse', path: '/warehouse/', note: null };
    }

    // 3. Fallback legacy para roles históricos sin permiso de landing explícito
    if (roleCode === 'admin') {
      return { label: 'Root', path: '/root/', note: 'administrador (sin root.access)' };
    }

    if (roleCode === 'sales_agent') {
      return { label: 'Agent', path: '/agent/', note: 'legacy' };
    }

    if (roleCode === 'sales_supervisor') {
      return { label: 'Root', path: '/root/', note: 'acceso comercial' };
    }

    if (permCodes.includes('procurement.manage')) {
      return { label: 'Root', path: '/root/', note: 'abastecimiento' };
    }

    return { label: 'Sin acceso', path: '/no-access.html', note: null };
  }

  /**
   * Combina usuarios con su descriptor de dashboard y ordena por fullName.
   */
  function composeUsersDataset(users) {
    const safeUsers = Array.isArray(users) ? users : (users?.items || []);
    return safeUsers
      .map((user) => ({ ...user, dashboardDescriptor: inferDashboard(user?.role) }))
      .sort((a, b) => normalizeText(a.fullName).localeCompare(normalizeText(b.fullName), 'es'));
  }

  /**
   * Filtra usuarios compuestos por texto libre y por dashboard path.
   */
  function filterUsers(composedUsers, searchTerm, dashboardFilter) {
    let result = composedUsers;

    if (dashboardFilter && dashboardFilter !== 'all') {
      result = result.filter((u) => u.dashboardDescriptor?.path === dashboardFilter);
    }

    const term = normalizeText(searchTerm);
    if (term) {
      result = result.filter((u) =>
        normalizeText(u.fullName).includes(term)
        || normalizeText(u.username).includes(term)
        || normalizeText(u.role?.name).includes(term)
        || normalizeText(u.role?.code).includes(term)
      );
    }

    return result;
  }

  /**
   * Cuenta usuarios por tipo de dashboard.
   */
  function summarizeUsers(composedUsers) {
    const counts = { total: composedUsers.length, root: 0, agent: 0, warehouse: 0, noAccess: 0 };
    for (const u of composedUsers) {
      const path = u.dashboardDescriptor?.path;
      if (path === '/root/') counts.root += 1;
      else if (path === '/agent/') counts.agent += 1;
      else if (path === '/warehouse/') counts.warehouse += 1;
      else counts.noAccess += 1;
    }
    return counts;
  }

  rootShell.register('views.usersAdminHelpers', {
    inferDashboard,
    extractPermissionCodes,
    composeUsersDataset,
    filterUsers,
    normalizeText,
    summarizeUsers,
  });
}(window));
