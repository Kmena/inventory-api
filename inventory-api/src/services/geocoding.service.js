const { geocodingSearchUrl } = require('../config');
const { createHttpError } = require('../lib/errors');

// URL base de Nominatim derivada de la URL de búsqueda configurada
const geocodingReverseUrl = (() => {
  try {
    const parsed = new URL(geocodingSearchUrl);
    return `${parsed.origin}/reverse`;
  } catch (_err) {
    return 'https://nominatim.openstreetmap.org/reverse';
  }
})();

async function searchPlaces(query) {
  const normalizedQuery = query?.toString().trim();
  if (!normalizedQuery || normalizedQuery.length < 3) {
    throw createHttpError(400, 'Ingrese al menos 3 caracteres para buscar', 'validation_error');
  }

  const url = new URL(geocodingSearchUrl);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('countrycodes', 'cr');
  url.searchParams.set('limit', '6');
  url.searchParams.set('addressdetails', '1');

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Inventori/1.0 local development',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (_error) {
    throw createHttpError(502, 'No fue posible consultar el buscador de mapas', 'geocoding_unavailable');
  }

  if (!response.ok) {
    throw createHttpError(502, 'El buscador de mapas no respondio correctamente', 'geocoding_error');
  }

  let results;
  try {
    results = await response.json();
  } catch (_error) {
    throw createHttpError(502, 'El buscador de mapas devolvio una respuesta invalida', 'geocoding_error');
  }

  if (!Array.isArray(results)) {
    throw createHttpError(502, 'El buscador de mapas devolvio una respuesta invalida', 'geocoding_error');
  }

  return results.map((item) => ({
    name: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    type: item.type,
    category: item.category,
  })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

/**
 * Geocodificación inversa: coordenadas → datos de dirección de Costa Rica.
 * Mapea la respuesta de Nominatim a { province, canton, district, displayName }.
 * @param {number} lat
 * @param {number} lon
 */
async function reverseGeocode(lat, lon) {
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);

  if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
    throw createHttpError(400, 'Latitud inválida', 'validation_error');
  }
  if (!Number.isFinite(parsedLon) || parsedLon < -180 || parsedLon > 180) {
    throw createHttpError(400, 'Longitud inválida', 'validation_error');
  }

  const url = new URL(geocodingReverseUrl);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(parsedLat));
  url.searchParams.set('lon', String(parsedLon));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'es');

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Inventori/1.0 local development',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (_error) {
    throw createHttpError(502, 'No fue posible consultar la geocodificación inversa', 'geocoding_unavailable');
  }

  if (!response.ok) {
    throw createHttpError(502, 'El servicio de geocodificación inversa no respondió correctamente', 'geocoding_error');
  }

  let result;
  try {
    result = await response.json();
  } catch (_error) {
    throw createHttpError(502, 'El servicio de geocodificación inversa devolvió una respuesta inválida', 'geocoding_error');
  }

  const address = result?.address || {};

  // Mapeo para Costa Rica:
  // Nominatim devuelve provincias como `state`, cantones como `county`,
  // y distritos pueden estar en varios campos según la densidad del dato.
  return {
    province: address.state || address.province || null,
    canton:   address.county || address.city || address.municipality || null,
    district: address.suburb || address.neighbourhood || address.quarter || address.city_district || address.district || null,
    displayName: result.display_name || null,
  };
}

module.exports = {
  searchPlaces,
  reverseGeocode,
};
