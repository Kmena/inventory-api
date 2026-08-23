(function attachRootShellProductionOrdersAdminState(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  const STATUS_LABELS = Object.freeze({
    DRAFT: 'Borrador',
    PENDING_APPROVAL: 'Pendiente de aprobación',
    APPROVED: 'Aprobada',
    IN_PROGRESS: 'En progreso',
    WAITING_QA: 'Esperando QA',
    QA_HOLD: 'QA Hold',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
  });

  function resolveSelectedOrderId(items, preferredOrderId = null) {
    if (!Array.isArray(items) || !items.length) {
      return null;
    }

    const preferredOrder = items.find((item) => String(item?.id) === String(preferredOrderId));
    return preferredOrder ? preferredOrder.id : items[0].id;
  }

  function resolveSelectedOrder(items, selectedOrderId) {
    return (items || []).find((item) => String(item?.id) === String(selectedOrderId)) || null;
  }

  function buildOrderMetrics(orders) {
    const items = orders || [];
    return {
      draftCount: items.filter((order) => order?.status === 'DRAFT').length,
      pendingApprovalCount: items.filter((order) => order?.status === 'PENDING_APPROVAL').length,
      approvedCount: items.filter((order) => order?.status === 'APPROVED').length,
      inProgressCount: items.filter((order) => order?.status === 'IN_PROGRESS').length,
      qaHoldCount: items.filter((order) => order?.status === 'QA_HOLD' || order?.status === 'WAITING_QA').length,
      completedCount: items.filter((order) => order?.status === 'COMPLETED').length,
    };
  }

  function buildSelectOptions(items, valueResolver, labelResolver) {
    const deduplicated = new Map();

    for (const item of items || []) {
      const value = valueResolver(item);
      const label = labelResolver(item);
      if (value === undefined || value === null || value === '' || !label) {
        continue;
      }
      if (!deduplicated.has(String(value))) {
        deduplicated.set(String(value), { value, label });
      }
    }

    return [...deduplicated.values()].sort((left, right) => String(left.label).localeCompare(String(right.label), 'es'));
  }

  function buildStatusOptions(orders) {
    return buildSelectOptions(orders, (order) => order?.status, (order) => STATUS_LABELS[order?.status] || order?.status || '');
  }

  function buildProductOptions(orders) {
    return buildSelectOptions(orders, (order) => order?.product?.id || order?.productId, (order) => order?.product?.name || '');
  }

  function buildRecipeOptions(orders) {
    return buildSelectOptions(orders, (order) => order?.recipe?.id || order?.recipeId, (order) => order?.recipe?.name || order?.recipeVersionSnapshot?.recipe?.name || '');
  }

  function buildVersionOptions(orders) {
    return buildSelectOptions(orders, (order) => order?.recipeVersion?.id || order?.recipeVersionId, (order) => resolveVersionLabel(order));
  }

  function buildResponsibleOptions(orders) {
    return buildSelectOptions(orders, (order) => order?.responsibleUser?.id || order?.responsibleUserId, (order) => resolveResponsibleLabel(order));
  }

  function resolveVersionLabel(order) {
    const versionNumber = order?.recipeVersion?.versionNumber
      || order?.recipeVersionSnapshot?.recipeVersion?.versionNumber
      || null;
    return versionNumber ? `v${versionNumber}` : 'No visible';
  }

  function resolveResponsibleLabel(order) {
    return order?.responsibleUser?.fullName || order?.responsibleUser?.username || order?.responsible || 'Sin responsable visible';
  }

  function renderStatusBadge(order, rootShellUi) {
    const status = order?.status;
    const label = STATUS_LABELS[status] || status || 'Sin estado';
    const isPositive = status === 'APPROVED' || status === 'COMPLETED';
    const isWarning = status === 'DRAFT' || status === 'PENDING_APPROVAL' || status === 'WAITING_QA' || status === 'QA_HOLD' || status === 'IN_PROGRESS';
    const className = isPositive ? 'badge badge-success' : isWarning ? 'badge badge-warning' : 'badge';
    return `<span class="${className}">${rootShellUi.escapeHtml(label)}</span>`;
  }

  rootShell.register('views.productionOrdersAdminState', {
    buildOrderMetrics,
    buildProductOptions,
    buildRecipeOptions,
    buildResponsibleOptions,
    buildStatusOptions,
    buildVersionOptions,
    renderStatusBadge,
    resolveSelectedOrder,
    resolveSelectedOrderId,
    resolveResponsibleLabel,
    resolveVersionLabel,
  });
}(window));
