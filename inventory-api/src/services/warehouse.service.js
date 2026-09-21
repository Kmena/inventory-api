const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const { WAREHOUSE_TYPES, getWarehouseTypeDefinition, isVirtualWarehouseType } = require('../lib/warehouse-types');
const warehouseRepository = require('../repositories/warehouse.repository');

function assertCompanyAdmin(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El administrador debe pertenecer a una empresa', 'forbidden');
  }
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
}

function serializeWarehouse(warehouse) {
  const typeDefinition = getWarehouseTypeDefinition(warehouse.warehouseType);

  return {
    id: warehouse.id,
    companyId: warehouse.companyId,
    code: warehouse.code,
    name: warehouse.name,
    warehouseType: warehouse.warehouseType,
    warehouseTypeLabel: typeDefinition.label,
    warehouseTypeDescription: typeDefinition.description,
    isVirtual: warehouse.isVirtual,
    isSellableSource: warehouse.isSellableSource,
    isActive: warehouse.isActive,
    createdAt: warehouse.createdAt,
    locationType: warehouse.locationType,
    locationNature: warehouse.locationNature,
    updatedAt: warehouse.updatedAt,
  };
}

function buildSummary(items) {
  return {
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    virtual: items.filter((item) => item.isVirtual).length,
    sellable: items.filter((item) => item.isSellableSource).length,
  };
}

async function listCompanyWarehouses(auth, pagination = null) {
  assertCompanyAdmin(auth);
  const warehouses = await warehouseRepository.findCompanyWarehouses(BigInt(auth.companyId), pagination);
  if (!pagination) {
    const warehouseRows = /** @type {Array<any>} */ (warehouses);
    const items = warehouseRows.map(serializeWarehouse);
    return {
      items,
      summary: buildSummary(items),
      warehouseTypes: WAREHOUSE_TYPES,
    };
  }

  const paginatedWarehouses = /** @type {{ items: Array<any>, totalItems: number, summary: { total: number, active: number, virtual: number, sellable: number } }} */ (warehouses);
  return {
    ...buildPaginatedResponse(paginatedWarehouses.items.map(serializeWarehouse), pagination, paginatedWarehouses.totalItems),
    summary: paginatedWarehouses.summary,
    warehouseTypes: WAREHOUSE_TYPES,
  };
}

async function getCompanyWarehouse(id, auth) {
  assertCompanyAdmin(auth);
  const warehouse = await warehouseRepository.findCompanyWarehouseById(id, BigInt(auth.companyId));
  if (!warehouse) throw createHttpError(404, 'Ubicacion no encontrada para la empresa', 'not_found');
  return serializeWarehouse(warehouse);
}

async function createCompanyWarehouse(payload, auth) {
  assertCompanyAdmin(auth);

  const typeDefinition = getWarehouseTypeDefinition(payload.warehouseType);
  const isVirtual = isVirtualWarehouseType(payload.warehouseType);
  const isSellableSource = isVirtual
    ? false
    : payload.isSellableSource ?? typeDefinition.defaultSellableSource;

  try {
    const warehouse = await warehouseRepository.createCompanyWarehouse({
      companyId: BigInt(auth.companyId),
      code: normalizeCode(payload.code),
      name: payload.name.trim(),
      warehouseType: payload.warehouseType,
      locationType: payload.locationType ?? 'BODEGA',
      locationNature: payload.locationNature ?? (isVirtual ? 'VIRTUAL' : 'PHYSICAL'),
      isVirtual,
      isSellableSource,
      isActive: payload.isActive ?? true,
    });

    return serializeWarehouse(warehouse);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una bodega con ese codigo o nombre', 'conflict');
    }
    throw error;
  }
}

async function updateCompanyWarehouse(id, payload, auth) {
  assertCompanyAdmin(auth);
  const existing = await warehouseRepository.findCompanyWarehouseById(id, BigInt(auth.companyId));
  if (!existing) throw createHttpError(404, 'Ubicacion no encontrada para la empresa', 'not_found');
  const nextWarehouseType = payload.warehouseType ?? existing.warehouseType;
  const typeDefinition = getWarehouseTypeDefinition(nextWarehouseType);
  const isVirtual = isVirtualWarehouseType(nextWarehouseType);
  const data = {
    ...(payload.code ? { code: normalizeCode(payload.code) } : {}),
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.warehouseType ? { warehouseType: nextWarehouseType, isVirtual } : {}),
    ...(payload.locationType ? { locationType: payload.locationType } : {}),
    ...(payload.locationNature ? { locationNature: payload.locationNature } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'isSellableSource') ? { isSellableSource: isVirtual ? false : payload.isSellableSource } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'isActive') ? { isActive: payload.isActive } : {}),
  };
  if (payload.warehouseType && !Object.prototype.hasOwnProperty.call(payload, 'isSellableSource')) {
    data.isSellableSource = isVirtual ? false : typeDefinition.defaultSellableSource;
  }
  try {
    const updated = await warehouseRepository.updateCompanyWarehouse(id, BigInt(auth.companyId), data);
    if (!updated) throw createHttpError(404, 'Ubicacion no encontrada para la empresa', 'not_found');
    return serializeWarehouse(updated);
  } catch (error) {
    if (error.code === 'P2002') throw createHttpError(409, 'Ya existe una ubicacion con ese codigo o nombre', 'conflict');
    throw error;
  }
}

async function updateCompanyWarehouseStatus(id, payload, auth) {
  assertCompanyAdmin(auth);
  const companyId = BigInt(auth.companyId);
  const warehouse = await warehouseRepository.findCompanyWarehouseById(id, companyId);
  if (!warehouse) throw createHttpError(404, 'Ubicacion no encontrada para la empresa', 'not_found');
  if (payload.isActive === false) {
    const usage = await warehouseRepository.getWarehouseInventoryUsage(id, companyId);
    if (usage.stockCount > 0 || usage.lotStockCount > 0 || usage.pendingOrderCount > 0) {
      throw createHttpError(409, 'No se puede desactivar una ubicacion con stock, reservas u operaciones pendientes', 'location_has_stock');
    }
  }
  const updated = await warehouseRepository.updateCompanyWarehouse(id, companyId, { isActive: payload.isActive });
  return serializeWarehouse(updated);
}

module.exports = {
  listCompanyWarehouses,
  getCompanyWarehouse,
  createCompanyWarehouse,
  updateCompanyWarehouse,
  updateCompanyWarehouseStatus,
};
