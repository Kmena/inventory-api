const { geocodingSearchUrl } = require('../config');
const { createHttpError } = require('../lib/errors');

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

  const results = await response.json();
  return results.map((item) => ({
    name: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    type: item.type,
    category: item.category,
  })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

module.exports = {
  searchPlaces,
};
