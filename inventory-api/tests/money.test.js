const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getAppliedAmountDecimal,
  getAppliedAmount,
  getPendingAmountDecimal,
  getPendingAmount,
  calculateDerivedInvoiceFinancialState,
} = require('../src/services/invoice-financial-state');
const {
  sumMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  toMoneyNumber,
} = require('../src/lib/money');

test('money utility preserves exact two-decimal arithmetic for derived values', () => {
  assert.equal(toMoneyNumber(sumMoney([0.1, 0.2])), 0.3);
  assert.equal(toMoneyNumber(addMoney(0.1, 0.2)), 0.3);
  assert.equal(toMoneyNumber(subtractMoney(0.3, 0.1)), 0.2);
  assert.equal(compareMoney(0.3, 0.1 + 0.2), 0);
});

test('invoice financial state uses decimal-safe approved payment accumulation', () => {
  const invoice = {
    amount: 0.3,
    status: 'PENDING',
    paidAt: null,
    payments: [
      {
        id: 1n,
        amount: 0.1,
        status: 'APPROVED',
        approvedAt: new Date('2026-07-21T10:00:00.000Z'),
        createdAt: new Date('2026-07-21T10:00:00.000Z'),
      },
      {
        id: 2n,
        amount: 0.2,
        status: 'APPROVED',
        approvedAt: new Date('2026-07-21T11:00:00.000Z'),
        createdAt: new Date('2026-07-21T11:00:00.000Z'),
      },
      {
        id: 3n,
        amount: 9.99,
        status: 'PENDING_APPROVAL',
        approvedAt: null,
        createdAt: new Date('2026-07-21T12:00:00.000Z'),
      },
    ],
  };

  assert.equal(getAppliedAmountDecimal(invoice).toString(), '0.3');
  assert.equal(getPendingAmountDecimal(invoice).toString(), '0');
  assert.equal(getAppliedAmount(invoice), 0.3);
  assert.equal(getPendingAmount(invoice), 0);

  const derivedState = calculateDerivedInvoiceFinancialState(invoice);
  assert.equal(derivedState.status, 'PAID');
  assert.equal(derivedState.pendingAmount, 0);
  assert.equal(derivedState.appliedAmount, 0.3);
  assert.equal(derivedState.paidAt.toISOString(), '2026-07-21T11:00:00.000Z');
});
