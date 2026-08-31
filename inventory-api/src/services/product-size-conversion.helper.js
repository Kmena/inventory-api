/**
 * Canonical kg-conversion helper for production planning.
 *
 * Derives the physical mass (kg) for one commercial unit of a product and for
 * a complete production-order quantity.  Covers the three supported conversion
 * methods:
 *
 *   VOLUME  — netContent (ML or L) × density (kg/L)
 *   MASS    — netContent (G or KG) converted directly to KG
 *   LENGTH  — netContent (M) × kgConversionFactor (kg/m)
 *   COUNT   — kgConversionFactor (kg/unit), used when the product is managed
 *             by piece but the recipe is expressed in kg
 *
 * Products without an explicit presentationType fall back to the legacy
 * kgConversionFactor field (backward-compatible path).
 *
 * All public functions are pure — they do not call the database.
 * Callers should throw the returned errors or handle them at the service boundary.
 */

'use strict';

const { createHttpError } = require('../lib/errors');

const ML_TO_L = 0.001;
const G_TO_KG = 0.001;

const VOLUME_UNITS = ['ML', 'L'];
const MASS_UNITS = ['G', 'KG'];

/**
 * Derives kilograms per one commercial unit of `product`.
 *
 * @param {object} product
 * @param {string|null|undefined} product.presentationType
 * @param {number|null|undefined} product.netContent       Numeric content per unit (L, ML, G, KG, M).
 * @param {string|null|undefined} product.netContentUnit
 * @param {number|null|undefined} product.density          kg/L — required when presentationType is VOLUME.
 * @param {number|null|undefined} product.kgConversionFactor  kg/m (LENGTH) or kg/unit (COUNT / fallback).
 * @returns {{ kgPerUnit: number, conversionDetail: object }}
 * @throws HTTP 422 when required conversion data is missing or invalid.
 */
function deriveKgPerUnit(product) {
  const { presentationType, netContent, netContentUnit, density, kgConversionFactor } = product;

  if (!presentationType) {
    // Backward-compatible path: use kgConversionFactor or default to 1.
    const factor = Number(kgConversionFactor ?? 1);
    return {
      kgPerUnit: factor,
      conversionDetail: {
        method: 'kg_conversion_factor_fallback',
        kgConversionFactor: factor,
      },
    };
  }

  if (presentationType === 'VOLUME') {
    if (!netContent || Number(netContent) <= 0) {
      throw createHttpError(
        422,
        'El producto volumétrico requiere contenido neto positivo',
        'invalid_conversion_data',
      );
    }
    if (!netContentUnit || !VOLUME_UNITS.includes(netContentUnit)) {
      throw createHttpError(
        422,
        'El producto volumétrico requiere unidad ML o L',
        'invalid_conversion_data',
      );
    }
    if (!density || Number(density) <= 0) {
      throw createHttpError(
        422,
        'El producto volumétrico requiere densidad positiva (kg/L)',
        'invalid_conversion_data',
      );
    }

    const contentInLiters = netContentUnit === 'ML'
      ? Number(netContent) * ML_TO_L
      : Number(netContent);
    const densityKgPerL = Number(density);
    const kgPerUnit = contentInLiters * densityKgPerL;

    return {
      kgPerUnit,
      conversionDetail: {
        method: 'volume_density',
        netContent: Number(netContent),
        netContentUnit,
        contentInLiters,
        densityKgPerL,
        kgPerUnit,
      },
    };
  }

  if (presentationType === 'MASS') {
    if (!netContent || Number(netContent) <= 0) {
      throw createHttpError(
        422,
        'El producto másico requiere contenido neto positivo',
        'invalid_conversion_data',
      );
    }
    if (!netContentUnit || !MASS_UNITS.includes(netContentUnit)) {
      throw createHttpError(
        422,
        'El producto másico requiere unidad G o KG',
        'invalid_conversion_data',
      );
    }

    const kgPerUnit = netContentUnit === 'G'
      ? Number(netContent) * G_TO_KG
      : Number(netContent);

    return {
      kgPerUnit,
      conversionDetail: {
        method: 'mass_direct',
        netContent: Number(netContent),
        netContentUnit,
        kgPerUnit,
      },
    };
  }

  if (presentationType === 'LENGTH') {
    if (!netContent || Number(netContent) <= 0) {
      throw createHttpError(
        422,
        'El producto lineal requiere contenido neto positivo (metros por unidad)',
        'invalid_conversion_data',
      );
    }
    if (netContentUnit !== 'M') {
      throw createHttpError(
        422,
        'El producto lineal requiere unidad M',
        'invalid_conversion_data',
      );
    }
    if (!kgConversionFactor || Number(kgConversionFactor) <= 0) {
      throw createHttpError(
        422,
        'El producto lineal requiere factor de conversión kg/m positivo',
        'invalid_conversion_data',
      );
    }

    const metersPerUnit = Number(netContent);
    const kgPerMeter = Number(kgConversionFactor);
    const kgPerUnit = metersPerUnit * kgPerMeter;

    return {
      kgPerUnit,
      conversionDetail: {
        method: 'length_kg_per_meter',
        netContent: Number(netContent),
        netContentUnit,
        metersPerUnit,
        kgPerMeter,
        kgPerUnit,
      },
    };
  }

  if (presentationType === 'COUNT') {
    // COUNT uses kgConversionFactor as the weight-per-unit value.
    // Defaults to 1 if not set (unit-less fallback; service layer validates when recipe is kg-based).
    const kgPerUnit = Number(kgConversionFactor ?? 1);
    return {
      kgPerUnit,
      conversionDetail: {
        method: 'count_kg_per_unit',
        kgConversionFactor: kgPerUnit,
        kgPerUnit,
      },
    };
  }

  throw createHttpError(
    422,
    `Tipo de presentación desconocido: ${presentationType}`,
    'invalid_conversion_data',
  );
}

/**
 * Derives the total kilograms to produce for `orderQuantity` commercial units.
 *
 * @param {object} product  Product record from the DB (must contain conversion fields).
 * @param {number} orderQuantity  Number of commercial units ordered.
 * @returns {{ plannedOutputKg: number, kgPerUnit: number, conversionDetail: object }}
 */
function derivePlannedOutputKg(product, orderQuantity) {
  const { kgPerUnit, conversionDetail } = deriveKgPerUnit(product);
  const qty = Number(orderQuantity);
  const plannedOutputKg = kgPerUnit * qty;

  return {
    plannedOutputKg,
    kgPerUnit,
    conversionDetail: {
      ...conversionDetail,
      orderQuantity: qty,
      plannedOutputKg,
    },
  };
}

module.exports = { deriveKgPerUnit, derivePlannedOutputKg };
