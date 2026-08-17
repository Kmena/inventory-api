(function attachRootShellRecipesAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const recipesState = rootShell.require('views.recipesAdminState');

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

  rootShell.register('views.recipesAdminRenderers', {
    renderMetrics,
    renderProductAssignmentOptions,
    renderRecipeDetail,
    renderRecipeTypeOptions,
    renderRecipesList,
    renderState,
  });
}(window));
