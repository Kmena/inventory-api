const {
  ZERO_MONEY,
  sumMoney,
  subtractMoney,
  compareMoney,
  maxZeroMoney,
  toMoneyNumber,
} = require('../lib/money');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const INVOICE_PENDING_DAYS = 30;
const STATUS_PRIORITY = {
  VENCIDA: 0,
  PROXIMA_A_VENCER: 1,
  NUEVA: 2,
  AL_DIA: 3,
};

function daysBetween(startDate, endDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS));
}

function normalizeRouteForStore(store, assignedRoutes) {
  const candidateMappings = store.subregion?.salesRoutes || [];
  const directMatch = candidateMappings.find((mapping) => assignedRoutes.some((route) => route.id === mapping.salesRouteId));
  return directMatch?.salesRoute || assignedRoutes[0] || null;
}

function computeVisitState(store, route) {
  const latestVisit = (store.routeVisitLogs || [])[0] || null;
  const referenceDate = latestVisit?.visitedAt || store.createdAt;
  const daysSinceReference = referenceDate ? daysBetween(referenceDate) : 0;
  const frequency = Number(route?.visitFrequencyDays || 15);
  const nearLimit = Number(route?.nearLimitDays || 3);
  const dueInDays = frequency - daysSinceReference;
  const hasVisits = Boolean(latestVisit);

  let status = 'AL_DIA';
  if (!hasVisits) {
    status = 'NUEVA';
  } else if (daysSinceReference >= frequency) {
    status = 'VENCIDA';
  } else if (daysSinceReference >= Math.max(0, frequency - nearLimit)) {
    status = 'PROXIMA_A_VENCER';
  }

  return {
    latestVisit,
    status,
    daysSinceReference,
    dueInDays,
    isNearLimit: status === 'PROXIMA_A_VENCER' || (!hasVisits && dueInDays <= nearLimit),
    referenceDate,
  };
}

function isSameId(left, right) {
  return left !== null && left !== undefined && right !== null && right !== undefined && left.toString() === right.toString();
}

function hasReliableInvoiceAssignment(invoice, order, store) {
  return Boolean(
    order
      && order.clientStoreId
      && order.clientStore
      && isSameId(order.clientStoreId, store.id)
      && (!order.clientId || isSameId(order.clientId, store.clientId))
      && (order.clientStore.clientId === null || order.clientStore.clientId === undefined || isSameId(order.clientStore.clientId, store.clientId))
      && isSameId(invoice.clientId, store.clientId),
  );
}

function hasReliablePaymentApplication(invoice) {
  return (invoice.payments || []).every((payment) => isSameId(payment.invoiceId, invoice.id));
}

function shouldExposeInvoiceToAgent(invoice, order, store) {
  if (invoice.status === 'CANCELLED') {
    return false;
  }

  return hasReliableInvoiceAssignment(invoice, order, store) && hasReliablePaymentApplication(invoice);
}

function getAppliedAmountDecimal(invoice) {
  return sumMoney((invoice.payments || []).map((payment) => payment.amount));
}

function getPendingAmountDecimal(invoice, appliedAmount = getAppliedAmountDecimal(invoice)) {
  return maxZeroMoney(subtractMoney(invoice.amount || ZERO_MONEY, appliedAmount));
}

function hasVerifiedAppliedPaymentWithinWindow(invoice) {
  const cutoff = new Date(invoice.issuedAt).getTime() + (INVOICE_PENDING_DAYS * DAY_IN_MS);
  return (invoice.payments || []).some((payment) => compareMoney(payment.amount || ZERO_MONEY, ZERO_MONEY) > 0 && new Date(payment.createdAt).getTime() <= cutoff);
}

function getAgentInvoiceStatus(invoice, appliedAmount, pendingAmount) {
  if (compareMoney(pendingAmount, ZERO_MONEY) <= 0) {
    return 'PAGADA';
  }

  const daysSinceIssue = daysBetween(invoice.issuedAt);
  if (daysSinceIssue > INVOICE_PENDING_DAYS) {
    return 'VENCIDA';
  }

  if (compareMoney(appliedAmount, ZERO_MONEY) > 0 && hasVerifiedAppliedPaymentWithinWindow(invoice)) {
    return 'PARCIAL';
  }

  return 'PENDIENTE';
}

function serializeInvoiceDebt(invoice, order, store) {
  if (!shouldExposeInvoiceToAgent(invoice, order, store)) {
    return null;
  }

  const appliedAmountDecimal = getAppliedAmountDecimal(invoice);
  const pendingAmountDecimal = getPendingAmountDecimal(invoice, appliedAmountDecimal);
  const appliedAmount = toMoneyNumber(appliedAmountDecimal);
  const pendingAmount = toMoneyNumber(pendingAmountDecimal);

  return {
    id: invoice.id,
    orderId: order.id,
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    originalAmount: toMoneyNumber(invoice.amount || ZERO_MONEY),
    appliedAmount,
    pendingAmount,
    status: getAgentInvoiceStatus(invoice, appliedAmountDecimal, pendingAmountDecimal),
  };
}

