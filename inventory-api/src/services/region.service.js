const { createHttpError } = require('../lib/errors');
const regionRepository = require('../repositories/region.repository');

function assertCompanyAdmin(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }
}

function serializeSubregion(subregion) {
  return {
    id: subregion.id,
    regionId: subregion.regionId,
    name: subregion.name,
    routeCode: subregion.routeCode,
    createdAt: subregion.createdAt,
    updatedAt: subregion.updatedAt,
  };
}

function serializeRegion(region) {
  return {
    id: region.id,
    companyId: region.companyId,
    name: region.name,
    routeCode: region.routeCode,
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
    subregions: region.subregions?.map(serializeSubregion) || [],
  };
}

async function listCompanyRegions(auth) {
  assertCompanyAdmin(auth);
  const regions = await regionRepository.findCompanyRegions(BigInt(auth.companyId));
  return regions.map(serializeRegion);
}

async function createCompanyRegion(payload, auth) {
  assertCompanyAdmin(auth);

  try {
    const region = await regionRepository.createCompanyRegion({
      companyId: BigInt(auth.companyId),
      name: payload.name,
      routeCode: payload.routeCode,
    });

    return serializeRegion(region);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una zona con ese nombre', 'conflict');
    }
    throw error;
  }
}

async function createCompanySubregion(regionId, payload, auth) {
  assertCompanyAdmin(auth);

  const region = await regionRepository.findCompanyRegionById(regionId, BigInt(auth.companyId));
  if (!region) {
    throw createHttpError(404, 'Zona no encontrada', 'not_found');
  }

  try {
    const subregion = await regionRepository.createSubregion({
      regionId,
      name: payload.name,
      routeCode: payload.routeCode,
    });

    return serializeSubregion(subregion);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una subzona con ese nombre en esta zona', 'conflict');
    }
    throw error;
  }
}

module.exports = {
  listCompanyRegions,
  createCompanyRegion,
  createCompanySubregion,
};
