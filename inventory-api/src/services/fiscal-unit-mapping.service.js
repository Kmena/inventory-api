'use strict';

const UNIT_MAPPING = Object.freeze({
  UN: 'Unid',
  KG: 'Kg',
  G: 'G',
  L: 'L',
  ML: 'mL',
  M: 'M',
});

function mapInventoriUnitToBillingUnit(unit, product = {}) {
  if (product?.productNature === 'SERVICE' || product?.controlsInventory === false) {
    return 'Sp';
  }

  const normalizedUnit = String(unit || '').trim();
  if (!normalizedUnit) {
    return null;
  }

  return UNIT_MAPPING[normalizedUnit.toUpperCase()] || null;
}

module.exports = {
  mapInventoriUnitToBillingUnit,
  UNIT_MAPPING,
};
