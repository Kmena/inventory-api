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

  const activity = Array.isArray(taxpayer?.actividades)
    ? taxpayer.actividades[0]
    : Array.isArray(data?.actividades)
      ? data.actividades[0]
      : null;

  return {
    identification,
    documentType,
    name,
    email: pickFirst(taxpayer?.correo, taxpayer?.email, data?.correo, data?.email),
    phone: pickFirst(taxpayer?.telefono, taxpayer?.phone, data?.telefono, data?.phone),
    address: pickFirst(taxpayer?.direccion, taxpayer?.address, data?.direccion, data?.address),
    economicActivityCode: pickFirst(activity?.codigo, activity?.code),
    economicActivityName: pickFirst(activity?.descripcion, activity?.description, activity?.nombre),
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

  const data = await response.json();
  const taxpayer = normalizeTaxpayer(data, normalizedIdentification, documentType);
  if (!taxpayer) {
    throw createHttpError(404, 'No se encontraron datos tributarios para esa identificacion', 'not_found');
  }

  return taxpayer;
}

module.exports = {
  lookupTaxpayer,
};
