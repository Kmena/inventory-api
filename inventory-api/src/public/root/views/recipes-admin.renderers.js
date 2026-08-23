(function attachRootShellRecipesAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const recipesState = rootShell.require('views.recipesAdminState');

  function renderWorkspace() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Produccion</p>
        <h2 id="root-view-title">Recetas</h2>
        <p class="muted">Administra recetas, versiones y su relacion con productos sin mezclar flujos operativos de warehouse.</p>
      </section>

      <section class="routes-page products-page recipes-admin" id="recipes-page">
        <div id="recipes-metrics" class="commercial-metrics" aria-live="polite"></div>
        <div id="recipes-page-message" aria-live="polite"></div>

        <article class="card root-card warehouses-workspace">
          <div class="page-header warehouses-header">
            <div>
              <h3>Catalogo administrativo de recetas</h3>
              <p id="recipes-list-summary" class="muted">Consulta recetas activas, abre su detalle y administra versiones y asignaciones segun tus permisos.</p>
            </div>
            <div class="action-row compact-action-row recipes-header-actions">
              <button id="recipes-refresh-button" class="secondary-button" type="button">Actualizar</button>
              <button id="recipes-open-create-button" type="button">Nueva receta</button>
            </div>
          </div>

          <div class="client-command-bar products-filter-grid">
            <label class="client-search-field products-search-field"><span>Buscar</span><input id="recipes-search-input" type="search" placeholder="Codigo, nombre o tipo" /></label>
            <label><span>Estado</span><select id="recipes-status-filter"><option value="">Todos</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>
            <label><span>Tipo</span><select id="recipes-type-filter"><option value="">Todos</option></select></label>
            <label><span>Compartida</span><select id="recipes-shared-filter"><option value="">Todas</option><option value="yes">Solo compartidas</option><option value="no">No compartidas</option></select></label>
            <button id="recipes-clear-filters-button" class="secondary-button" type="button">Limpiar filtros</button>
          </div>

          <div class="products-workspace-grid">
            <div>
              <div id="recipes-list-region" aria-live="polite"></div>
            </div>
            <aside class="card root-card products-detail-card" aria-labelledby="recipes-detail-title">
              <div class="page-header">
                <div>
                  <h3 id="recipes-detail-title">Detalle de receta</h3>
                  <p id="recipes-detail-subtitle" class="muted">Selecciona una receta del listado para revisar versiones y productos asociados.</p>
                </div>
              </div>
              <div id="recipes-detail-message" aria-live="polite"></div>
              <div id="recipes-detail-region"></div>
            </aside>
          </div>
        </article>
      </section>

      <dialog id="recipes-form-dialog" class="modal-card products-modal-card">
        <form id="recipes-form" class="root-form" method="dialog" novalidate>
          <div class="products-modal-header">
            <div>
              <h3 id="recipes-form-title">Nueva receta</h3>
              <p class="muted">Registra una receta administrativa desde root.</p>
            </div>
            <button id="recipes-close-form-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="recipes-form-message" aria-live="polite"></div>
          <fieldset class="root-form__section">
            <legend>Datos principales</legend>
            <div class="products-form-grid">
              <label class="products-field-wide"><span>Nombre *</span><input id="recipes-form-name" name="name" type="text" required minlength="2" maxlength="255" /></label>
              <label><span>Codigo</span><input name="code" type="text" maxlength="50" /></label>
              <label><span>Tipo</span><input name="recipeType" type="text" maxlength="100" placeholder="BASE, ACABADO..." /></label>
              <label class="products-field-full products-checkbox-label">
                <input id="recipes-form-active" name="isActive" type="checkbox" checked />
                <span>Receta activa</span>
                <span class="products-field-hint">Las recetas inactivas siguen visibles en root para consulta administrativa.</span>
              </label>
            </div>
          </fieldset>
          <div class="action-row products-modal-actions">
            <button id="recipes-form-submit-button" type="submit">Guardar receta</button>
            <button id="recipes-cancel-form-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="recipes-version-dialog" class="modal-card products-modal-card">
        <form id="recipes-version-form" class="root-form" method="dialog" novalidate>
          <div class="products-modal-header">
            <div>
              <h3 id="recipes-version-title">Nueva version borrador</h3>
              <p class="muted">Usa arreglos JSON validos para ingredientes y etapas. Las versiones aprobadas son inmutables.</p>
            </div>
            <button id="recipes-close-version-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="recipes-version-message" aria-live="polite"></div>
          <fieldset class="root-form__section">
            <legend>Configuracion principal</legend>
            <div class="products-form-grid">
              <label><span>Vigencia desde</span><input name="effectiveFrom" type="date" /></label>
              <label><span>Vigencia hasta</span><input name="effectiveTo" type="date" /></label>
              <label><span>Rendimiento esperado</span><input name="expectedYield" type="number" min="0" step="0.01" /></label>
              <label><span>Merma esperada</span><input name="expectedWaste" type="number" min="0" step="0.01" /></label>
              <label><span>Tolerancia rendimiento %</span><input name="yieldTolerancePercent" type="number" min="0" max="100" step="0.01" /></label>
              <label><span>Tolerancia merma %</span><input name="wasteTolerancePercent" type="number" min="0" max="100" step="0.01" /></label>
              <label class="products-field-full"><span>Instrucciones</span><textarea name="instructions" rows="4" maxlength="5000"></textarea></label>
              <label class="products-field-full"><span>Notas</span><textarea name="notes" rows="3" maxlength="2000"></textarea></label>
            </div>
          </fieldset>
          <fieldset class="root-form__section">
            <legend>Etapas de produccion</legend>
            <p class="muted">Define las etapas en orden con sus insumos. El BOM general se calcula automaticamente.</p>
            <div id="recipes-version-stages-list" class="stack-section"></div>
            <button type="button" id="recipes-version-add-stage" class="secondary-button">+ Agregar etapa</button>
          </fieldset>
          <div class="action-row products-modal-actions">
            <button id="recipes-version-submit-button" type="submit">Guardar version</button>
            <button id="recipes-cancel-version-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>

      <dialog id="recipes-stages-modal" class="modal-card products-modal-card" style="max-width:720px">
        <div class="products-modal-header">
          <div>
            <h3 id="recipes-stages-modal-title">Etapas de la version</h3>
            <p class="muted" id="recipes-stages-modal-subtitle"></p>
          </div>
          <button id="recipes-close-stages-modal" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="recipes-stages-modal-body" style="overflow-y:auto;max-height:65vh"></div>
        <div class="action-row products-modal-actions" id="recipes-stages-modal-footer">
          <button id="recipes-stages-edit-btn" class="secondary-button" type="button" hidden>Abrir editor completo</button>
        </div>
      </dialog>

      <dialog id="recipes-assignment-dialog" class="modal-card">
        <form id="recipes-assignment-form" class="root-form" method="dialog" novalidate>
          <div class="page-header">
            <div>
              <h3>Asignar receta a producto</h3>
              <p class="muted">La receta puede compartirse entre varios productos. La version aplicable por producto seguira visible como no definida explicitamente cuando el modelo no la exponga.</p>
            </div>
            <button id="recipes-close-assignment-button" class="secondary-button" type="button">Cerrar</button>
          </div>
          <div id="recipes-assignment-message" aria-live="polite"></div>
          <label><span>Producto</span><select id="recipes-assignment-product" name="productId" required><option value="">Selecciona un producto</option></select></label>
          <div class="action-row">
            <button id="recipes-assignment-submit-button" type="submit">Guardar asignacion</button>
            <button id="recipes-cancel-assignment-button" class="secondary-button" type="button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function renderMetricCard(label, value) {
    return `
      <article class="card root-card metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderMetrics(recipes, associatedProducts) {
    const metrics = recipesState.buildRecipeMetrics(recipes, associatedProducts);
    return [
      renderMetricCard('Total recetas', metrics.totalRecipes),
      renderMetricCard('Activas', metrics.activeRecipes),
      renderMetricCard('Con borrador', metrics.recipesWithDraft),
      renderMetricCard('Compartidas', metrics.sharedRecipes),
    ].join('');
  }

  function renderState(title, description) {
    return `
      <div class="products-empty-panel">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
      </div>
    `;
  }

  function renderRecipeTypeOptions(recipeTypes, selectedRecipeType = '') {
    return ['<option value="">Todos</option>']
      .concat((recipeTypes || []).map((recipeType) => {
        const isSelected = String(recipeType) === String(selectedRecipeType);
        return `<option value="${rootShellUi.escapeHtml(recipeType)}" ${isSelected ? 'selected' : ''}>${rootShellUi.escapeHtml(recipeType)}</option>`;
      }))
      .join('');
  }

  function renderRecipesList(recipes, selectedRecipeId) {
    if (!recipes.length) {
      return '';
    }

    return `
      <div class="stack-section">
        ${recipes.map((recipe) => {
          const isSelected = String(recipe?.id) === String(selectedRecipeId);
          const versionLabel = recipe?.latestApprovedVersionNumber ? `v${recipe.latestApprovedVersionNumber}` : 'Sin aprobada';
          const sharedCount = Number(recipe?.associatedProductsCount || 0);
          return `
            <article class="products-entry-state ${isSelected ? 'is-selected' : ''}">
              <div class="page-header">
                <div>
                  <h4>${rootShellUi.escapeHtml(recipe?.name || 'Receta sin nombre')}</h4>
                  <p class="muted">${rootShellUi.escapeHtml(recipe?.code || 'Sin codigo')} · ${rootShellUi.escapeHtml(recipe?.recipeType || 'Sin tipo')}</p>
                </div>
                <button class="secondary-button" type="button" data-recipe-detail="${rootShellUi.escapeHtml(recipe?.id)}">${isSelected ? 'Detalle abierto' : 'Ver detalle'}</button>
              </div>
              <div class="action-row compact-action-row">
                ${rootShellUi.renderStatusBadge(recipe?.isActive !== false, 'Activa', 'Inactiva')}
                <span class="badge">${rootShellUi.escapeHtml(versionLabel)}</span>
                <span class="badge">${rootShellUi.escapeHtml(sharedCount > 1 ? `Compartida x${sharedCount}` : sharedCount === 1 ? 'Asignada x1' : 'Sin productos')}</span>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderDetailHeader(recipe, associatedProductsCount) {
    return `
      <div class="page-header">
        <div>
          <h3>${rootShellUi.escapeHtml(recipe?.name || 'Receta sin nombre')}</h3>
          <p class="muted">${rootShellUi.escapeHtml(recipe?.code || 'Sin codigo')} · ${rootShellUi.escapeHtml(recipe?.recipeType || 'Sin tipo')}</p>
        </div>
        <div class="action-row compact-action-row">
          ${rootShellUi.renderStatusBadge(recipe?.isActive !== false, 'Activa', 'Inactiva')}
          <span class="badge">${rootShellUi.escapeHtml(associatedProductsCount > 1 ? `Compartida por ${associatedProductsCount} productos` : associatedProductsCount === 1 ? 'Compartida por 1 producto' : 'Sin productos asociados')}</span>
        </div>
      </div>
    `;
  }

  function renderTabs(activeTab) {
    const tabs = [
      { key: 'summary', label: 'Resumen' },
      { key: 'versions', label: 'Versiones' },
      { key: 'products', label: 'Productos asociados' },
    ];

    return `
      <div class="action-row compact-action-row" role="tablist" aria-label="Detalle de receta">
        ${tabs.map((tab) => `
          <button type="button" class="${activeTab === tab.key ? '' : 'secondary-button'}" data-recipes-tab="${tab.key}" role="tab" aria-selected="${activeTab === tab.key ? 'true' : 'false'}">${rootShellUi.escapeHtml(tab.label)}</button>
        `).join('')}
      </div>
    `;
  }

  function renderSummaryTab(recipe) {
    return `
      <div class="stack-section" data-recipes-tab-panel="summary">
        <article class="detail-item"><span>Ultima version aprobada</span><strong>${rootShellUi.escapeHtml(recipe?.latestApprovedVersionNumber ? `v${recipe.latestApprovedVersionNumber}` : 'Sin aprobacion visible')}</strong></article>
        <article class="detail-item"><span>Actualizacion</span><strong>${rootShellUi.escapeHtml(rootShellUi.formatDate(recipe?.updatedAt))}</strong></article>
        <article class="detail-item"><span>Modelo visible</span><strong>Una misma receta puede estar asociada a varios productos.</strong></article>
        <article class="detail-item"><span>Advertencia</span><strong>La version aplicable por producto debe revisarse explicitamente cuando no exista un vinculo directo visible.</strong></article>
      </div>
    `;
  }

  function renderVersionsTab(versions, permissions) {
    if (!versions.length) {
      return `
        <div class="stack-section" data-recipes-tab-panel="versions">
          <p class="empty-state">Aun no hay versiones registradas para esta receta.</p>
          ${permissions.canManageRecipes ? '<button type="button" id="recipes-open-create-version-button">Nueva version borrador</button>' : ''}
        </div>
      `;
    }

    return `
      <div class="stack-section" data-recipes-tab-panel="versions">
        ${permissions.canManageRecipes ? '<div class="action-row compact-action-row"><button type="button" id="recipes-open-create-version-button">Nueva version borrador</button></div>' : ''}
        ${versions.map((version) => {
          const isDraft = version?.status !== 'APPROVED';
          return `
            <article class="products-entry-state">
              <div class="page-header">
                <div>
                  <h4>Version ${rootShellUi.escapeHtml(`v${version?.versionNumber || '?'}`)}</h4>
                  <p class="muted">${rootShellUi.escapeHtml(version?.status || 'Sin estado')} · Actualizada ${rootShellUi.escapeHtml(rootShellUi.formatDate(version?.updatedAt))}</p>
                </div>
                <div class="action-row compact-action-row">
                  <span class="badge ${isDraft ? 'badge-warning' : 'badge-success'}">${rootShellUi.escapeHtml(isDraft ? 'Borrador' : 'Aprobada')}</span>
                  ${permissions.canManageRecipes && isDraft ? `<button class="secondary-button" type="button" data-edit-recipe-version="${rootShellUi.escapeHtml(version?.id)}">Editar borrador</button>` : ''}
                  ${permissions.canApproveRecipes && isDraft ? `<button type="button" data-approve-recipe-version="${rootShellUi.escapeHtml(version?.id)}">Aprobar version</button>` : ''}
                </div>
              </div>
              <div class="detail-grid">
                <article class="detail-item"><span>Ingredientes</span><strong>${rootShellUi.escapeHtml(String((version?.ingredients || []).length))}</strong></article>
                <article class="detail-item"><span>Etapas</span><strong>${rootShellUi.escapeHtml(String((version?.stages || []).length))}</strong></article>
                <article class="detail-item"><span>Rendimiento esperado</span><strong>${rootShellUi.escapeHtml(version?.expectedYield ?? 'No definido')}</strong></article>
                <article class="detail-item"><span>Merma esperada</span><strong>${rootShellUi.escapeHtml(version?.expectedWaste ?? 'No definida')}</strong></article>
              </div>
              ${version?.notes ? `<article class="detail-item"><span>Notas</span><strong>${rootShellUi.escapeHtml(version.notes)}</strong></article>` : ''}
              <div class="action-row compact-action-row" style="margin-top:0.5rem">
                <button class="secondary-button" type="button"
                  data-view-stages="${rootShellUi.escapeHtml(String(version?.id || ''))}"
                  data-version-label="v${rootShellUi.escapeHtml(String(version?.versionNumber || '?'))}"
                  data-is-draft="${isDraft ? 'true' : 'false'}">
                  🔬 Ver / Editar etapas
                </button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderAssociatedProductsTab(associatedProducts, permissions) {
    return `
      <div class="stack-section" data-recipes-tab-panel="products">
        <article class="detail-item"><span>Nota del modelo</span><strong>Si no existe version visible por producto, se muestra como "No definida explicitamente" para evitar asumir un binding inexistente.</strong></article>
        ${permissions.canAssignRecipesToProducts ? '<div class="action-row compact-action-row"><button type="button" id="recipes-open-assignment-button">Asignar a producto</button></div>' : ''}
        ${associatedProducts.length ? `
          <div class="table-wrapper products-table-wrapper">
            <table class="products-admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Receta asignada</th>
                  <th>Version aplicable</th>
                </tr>
              </thead>
              <tbody>
                ${associatedProducts.map((product) => `
                  <tr>
                    <td data-label="Producto"><strong>${rootShellUi.escapeHtml(product?.name || 'Producto sin nombre')}</strong><br/><span>${rootShellUi.escapeHtml(product?.code || 'Sin codigo')}</span></td>
                    <td data-label="Receta asignada">${rootShellUi.escapeHtml(product?.recipe?.name || 'Asignada')}</td>
                    <td data-label="Version aplicable">${rootShellUi.escapeHtml(product?.appliedVersionLabel || 'No definida explicitamente')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="empty-state">No hay productos asociados a esta receta dentro de la carga visible.</p>'}
      </div>
    `;
  }

  function renderRecipeDetail(recipe, options = {}) {
    const detailState = options.detailState || 'idle';
    const activeTab = options.activeTab || 'summary';
    const versions = options.versions || [];
    const associatedProducts = options.associatedProducts || [];
    const permissions = options.permissions || {};

    if (detailState === 'loading') {
      return '<p class="empty-state">Cargando detalle de la receta...</p>';
    }

    if (detailState === 'error') {
      return renderState('No se pudo cargar el detalle de la receta', 'Intenta nuevamente seleccionando la receta desde el listado.');
    }

    if (!recipe) {
      return '<p class="empty-state">Selecciona una receta del listado para revisar su detalle administrativo.</p>';
    }

    return `
      <div class="stack-section">
        ${renderDetailHeader(recipe, associatedProducts.length)}
        ${renderTabs(activeTab)}
        <div ${activeTab === 'summary' ? '' : 'hidden'}>${renderSummaryTab(recipe)}</div>
        <div ${activeTab === 'versions' ? '' : 'hidden'}>${renderVersionsTab(versions, permissions)}</div>
        <div ${activeTab === 'products' ? '' : 'hidden'}>${renderAssociatedProductsTab(associatedProducts, permissions)}</div>
      </div>
    `;
  }

  function renderProductAssignmentOptions(products, selectedProductId = '') {
    return ['<option value="">Selecciona un producto</option>']
      .concat((products || []).map((product) => {
        const isSelected = String(product?.id) === String(selectedProductId);
        return `<option value="${rootShellUi.escapeHtml(String(product?.id))}" ${isSelected ? 'selected' : ''}>${rootShellUi.escapeHtml(`${product?.name || 'Producto'}${product?.code ? ` · ${product.code}` : ''}`)}</option>`;
      }))
      .join('');
  }

  function renderStagesModalContent(version) {
    const stages = version?.stages || [];
    if (!stages.length) {
      return '<p class="empty-state">Esta version no tiene etapas definidas.</p>';
    }

    return stages.map((stage, idx) => {
      const inputs = stage?.stageInputs || [];
      const params = stage?.expectedParameters || [];
      return `
        <details class="recipe-stage-detail" style="border:1px solid var(--border,#ddd);border-radius:8px;padding:0.75rem;margin-bottom:0.5rem" open="${idx === 0 ? 'true' : ''}">
          <summary style="cursor:pointer;font-weight:600;list-style:none;display:flex;gap:0.5rem;align-items:center">
            <span style="background:var(--color-primary-light,#e0e7ff);border-radius:50%;width:1.5rem;height:1.5rem;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem">${rootShellUi.escapeHtml(String(stage.stageOrder != null ? stage.stageOrder + 1 : idx + 1))}</span>
            ${rootShellUi.escapeHtml(stage.name || 'Sin nombre')}
            ${stage.qaMandatory ? '<span class="badge" style="font-size:0.7rem">QA obligatorio</span>' : ''}
          </summary>
          <div style="margin-top:0.75rem">
            ${stage.instructions ? `<p class="muted" style="margin-bottom:0.5rem">${rootShellUi.escapeHtml(stage.instructions)}</p>` : ''}
            <strong style="font-size:0.85rem">Insumos de esta etapa</strong>
            ${inputs.length ? `
              <table style="width:100%;border-collapse:collapse;margin-top:0.25rem;font-size:0.875rem">
                <thead><tr>
                  <th style="text-align:left;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Insumo</th>
                  <th style="text-align:left;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Producto</th>
                  <th style="text-align:right;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Cantidad</th>
                  <th style="text-align:left;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Unidad</th>
                </tr></thead>
                <tbody>
                  ${inputs.map((si) => `
                    <tr>
                      <td style="padding:0.25rem 0.5rem">${rootShellUi.escapeHtml(si.name || '—')}</td>
                      <td style="padding:0.25rem 0.5rem">${rootShellUi.escapeHtml(si.product?.name || si.product?.code || '—')}</td>
                      <td style="padding:0.25rem 0.5rem;text-align:right">${rootShellUi.escapeHtml(si.quantity != null ? String(si.quantity) : '—')}</td>
                      <td style="padding:0.25rem 0.5rem">${rootShellUi.escapeHtml(si.unit || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="muted" style="margin-top:0.25rem;font-size:0.85rem">Sin insumos definidos para esta etapa.</p>'}
            ${params.length ? `
              <strong style="font-size:0.85rem;display:block;margin-top:0.75rem">Parametros QA esperados</strong>
              <table style="width:100%;border-collapse:collapse;margin-top:0.25rem;font-size:0.875rem">
                <thead><tr>
                  <th style="text-align:left;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Parametro</th>
                  <th style="text-align:left;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Unidad</th>
                  <th style="text-align:right;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Valor esperado</th>
                  <th style="text-align:right;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Tol. min</th>
                  <th style="text-align:right;padding:0.25rem 0.5rem;border-bottom:1px solid var(--border,#ddd)">Tol. max</th>
                </tr></thead>
                <tbody>
                  ${params.map((p) => `
                    <tr>
                      <td style="padding:0.25rem 0.5rem">${rootShellUi.escapeHtml(p.name || '—')}</td>
                      <td style="padding:0.25rem 0.5rem">${rootShellUi.escapeHtml(p.unit || '—')}</td>
                      <td style="padding:0.25rem 0.5rem;text-align:right">${rootShellUi.escapeHtml(p.expectedValue != null ? String(p.expectedValue) : '—')}</td>
                      <td style="padding:0.25rem 0.5rem;text-align:right">${rootShellUi.escapeHtml(p.minTolerance != null ? String(p.minTolerance) : '—')}</td>
                      <td style="padding:0.25rem 0.5rem;text-align:right">${rootShellUi.escapeHtml(p.maxTolerance != null ? String(p.maxTolerance) : '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          </div>
        </details>
      `;
    }).join('');
  }

  rootShell.register('views.recipesAdminRenderers', {
    renderMetrics,
    renderProductAssignmentOptions,
    renderRecipeDetail,
    renderRecipeTypeOptions,
    renderRecipesList,
    renderStagesModalContent,
    renderState,
    renderWorkspace,
  });
}(window));
