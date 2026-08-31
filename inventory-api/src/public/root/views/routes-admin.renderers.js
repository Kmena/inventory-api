(function attachRootShellRoutesAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const routesHelpers = rootShell.require('views.routesAdminHelpers');

  function renderRouteList(routes, selectedRouteId) {
    if (!routes.length) {
      return '<p class="empty-state">Aun no hay rutas creadas.</p>';
    }

    return routes.map((route) => `
      <button class="commercial-list-item ${String(route.id) === String(selectedRouteId) ? 'active' : ''}" type="button" data-route-select="${rootShellUi.escapeHtml(route.id)}">
        <span class="commercial-list-item__title">${rootShellUi.escapeHtml(route.code || route.name)}</span>
        <span class="commercial-list-item__meta">${rootShellUi.escapeHtml(route.name || 'Ruta comercial')}</span>
        <span class="commercial-list-item__badges">
          ${rootShellUi.renderStatusBadge(route.isActive !== false, 'Activa', 'Inactiva')}
          <span class="badge">${rootShellUi.escapeHtml(String(route.subzonesCount || 0))} subzona(s)</span>
          <span class="badge">${rootShellUi.escapeHtml(String(route.assignmentsCount || 0))} agente(s)</span>
        </span>
      </button>
    `).join('');
  }

  function renderCoverage(stores) {
    if (!Array.isArray(stores) || !stores.length) {
      return '<p class="empty-state">Aun no hay tiendas cubiertas por esta ruta.</p>';
    }

    return `
      <div class="table-like-list">
        ${stores.map((store) => `
          <article class="inline-card">
            <strong>${rootShellUi.escapeHtml(store.name || 'Tienda')}</strong>
            <p class="muted">${rootShellUi.escapeHtml(store.clientName || 'Sin cliente')} · ${rootShellUi.escapeHtml(store.subregionName || 'Sin subzona')}</p>
            <p class="muted">${Number.isFinite(Number(store.latitude)) && Number.isFinite(Number(store.longitude)) ? 'Con coordenadas' : 'Sin coordenadas'}</p>
          </article>
        `).join('')}
      </div>
    `;
  }

  /**
   * Renders the Leaflet map container. The actual map tiles + markers are
   * initialized imperatively in routes-admin.js after innerHTML is set.
   */
  function renderLeafletMap(route) {
    const mappableCount = (route?.stores || []).filter(
      (s) => s.latitude !== null && s.longitude !== null
        && Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude)),
    ).length;

    if (!mappableCount) {
      return '<p class="empty-state">No hay tiendas con coordenadas para mostrar en el mapa.</p>';
    }

    return `
      <div class="route-map-card">
        <p class="muted">${mappableCount} tienda(s) con coordenadas en la ruta.</p>
        <div id="routes-leaflet-map" class="route-leaflet-map"></div>
      </div>
    `;
  }

  function renderGoalsEditor(agents, selectedAgentId, goalRows) {
    if (!agents.length) {
      return '<p class="empty-state">Asigna al menos un agente para administrar metas.</p>';
    }

    const selectedAgent = agents.find((agent) => String(agent.id) === String(selectedAgentId)) || agents[0];
    const rows = Array.isArray(goalRows) && goalRows.length ? goalRows : (selectedAgent?.goals || []);
    return `
      <div class="stack-section">
        <label><span>Agente</span><select id="routes-goals-agent-select">${agents.map((agent) => `<option value="${rootShellUi.escapeHtml(agent.id)}" ${String(agent.id) === String(selectedAgent.id) ? 'selected' : ''}>${rootShellUi.escapeHtml(agent.fullName || agent.username)}</option>`).join('')}</select></label>
        <form id="routes-goals-form" class="root-form root-form--compact">
          <div id="routes-goals-rows" class="stack-form">
            ${(rows || []).map((goal, index) => `
              <article class="inline-card route-goal-row" data-goal-row>
                <div class="root-form-grid">
                  <label><span>Titulo</span><input name="title" data-goal-field="title" data-goal-index="${index}" value="${rootShellUi.escapeHtml(goal.title || '')}" /></label>
                  <label><span>Periodo</span><input name="periodLabel" data-goal-field="periodLabel" data-goal-index="${index}" value="${rootShellUi.escapeHtml(goal.periodLabel || '')}" /></label>
                  <label><span>Meta</span><input name="targetAmount" data-goal-field="targetAmount" data-goal-index="${index}" type="number" min="0" step="0.01" value="${rootShellUi.escapeHtml(goal.targetAmount || 0)}" /></label>
                  <label><span>Actual</span><input name="currentAmount" data-goal-field="currentAmount" data-goal-index="${index}" type="number" min="0" step="0.01" value="${rootShellUi.escapeHtml(goal.currentAmount || 0)}" /></label>
                </div>
              </article>
            `).join('') || '<p class="empty-state">No hay metas cargadas para este agente.</p>'}
          </div>
          <div class="action-row compact-action-row">
            <button id="routes-goals-add-button" class="secondary-button" type="button">Agregar meta</button>
            <button type="submit">Guardar metas</button>
          </div>
        </form>
      </div>
    `;
  }

  function renderRouteDetail(route, zones, agents, selectedGoalsAgentId, goalRows) {
    if (!route) {
      return '<p class="empty-state">Selecciona una ruta del listado para administrar su detalle.</p>';
    }

    const zoneOptions = (Array.isArray(zones) ? zones : []).flatMap((zone) => (zone.subregions || []).map((subregion) => ({
      id: subregion.id,
      name: subregion.name,
      regionName: zone.name,
    })));
    const selectedSubzoneIds = new Set((route.subzoneIds || []).map(String));
    const selectedAgentIds = new Set((route.agentIds || []).map(String));
    const assignedAgents = (agents || []).filter((agent) => selectedAgentIds.has(String(agent.id))).map((agent) => ({
      ...agent,
      goals: route.agents?.find((routeAgent) => String(routeAgent.id) === String(agent.id))?.goals || agent.goals || [],
    }));

    return `
      <section class="stack-section">
        <h4>Definicion de ruta</h4>
        <form id="routes-definition-form" class="root-form">
          <input type="hidden" name="routeId" value="${rootShellUi.escapeHtml(route.id)}" />
          <div class="root-form-grid">
            <label><span>Codigo *</span><input name="code" type="text" required minlength="2" maxlength="40" value="${rootShellUi.escapeHtml(route.code || '')}" /></label>
            <label><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="120" value="${rootShellUi.escapeHtml(route.name || '')}" /></label>
            <label><span>Frecuencia *</span><input name="visitFrequencyDays" type="number" min="1" required value="${rootShellUi.escapeHtml(route.visitFrequencyDays || 1)}" /></label>
            <label><span>Alerta *</span><input name="nearLimitDays" type="number" min="0" required value="${rootShellUi.escapeHtml(route.nearLimitDays || 0)}" /></label>
            <label><span>Activa</span><input name="isActive" type="checkbox" ${route.isActive !== false ? 'checked' : ''} /></label>
          </div>
          <div class="action-row compact-action-row"><button type="submit">Guardar ruta</button></div>
        </form>
      </section>

      <section class="stack-section">
        <h4>Cobertura por subzonas</h4>
        <form id="routes-subzones-form" class="stack-form">
          <input type="hidden" name="routeId" value="${rootShellUi.escapeHtml(route.id)}" />
          <div class="checklist-grid">
            ${zoneOptions.map((option) => `
              <label class="check-card">
                <input type="checkbox" name="subregionIds" value="${rootShellUi.escapeHtml(option.id)}" ${selectedSubzoneIds.has(String(option.id)) ? 'checked' : ''} />
                <span>
                  <strong>${rootShellUi.escapeHtml(option.name)}</strong>
                  <small>${rootShellUi.escapeHtml(option.regionName)}</small>
                </span>
              </label>
            `).join('')}
          </div>
          <div class="action-row compact-action-row"><button type="submit">Guardar subzonas</button></div>
        </form>
      </section>

      <section class="stack-section">
        <h4>Agentes asignados</h4>
        <form id="routes-assignments-form" class="stack-form">
          <input type="hidden" name="routeId" value="${rootShellUi.escapeHtml(route.id)}" />
          <div class="checklist-grid">
            ${(agents || []).map((agent) => `
              <label class="check-card route-agent-card">
                <input type="checkbox" name="userIds" value="${rootShellUi.escapeHtml(agent.id)}" ${selectedAgentIds.has(String(agent.id)) ? 'checked' : ''} />
                <span>
                  <strong>${rootShellUi.escapeHtml(agent.fullName || agent.username)}</strong>
                  <small>${rootShellUi.escapeHtml(agent.role?.name || agent.role?.code || 'Perfil comercial')}</small>
                </span>
              </label>
            `).join('')}
          </div>
          <div class="action-row compact-action-row"><button type="submit">Guardar agentes</button></div>
        </form>
      </section>

      <section class="stack-section">
        <h4>Metas por agente</h4>
        ${renderGoalsEditor(assignedAgents, selectedGoalsAgentId, goalRows)}
      </section>

      <section class="stack-section">
        <h4>Tiendas cubiertas</h4>
        ${renderCoverage(route.stores || [])}
      </section>

      <section class="stack-section">
        <h4>Mapa de cobertura</h4>
        ${renderLeafletMap(route)}
      </section>
    `;
  }

  rootShell.register('views.routesAdminRenderers', {
    renderCoverage,
    renderGoalsEditor,
    renderLeafletMap,
    renderRouteDetail,
    renderRouteList,
  });
}(window));
