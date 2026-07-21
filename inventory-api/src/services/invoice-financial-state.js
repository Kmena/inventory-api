const {
  ZERO_MONEY,
  sumMoney,
  subtractMoney,
  compareMoney,
  maxZeroMoney,
  toMoneyNumber,
} = require('../lib/money');

function getApprovedPayments(invoice) {
  return (invoice?.payments || [])
    .filter((payment) => payment?.status === 'APPROVED')
    .sort((left, right) => {
      const leftTime = new Date(left.approvedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.approvedAt || right.createdAt || 0).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return Number(left.id || 0n) - Number(right.id || 0n);
    });
}

function getAppliedAmountDecimal(invoice) {
  return sumMoney(getApprovedPayments(invoice).map((payment) => payment.amount));
}

function getAppliedAmount(invoice) {
  return toMoneyNumber(getAppliedAmountDecimal(invoice));
}

function getPendingAmountDecimal(invoice, appliedAmount = getAppliedAmountDecimal(invoice)) {
  return maxZeroMoney(subtractMoney(invoice?.amount || ZERO_MONEY, appliedAmount));
}

function getPendingAmount(invoice, appliedAmount = getAppliedAmountDecimal(invoice)) {
  return toMoneyNumber(getPendingAmountDecimal(invoice, appliedAmount));
}

function getPaidAtFromApprovedPayments(invoice) {
  const approvedPayments = getApprovedPayments(invoice);
  const invoiceAmount = invoice?.amount || ZERO_MONEY;

  if (compareMoney(invoiceAmount, ZERO_MONEY) <= 0) {
    return null;
  }

  let accumulatedAmount = ZERO_MONEY;
  for (const payment of approvedPayments) {
    accumulatedAmount = accumulatedAmount.plus(payment.amount || ZERO_MONEY);
    if (compareMoney(accumulatedAmount, invoiceAmount) >= 0) {
      return payment.approvedAt || null;
    }
  }

  return null;
}

function calculateDerivedInvoiceFinancialState(invoice) {
  const appliedAmountDecimal = getAppliedAmountDecimal(invoice);
  const pendingAmountDecimal = getPendingAmountDecimal(invoice, appliedAmountDecimal);
  const appliedAmount = toMoneyNumber(appliedAmountDecimal);
  const pendingAmount = toMoneyNumber(pendingAmountDecimal);

  if (invoice?.status === 'CANCELLED') {
    return {
      appliedAmount,
      pendingAmount,
      status: 'CANCELLED',
      paidAt: invoice.paidAt || null,
    };
  }

  if (compareMoney(appliedAmountDecimal, ZERO_MONEY) <= 0) {
    return {
      appliedAmount,
      pendingAmount,
      status: 'PENDING',
      paidAt: null,
    };
  }

  if (compareMoney(appliedAmountDecimal, invoice?.amount || ZERO_MONEY) < 0) {
    return {
      appliedAmount,
      pendingAmount,
      status: 'PARTIAL',
      paidAt: null,
    };
  }

  return {
    appliedAmount,
    pendingAmount,
    status: 'PAID',
    paidAt: getPaidAtFromApprovedPayments(invoice),
  };
}

module.exports = {
  getApprovedPayments,
  getAppliedAmountDecimal,
  getAppliedAmount,
  getPendingAmountDecimal,
  getPendingAmount,
  calculateDerivedInvoiceFinancialState,
};
