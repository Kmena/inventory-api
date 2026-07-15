const { createHttpError } = require('../lib/errors');
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

async function listCompanyWarehouses(auth) {
  assertCompanyAdmin(auth);
  const warehouses = await warehouseRepository.findCompanyWarehouses(BigInt(auth.companyId));
  const items = warehouses.map(serializeWarehouse);

  return {
    items,
    summary: buildSummary(items),
    warehouseTypes: WAREHOUSE_TYPES,
  };
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

module.exports = {
  listCompanyWarehouses,
  createCompanyWarehouse,
};
