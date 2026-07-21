const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLotDates,
  deriveLotUsability,
  lotDateKey,
} = require('../src/services/inventory-lot-policy.service');

test('normalizeLotDates accepts ISO datetimes and preserves the business calendar date', () => {
  const normalized = normalizeLotDates({
    productionDate: '2026-01-10T14:00:00.000Z',
    expirationDate: '2026-03-10T14:00:00.000Z',
    entryDate: '2026-01-12T09:15:00.000Z',
  });

  assert.equal(lotDateKey(normalized.productionDate), '2026-01-10');
  assert.equal(lotDateKey(normalized.expirationDate), '2026-03-10');
  assert.equal(lotDateKey(normalized.entryDate), '2026-01-12');
});

test('deriveLotUsability marks expired or blocked lots as non-sellable', () => {
  const blocked = deriveLotUsability({
    expirationDate: '2026-03-10',
    status: 'BLOCKED',
    qaStatus: 'APPROVED',
  }, new Date('2026-01-01T00:00:00Z'));

  const expired = deriveLotUsability({
    expirationDate: '2025-01-01',
    status: 'AVAILABLE',
    qaStatus: 'APPROVED',
  }, new Date('2026-01-01T00:00:00Z'));

  assert.equal(blocked.sellable, false);
  assert.equal(expired.expired, true);
  assert.equal(expired.sellable, false);
});
