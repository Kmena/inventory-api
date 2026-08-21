(function attachRootShellGuards(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  function isRootUser(session) {
    const roleCode = session?.user?.role?.code;
    return roleCode === 'root' && !session?.user?.companyId;
  }

  function isCompanyAdmin(session) {
    const roleCode = session?.user?.role?.code;
    return roleCode === 'admin' && Boolean(session?.user?.companyId);
  }

  function hasProcurementAccess(session) {
    return Boolean(
      session?.user?.companyId &&
      (session?.user?.permissions || []).includes('procurement.manage')
    );
  }

  function hasExplicitRootLanding(session) {
    return session?.user?.landing?.target === 'root';
  }

  function isEligibleRootShellSession(session) {
    // Primary: explicit landing (TASK-004)
    if (hasExplicitRootLanding(session)) {
      return true;
    }

    // Legacy fallback (DEC-007: kept during transition before backfill)
    return isRootUser(session) || isCompanyAdmin(session) || hasProcurementAccess(session);
  }

  function resolveShellAccess(session) {
    if (!session?.user) {
      return { allowed: false, redirect: '/', reason: 'session-expired' };
    }

    if (!isEligibleRootShellSession(session)) {
      return { allowed: false, redirect: '/no-access.html', reason: 'not-eligible' };
    }

    return { allowed: true, redirect: null, reason: null };
  }

  function canAccessRoute(session, navigationItem) {
    if (!navigationItem || typeof navigationItem.visibilityRule !== 'function') {
      return false;
    }

    return Boolean(navigationItem.visibilityRule(session));
  }

  rootShell.register('guards', {
    canAccessRoute,
    hasExplicitRootLanding,
    hasProcurementAccess,
    isCompanyAdmin,
    isEligibleRootShellSession,
    isRootUser,
    resolveShellAccess,
  });
}(window));
