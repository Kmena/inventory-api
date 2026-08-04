(function attachRootShellAgentsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function renderList(agents, selectedAgentId) {
    if (!agents.length) {
      return '<p class="empty-state">Aun no hay agentes comerciales registrados.</p>';
    }

    return agents.map((agent) => `
      <button class="commercial-list-item ${String(agent.id) === String(selectedAgentId) ? 'active' : ''}" type="button" data-agent-select="${rootShellUi.escapeHtml(agent.id)}">
        <span class="commercial-list-item__title">${rootShellUi.escapeHtml(agent.fullName || agent.username || 'Sin nombre')}</span>
        <span class="commercial-list-item__meta">${rootShellUi.escapeHtml(agent.group)} · ${rootShellUi.escapeHtml(agent.role?.name || agent.role?.code || 'Sin rol')}</span>
        <span class="commercial-list-item__badges">
          ${rootShellUi.renderStatusBadge(agent.status === 'ACTIVE' || agent.status === 1 || agent.status === '1' || agent.status === true, 'Activo', 'Inactivo')}
          <span class="badge">${agent.assignmentsCount} ruta(s)</span>
          <span class="badge">${agent.goalsCount} meta(s)</span>
        </span>
      </button>
    `).join('');
  }

  function renderAssignedRoutes(assignedRoutes) {
    if (!assignedRoutes.length) {
      return '<p class="empty-state">Este agente aun no tiene rutas asignadas.</p>';
    }

    return `
      <div class="tag-list">
        ${assignedRoutes.map((route) => `<span class="tag">${rootShellUi.escapeHtml(route.code || route.name)}</span>`).join('')}
      </div>
    `;
  }

  function renderAssignmentsEditor(routeOptions, selectedRouteIds, disabledReason) {
    if (disabledReason) {
      return rootShellUi.renderInlineMessage(disabledReason, 'warning');
    }

    if (!routeOptions.length) {
      return '<p class="empty-state">No hay rutas disponibles para asignar todavia.</p>';
    }

    const selectedSet = new Set(selectedRouteIds.map(String));
    return `
      <form id="agents-assignments-form" class="stack-form">
        <div class="checklist-grid">
          ${routeOptions.map((route) => `
            <label class="check-card">
              <input type="checkbox" name="routeIds" value="${rootShellUi.escapeHtml(route.id)}" ${selectedSet.has(String(route.id)) ? 'checked' : ''} />
              <span>
                <strong>${rootShellUi.escapeHtml(route.code || route.name)}</strong>
                <small>${rootShellUi.escapeHtml(route.name || 'Ruta comercial')}</small>
              </span>
            </label>
          `).join('')}
        </div>
        <div class="action-row compact-action-row">
          <button id="agents-save-assignments-button" type="submit">Guardar rutas asignadas</button>
        </div>
      </form>
    `;
  }

  function renderGoals(goals) {
    if (!goals.length) {
      return '<p class="empty-state">No hay metas visibles para este agente.</p>';
    }

    return goals.map((goal) => `
      <article class="inline-card">
        <strong>${rootShellUi.escapeHtml(goal.title)}</strong>
        <p class="muted">${rootShellUi.escapeHtml(goal.periodLabel || 'Sin periodo')}</p>
        <p class="muted">Meta: ${rootShellUi.escapeHtml(String(goal.targetAmount || 0))} · Actual: ${rootShellUi.escapeHtml(String(goal.currentAmount || 0))}</p>
      </article>
    `).join('');
  }

  function renderDetail(agent, routeOptions, routesUnavailable) {
    if (!agent) {
      return '<p class="empty-state">Selecciona un agente del listado para ver su detalle.</p>';
    }

    return `
      <section class="stack-section">
        <div class="page-header">
          <div>
            <h4>${rootShellUi.escapeHtml(agent.fullName || agent.username || 'Sin nombre')}</h4>
            <p class="muted">${rootShellUi.escapeHtml(agent.email || 'Sin correo')} · ${rootShellUi.escapeHtml(agent.phone || 'Sin telefono')}</p>
          </div>
          <div class="status-stack">
            ${rootShellUi.renderStatusBadge(agent.status === 'ACTIVE' || agent.status === 1 || agent.status === '1' || agent.status === true, 'Activo', 'Inactivo')}
            <span class="badge">${rootShellUi.escapeHtml(agent.group)}</span>
          </div>
        </div>
        ${agent.isLegacySalesRole ? rootShellUi.renderInlineMessage('Este usuario usa el rol legado ventas. Considera un rol comercial mas especifico cuando sea posible.', 'warning') : ''}
      </section>

      <section class="stack-section">
        <h4>Rutas asignadas</h4>
        ${renderAssignedRoutes(agent.assignedRoutes || [])}
      </section>

      <section class="stack-section">
        <h4>Metas visibles</h4>
        ${renderGoals(agent.goals || [])}
      </section>

      <section class="stack-section">
        <div class="page-header">
          <div>
            <h4>Asignar rutas</h4>
            <p class="muted">Esta vista se mantiene centrada en el agente. La definicion de rutas sigue viviendo en Rutas.</p>
          </div>
          <a class="secondary-button button-link" href="/root/#routes">Gestionar en rutas</a>
        </div>
        ${renderAssignmentsEditor(routeOptions, agent.routeIds || [], routesUnavailable)}
      </section>
    `;
  }

  rootShell.register('views.agentsAdminRenderers', {
    renderAssignmentsEditor,
    renderAssignedRoutes,
    renderDetail,
    renderGoals,
    renderList,
  });
}(window));
