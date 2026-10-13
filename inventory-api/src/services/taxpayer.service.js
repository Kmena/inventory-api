const { haciendaTaxpayerLookupUrl } = require('../config');
const { createHttpError } = require('../lib/errors');

function buildLookupUrl(identification) {
  if (haciendaTaxpayerLookupUrl.includes('{identification}')) {
    return haciendaTaxpayerLookupUrl.replace('{identification}', encodeURIComponent(identification));
  }

  const separator = haciendaTaxpayerLookupUrl.includes('?') ? '&' : '?';
  return `${haciendaTaxpayerLookupUrl}${separator}identificacion=${encodeURIComponent(identification)}`;
}

function pickFirst(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim();
}

function normalizeTaxpayer(data, identification, documentType) {
  const taxpayer = data?.contribuyente || data?.persona || data?.data || data;
  const name = pickFirst(
    taxpayer?.nombre,
    taxpayer?.nombreCompleto,
    taxpayer?.razonSocial,
    taxpayer?.name,
    data?.nombre,
    data?.razonSocial,
  );

  if (!name) {
    return null;
  }

  // RFR-TASK-201: extract ALL activities from actividades[]
  // Backward compat: economicActivityCode / economicActivityName still point to the first activity.
  // activities[] is the authoritative P1 array — code preserved as returned (no numeric-only
  // normalization, no decimal removal). pickFirst trims whitespace only — see ACTIVITY CODE RULE.
  const rawActividades = Array.isArray(taxpayer?.actividades)
    ? taxpayer.actividades
    : Array.isArray(data?.actividades)
      ? data.actividades
      : [];

  const activities = rawActividades
    .map((act) => ({
      code: pickFirst(act?.codigo, act?.code) || null,
      description: pickFirst(act?.descripcion, act?.description, act?.nombre) || null,
      haciendaStatus: pickFirst(act?.estado, act?.status) || null,
      haciendaType: pickFirst(act?.tipo, act?.type) || null,
    }))
    .filter((act) => Boolean(act.code));

  const firstActivity = activities[0] || null;

  return {
    identification,
    documentType,
    name,
    email: pickFirst(taxpayer?.correo, taxpayer?.email, data?.correo, data?.email),
    phone: pickFirst(taxpayer?.telefono, taxpayer?.phone, data?.telefono, data?.phone),
    address: pickFirst(taxpayer?.direccion, taxpayer?.address, data?.direccion, data?.address),
    // backward-compat scalars: first activity only — legacy consumers unchanged
    economicActivityCode: firstActivity?.code || null,
    economicActivityName: firstActivity?.description || null,
    // P1 authoritative full list
    activities,
    raw: data,
  };
}

async function lookupTaxpayer({ identification, documentType }) {
  const normalizedIdentification = identification.replace(/\D/g, '');
  if (!normalizedIdentification) {
    throw createHttpError(400, 'Ingrese una identificacion valida', 'validation_error');
  }

  const url = buildLookupUrl(normalizedIdentification);
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (_error) {
    throw createHttpError(502, 'No fue posible consultar Hacienda en este momento', 'hacienda_unavailable');
  }

  if (response.status === 404) {
    throw createHttpError(404, 'Hacienda no encontro datos para esa identificacion', 'not_found');
  }

  if (!response.ok) {
    throw createHttpError(502, 'Hacienda no respondio correctamente', 'hacienda_error');
  }

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    throw createHttpError(502, 'Hacienda devolvio una respuesta invalida', 'hacienda_error');
  }

  const taxpayer = normalizeTaxpayer(data, normalizedIdentification, documentType);
  if (!taxpayer) {
    throw createHttpError(404, 'No se encontraron datos tributarios para esa identificacion', 'not_found');
  }

  return taxpayer;
}

module.exports = {
  lookupTaxpayer,
};