function summarizeStoreInvoices(store) {
  const summary = {
    visiblePendingBalance: ZERO_MONEY,
  };

  for (const order of store.orders || []) {
    for (const invoice of order.invoices || []) {
      const appliedAmount = getAppliedAmountDecimal(invoice);
      const pendingAmount = getPendingAmountDecimal(invoice, appliedAmount);
      const visibleToAgent = shouldExposeInvoiceToAgent(invoice, order, store);

      if (visibleToAgent) {
        summary.visiblePendingBalance = summary.visiblePendingBalance.plus(pendingAmount);
      }
    }
  }

  return {
    visiblePendingBalance: toMoneyNumber(summary.visiblePendingBalance),
  };
}

function serializeRepresentative(representative) {
  return {
    id: representative.id,
    fullName: representative.fullName,
    position: representative.position,
    role: representative.role,
    email: representative.email,
    phonePrimary: representative.phonePrimary,
    phoneSecondary: representative.phoneSecondary,
    comment: representative.comment,
    isPrimaryContact: representative.isPrimaryContact,
  };
}

function serializeVisit(visit) {
  return {
    id: visit.id,
    salesRouteId: visit.salesRouteId,
    salesRouteCode: visit.salesRoute?.code || null,
    salesRouteName: visit.salesRoute?.name || null,
    subregionId: visit.subregionId,
    subregionName: visit.subregion?.name || null,
    regionName: visit.subregion?.region?.name || null,
    clientId: visit.clientId,
    clientName: visit.client?.name || null,
    clientStoreId: visit.clientStoreId,
    clientStoreName: visit.clientStore?.name || null,
    userId: visit.userId,
    userName: visit.user?.fullName || null,
    motive: visit.motive,
    result: visit.result,
    comment: visit.comment,
    suggestedNextVisitAt: visit.suggestedNextVisitAt,
    visitedAt: visit.visitedAt,
  };
}

function serializeStoreCard(store, route) {
  const state = computeVisitState(store, route);
  const latestVisitComment = state.latestVisit?.comment || null;
  const invoiceSummary = summarizeStoreInvoices(store);

  return {
    id: store.id,
    clientId: store.clientId,
    clientName: store.client?.name || null,
    legalEntityName: store.legalEntity?.legalName || store.client?.legalEntity?.legalName || null,
    code: store.code,
    name: store.name,
    phone: store.phone,
    address: store.address,
    locationReference: store.locationReference,
    latitude: store.latitude === null || store.latitude === undefined ? null : Number(store.latitude),
    longitude: store.longitude === null || store.longitude === undefined ? null : Number(store.longitude),
    routeId: route?.id || null,
    routeCode: route?.code || null,
    routeName: route?.name || null,
    visitFrequencyDays: route?.visitFrequencyDays || 15,
    nearLimitDays: route?.nearLimitDays || 3,
    regionName: store.subregion?.region?.name || null,
    subregionName: store.subregion?.name || null,
    representativesCount: store.representatives?.length || 0,
    latestVisitAt: state.latestVisit?.visitedAt || null,
    latestVisitComment,
    status: state.status,
    daysSinceReference: state.daysSinceReference,
    dueInDays: state.dueInDays,
    isNearLimit: state.isNearLimit,
    pendingBalance: invoiceSummary.visiblePendingBalance,
    isNew: state.status === 'NUEVA',
  };
}

function sortStores(stores) {
  return [...stores].sort((left, right) => {
    const leftPriority = STATUS_PRIORITY[left.status] ?? 99;
    const rightPriority = STATUS_PRIORITY[right.status] ?? 99;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    if (left.daysSinceReference !== right.daysSinceReference) {
      return right.daysSinceReference - left.daysSinceReference;
    }
    return `${left.name}`.localeCompare(`${right.name}`, 'es');
  });
}

function serializePurchaseHistory(store) {
  const storeSummary = summarizeStoreInvoices(store);
  const history = (store.orders || []).map((order) => {
    const invoices = (order.invoices || [])
      .map((invoice) => serializeInvoiceDebt(invoice, order, store))
      .filter(Boolean);

    const pendingBalance = sumMoney(invoices.map((invoice) => invoice.pendingAmount));

    return {
      orderId: order.id,
      createdAt: order.createdAt,
      status: order.status,
      total: Number(order.total || 0),
      pendingBalance: toMoneyNumber(pendingBalance),
      invoiceNumbers: invoices.map((invoice) => invoice.number),
      invoices,
      items: (order.items || []).map((item) => ({
        productId: item.productId,
        productName: item.product?.name || null,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      })),
    };
  });

  return {
    pendingBalance: storeSummary.visiblePendingBalance,
    orders: history,
  };
}

module.exports = {
  normalizeRouteForStore,
  serializeRepresentative,
  serializeVisit,
  serializeStoreCard,
  sortStores,
  serializePurchaseHistory,
};
