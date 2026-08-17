(function attachRootShellQuotationsAdminHelpers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function escapeHtml(value) {
    return rootShellUi.escapeHtml(value);
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function compareQuotableProducts(leftProduct, rightProduct) {
    const leftShortage = Number(leftProduct?.shortage || 0);
    const rightShortage = Number(rightProduct?.shortage || 0);
    if (rightShortage !== leftShortage) {
      return rightShortage - leftShortage;
    }

    const leftQuantity = Number(leftProduct?.quantity || 0);
    const rightQuantity = Number(rightProduct?.quantity || 0);
    if (leftQuantity !== rightQuantity) {
      return leftQuantity - rightQuantity;
    }

    return String(leftProduct?.name || '').localeCompare(String(rightProduct?.name || ''), 'es');
  }

  function sortQuotableProducts(products) {
    return [...(Array.isArray(products) ? products : [])].sort(compareQuotableProducts);
  }

  function filterQuotableProducts(products, searchText) {
    const orderedProducts = sortQuotableProducts(products);
    const term = normalizeSearchText(searchText);
    if (!term) {
      return orderedProducts;
    }

    return orderedProducts.filter((product) => {
      const haystack = [product?.name, product?.sku]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ');
      return haystack.includes(term);
    });
  }

  function buildQuotationsMetrics(products, selectionByProductId) {
    const normalizedProducts = Array.isArray(products) ? products : [];
    const selections = selectionByProductId || new Map();
    const total = normalizedProducts.length;
    const withShortage = normalizedProducts.filter((product) => Number(product?.shortage || 0) > 0).length;
    const selectedProducts = normalizedProducts.filter((product) => hasReadySelectionForProduct(product?.id, selections)).length;

    return {
      total,
      withShortage,
      selectedProducts,
    };
  }

  function getSelectionForProduct(productId, selectionByProductId) {
    if (!selectionByProductId) {
      return null;
    }

    return selectionByProductId.get(String(productId)) || null;
  }

  function buildProductSelectionDraft(product, pricingDetail, existingSelection) {
    const shortage = Number(product?.shortage || pricingDetail?.shortage || 0);
    const fallbackQuantity = shortage > 0 ? shortage : Math.max(Number(product?.minStock || 0), 1);
    return {
      productId: product?.id ?? pricingDetail?.productId ?? null,
      productName: product?.name || pricingDetail?.productName || 'Producto',
      quantity: existingSelection?.quantity ?? fallbackQuantity,
      notes: existingSelection?.notes ?? '',
      selectedSuppliers: Array.isArray(existingSelection?.selectedSuppliers) ? existingSelection.selectedSuppliers.map((supplier) => ({ ...supplier })) : [],
    };
  }

  function toggleSupplierSelection(selectionDraft, supplier, isSelected) {
    const selectedSuppliers = Array.isArray(selectionDraft?.selectedSuppliers) ? [...selectionDraft.selectedSuppliers] : [];
    const supplierId = String(supplier?.supplierId);
    const existingIndex = selectedSuppliers.findIndex((entry) => String(entry?.supplierId) === supplierId);

    if (isSelected) {
      const nextEntry = {
        supplierId: supplier?.supplierId,
        unitPrice: supplier?.unitPrice,
        currency: supplier?.currency || 'CRC',
        leadTimeDays: supplier?.leadTimeDays ?? null,
        availabilityNotes: supplier?.notes || null,
        notes: supplier?.notes || null,
      };

      if (existingIndex >= 0) {
        selectedSuppliers.splice(existingIndex, 1, nextEntry);
      } else {
        selectedSuppliers.push(nextEntry);
      }
    } else if (existingIndex >= 0) {
      selectedSuppliers.splice(existingIndex, 1);
    }

    return {
      ...selectionDraft,
      selectedSuppliers,
    };
  }

  function hasReadySelectionForProduct(productId, selectionByProductId) {
    const selection = getSelectionForProduct(productId, selectionByProductId);
    return Boolean(selection && Number(selection.quantity) > 0 && Array.isArray(selection.selectedSuppliers) && selection.selectedSuppliers.length > 0);
  }

  function buildSelectionSummary(products, selectionByProductId) {
    return (Array.isArray(products) ? products : [])
      .filter((product) => hasReadySelectionForProduct(product?.id, selectionByProductId))
      .map((product) => {
        const selection = getSelectionForProduct(product.id, selectionByProductId);
        return {
          productId: product.id,
          productName: product.name,
          supplierCount: selection.selectedSuppliers.length,
          quantity: Number(selection.quantity),
        };
      });
  }

  function canGenerateGroupedQuotation(products, selectionByProductId) {
    return buildSelectionSummary(products, selectionByProductId).length > 0;
  }

  function buildGroupedQuotationPayload(products, selectionByProductId) {
    const selectedProducts = (Array.isArray(products) ? products : [])
      .filter((product) => hasReadySelectionForProduct(product?.id, selectionByProductId))
      .map((product) => {
        const selection = getSelectionForProduct(product.id, selectionByProductId);
        return {
          productId: product.id,
          quantity: Number(selection.quantity),
          notes: selection.notes ? String(selection.notes).trim() : null,
          suppliers: selection.selectedSuppliers.map((supplier) => ({
            supplierId: supplier.supplierId,
            unitPrice: Number(supplier.unitPrice),
            currency: supplier.currency || 'CRC',
            leadTimeDays: supplier.leadTimeDays ?? null,
            availabilityNotes: supplier.availabilityNotes || null,
            notes: supplier.notes || null,
          })),
        };
      });

    return {
      title: `Cotización agrupada (${selectedProducts.length} producto(s))`,
      notes: null,
      products: selectedProducts,
    };
  }

  function formatQuantity(value) {
    const quantity = Number(value || 0);
    if (!Number.isFinite(quantity)) {
      return '0';
    }

    return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
  }

  function formatCurrency(amount, currency = 'CRC') {
    const value = Number(amount || 0);
    if (!Number.isFinite(value)) {
      return '—';
    }

    try {
      return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: currency || 'CRC',
        minimumFractionDigits: 2,
      }).format(value);
    } catch (_error) {
      return `${currency || 'CRC'} ${value.toFixed(2)}`;
    }
  }

  const RFQ_STATUS_MAP = {
    PENDING:   { label: 'Pendiente',  badgeClass: 'badge' },
    PREPARED:  { label: 'Preparada',  badgeClass: 'badge badge-info' },
    RESPONDED: { label: 'Respondida', badgeClass: 'badge badge-success' },
    EXPIRED:   { label: 'Expirada',   badgeClass: 'badge badge-warning' },
    CANCELLED: { label: 'Cancelada',  badgeClass: 'badge badge-danger' },
  };

  function mapInvitationStatusLabel(status) {
    return RFQ_STATUS_MAP[status] || { label: status || 'Desconocido', badgeClass: 'badge' };
  }

  function buildRfqStatusCounts(invitations) {
    const counts = { prepared: 0, responded: 0, expired: 0, cancelled: 0, pending: 0 };
    for (const inv of (invitations || [])) {
      const key = (inv.status || '').toLowerCase();
      if (key in counts) counts[key]++;
    }
    return counts;
  }

  function getAvailableActionsForStatus(status, canManageFlag) {
    if (!canManageFlag) return { canCopyMachote: false, canRefresh: false, canCancel: false, canManualResponse: false };
    switch (status) {
      case 'PREPARED': return { canCopyMachote: true, canRefresh: true, canCancel: true, canManualResponse: true };
      case 'PENDING':  return { canCopyMachote: false, canRefresh: false, canCancel: true, canManualResponse: false };
      case 'EXPIRED':  return { canCopyMachote: false, canRefresh: false, canCancel: false, canManualResponse: false };
      case 'RESPONDED': return { canCopyMachote: false, canRefresh: false, canCancel: false, canManualResponse: false };
      case 'CANCELLED': return { canCopyMachote: false, canRefresh: false, canCancel: false, canManualResponse: false };
      default: return { canCopyMachote: false, canRefresh: false, canCancel: false, canManualResponse: false };
    }
  }

  function buildTrackingMetrics(trackingRequests) {
    const requests = Array.isArray(trackingRequests) ? trackingRequests : [];
    return {
      openRequests: requests.length,
      requestsWithResponses: requests.filter((request) => Number(request?.respondedInvitationCount || 0) > 0).length,
    };
  }

  function findTrackingRequestById(trackingRequests, purchaseRequestId) {
    return (Array.isArray(trackingRequests) ? trackingRequests : []).find((request) => String(request?.purchaseRequestId) === String(purchaseRequestId)) || null;
  }

  function buildResponseDetailGroups(activeRequest) {
    const quotations = (Array.isArray(activeRequest?.quotations) ? activeRequest.quotations : [])
      .filter((q) => q?.responseSource != null);
    return quotations.map((quotation) => ({
      supplierName: quotation?.supplierName || 'Proveedor',
      supplierEmail: quotation?.supplierEmail || null,
      responseSource: quotation?.responseSource || null,
      status: quotation?.status || null,
      currency: quotation?.currency || 'CRC',
      submittedAt: quotation?.submittedAt || null,
      notes: quotation?.notes || null,
      totalAmount: Number(quotation?.totalAmount || 0),
      items: Array.isArray(quotation?.items) ? quotation.items : [],
    }));
  }

  function buildActiveRequestResponseSummary(activeRequest) {
    const request = activeRequest || {};
    const quotations = Array.isArray(request.quotations) ? request.quotations : [];
    const responseGroups = buildResponseDetailGroups(request);
    const quotedProducts = new Set();
    for (const quotation of quotations) {
      for (const item of (quotation.items || [])) {
        quotedProducts.add(String(item.productId));
      }
    }

    return {
      invitationCount: Number(request.invitations?.length || 0),
      respondedInvitationCount: Number(request.respondedInvitationCount || 0),
      manualResponseCount: Number(request.manualResponseCount || 0),
      publicResponseCount: Number(request.publicResponseCount || 0),
      supplierResponseCount: responseGroups.length,
      quotedProductCount: quotedProducts.size,
      responseGroups,
    };
  }

  function buildManualResponsePayload(formData, purchaseRequestItems) {
    const items = (purchaseRequestItems || []).map((item) => {
      const row = formData.items?.find((fi) => String(fi.productId) === String(item.productId));
      return {
        productId: item.productId,
        quantity: Number(row?.quantity || item.quantity || 0),
        unitPrice: Number(row?.unitPrice || 0),
        leadTimeDays: row?.leadTimeDays != null && row.leadTimeDays !== '' ? Number(row.leadTimeDays) : null,
        notes: row?.notes || null,
      };
    }).filter((item) => item.unitPrice > 0 && item.quantity > 0);

    return {
      currency: formData.currency || 'CRC',
      notes: formData.notes || null,
      items,
    };
  }

  function validateManualResponseForm(formData) {
    const errors = [];
    if (!Array.isArray(formData?.items) || !formData.items.length) {
      errors.push('Debes ingresar al menos un producto con precio.');
      return { valid: false, errors };
    }
    for (const item of formData.items) {
      if (!(Number(item.unitPrice) > 0)) {
        errors.push(`El precio unitario debe ser positivo para cada producto.`);
        break;
      }
      if (!(Number(item.quantity) > 0)) {
        errors.push('La cantidad debe ser positiva para cada producto.');
        break;
      }
    }
    return { valid: errors.length === 0, errors };
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_e) {
      return String(dateStr);
    }
  }

  rootShell.register('views.quotationsAdminHelpers', {
    buildGroupedQuotationPayload,
    buildManualResponsePayload,
    buildProductSelectionDraft,
    buildQuotationsMetrics,
    buildRfqStatusCounts,
    buildSelectionSummary,
    canGenerateGroupedQuotation,
    compareQuotableProducts,
    escapeHtml,
    filterQuotableProducts,
    formatCurrency,
    formatDate,
    formatQuantity,
    buildActiveRequestResponseSummary,
    buildResponseDetailGroups,
    buildTrackingMetrics,
    findTrackingRequestById,
    getAvailableActionsForStatus,
    getSelectionForProduct,
    hasReadySelectionForProduct,
    mapInvitationStatusLabel,
    normalizeSearchText,
    RFQ_STATUS_MAP,
    sortQuotableProducts,
    toggleSupplierSelection,
    validateManualResponseForm,
  });
}(window));
