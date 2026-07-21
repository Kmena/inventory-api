const { Prisma } = require('@prisma/client');

const MONEY_SCALE = 2;
const ZERO_MONEY = new Prisma.Decimal(0);

function normalizeDecimalInput(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
}

function toDecimal(value) {
  const normalizedValue = normalizeDecimalInput(value);

  if (Prisma.Decimal.isDecimal(normalizedValue)) {
    return normalizedValue;
  }

  try {
    return new Prisma.Decimal(normalizedValue);
  } catch (_error) {
    throw new TypeError(`Invalid monetary value: ${String(value)}`);
  }
}

function roundMoney(value) {
  return toDecimal(value).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

function sumMoney(values) {
  return values.reduce((total, value) => total.plus(toDecimal(value)), ZERO_MONEY);
}

function addMoney(left, right) {
  return toDecimal(left).plus(toDecimal(right));
}

function subtractMoney(minuend, subtrahend) {
  return toDecimal(minuend).minus(toDecimal(subtrahend));
}

function compareMoney(left, right) {
  return roundMoney(left).comparedTo(roundMoney(right));
}

function maxZeroMoney(value) {
  return compareMoney(value, ZERO_MONEY) < 0 ? ZERO_MONEY : roundMoney(value);
}

function toMoneyNumber(value) {
  return Number(roundMoney(value).toFixed(MONEY_SCALE));
}

module.exports = {
  ZERO_MONEY,
  toDecimal,
  roundMoney,
  sumMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  maxZeroMoney,
  toMoneyNumber,
};
