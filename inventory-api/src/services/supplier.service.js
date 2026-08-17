const { createHttpError } = require('../lib/errors');
const supplierRepository = require('../repositories/supplier.repository');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
    actorUserId: auth.sub ? BigInt(auth.sub) : null,
  };
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function serializeSupplier(supplier) {
  return {
    id: supplier.id,
    companyId: supplier.companyId,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    country: supplier.country,
    note: supplier.note,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    productCount: supplier._count?.products ?? 0,
  };
}

function serializeProductSupplierLink(ps) {
  return {
    productId: ps.productId,
    productName: ps.product?.name || null,
    productCode: ps.product?.code || null,
    productUnit: ps.product?.unit || null,
    isPreferred: ps.isPreferred,
    supplierSku: ps.supplierSku,
    unitPrice: ps.unitPrice != null ? Number(ps.unitPrice) : null,
    currency: ps.currency,
    leadTimeDays: ps.leadTimeDays,
    minimumOrderQuantity: ps.minimumOrderQuantity != null ? Number(ps.minimumOrderQuantity) : null,
    notes: ps.notes,
    createdAt: ps.createdAt,
  };
}

function serializeSupplierDetail(supplier) {
  return {
    id: supplier.id,
    companyId: supplier.companyId,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    country: supplier.country,
    note: supplier.note,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    products: (supplier.products || []).map(serializeProductSupplierLink),
  };
}

async function listSuppliers(auth) {
  const { companyId } = assertCompanyScope(auth);
  const suppliers = await supplierRepository.findAllByCompanyId(companyId);
  return suppliers.map(serializeSupplier);
}

async function getSupplier(id, auth) {
  const { companyId } = assertCompanyScope(auth);
  const supplier = await supplierRepository.findByIdForCompany(id, companyId);
  if (!supplier) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  return serializeSupplierDetail(supplier);
}

async function createSupplier(payload, auth) {
  const { companyId } = assertCompanyScope(auth);

  try {
    const supplier = await supplierRepository.create({
      companyId,
      name: payload.name.trim(),
      email: normalizeOptionalText(payload.email),
      phone: normalizeOptionalText(payload.phone),
      country: normalizeOptionalText(payload.country),
      note: normalizeOptionalText(payload.note),
    });

    return serializeSupplier({ ...supplier, _count: { products: 0 } });
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe un proveedor con ese nombre en la empresa', 'conflict');
    }
    throw error;
  }
}

async function updateSupplier(id, payload, auth) {
  const { companyId } = assertCompanyScope(auth);

  const existing = await supplierRepository.findByIdForCompanyRaw(id, companyId);
  if (!existing) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  const data = {};
  if (payload.name !== undefined) {
    data.name = payload.name.trim();
  }
  if (payload.email !== undefined) {
    data.email = normalizeOptionalText(payload.email);
  }
  if (payload.phone !== undefined) {
    data.phone = normalizeOptionalText(payload.phone);
  }
  if (payload.country !== undefined) {
    data.country = normalizeOptionalText(payload.country);
  }
  if (payload.note !== undefined) {
    data.note = normalizeOptionalText(payload.note);
  }

  try {
    await supplierRepository.update(id, companyId, data);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe un proveedor con ese nombre en la empresa', 'conflict');
    }
    throw error;
  }

  const updated = await supplierRepository.findByIdForCompany(id, companyId);
  return serializeSupplierDetail(updated);
}

async function deleteSupplier(id, auth) {
  const { companyId } = assertCompanyScope(auth);

  const existing = await supplierRepository.findByIdForCompanyRaw(id, companyId);
  if (!existing) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  const deps = await supplierRepository.countDependencies(id, companyId);
  if (deps.total > 0) {
    throw createHttpError(
      409,
      `No se puede eliminar el proveedor porque tiene registros asociados: ${deps.quotations} cotizaciones, ${deps.purchaseOrders} ordenes de compra, ${deps.purchaseReceipts} recepciones`,
      'conflict',
    );
  }

  await supplierRepository.remove(id, companyId);
}

async function addProduct(supplierId, payload, auth) {
  const { companyId } = assertCompanyScope(auth);

  const supplier = await supplierRepository.findByIdForCompanyRaw(supplierId, companyId);
  if (!supplier) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  const product = await supplierRepository.findProductByIdForCompany(payload.productId, companyId);
  if (!product) {
    throw createHttpError(404, 'Producto no encontrado o inactivo para la empresa autenticada', 'not_found');
  }

  try {
    const createdLink = /** @type {any} */ (await supplierRepository.createProductSupplier({
      productId: payload.productId,
      supplierId,
      isPreferred: payload.isPreferred ?? false,
      supplierSku: normalizeOptionalText(payload.supplierSku),
      unitPrice: payload.unitPrice != null ? payload.unitPrice : null,
      currency: normalizeOptionalText(payload.currency),
      leadTimeDays: payload.leadTimeDays != null ? payload.leadTimeDays : null,
      minimumOrderQuantity: payload.minimumOrderQuantity != null ? payload.minimumOrderQuantity : null,
      notes: normalizeOptionalText(payload.notes),
    }));

    return {
      productId: createdLink.productId,
      supplierId: createdLink.supplierId,
      isPreferred: createdLink.isPreferred,
      supplierSku: createdLink.supplierSku,
      unitPrice: createdLink.unitPrice != null ? Number(createdLink.unitPrice) : null,
      currency: createdLink.currency,
      leadTimeDays: createdLink.leadTimeDays,
      minimumOrderQuantity: createdLink.minimumOrderQuantity != null ? Number(createdLink.minimumOrderQuantity) : null,
      notes: createdLink.notes,
      createdAt: createdLink.createdAt,
    };
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'El producto ya esta asignado a este proveedor', 'conflict');
    }
    throw error;
  }
}

async function removeProduct(supplierId, productId, auth) {
  const { companyId } = assertCompanyScope(auth);

  const supplier = await supplierRepository.findByIdForCompanyRaw(supplierId, companyId);
  if (!supplier) {
    throw createHttpError(404, 'Proveedor no encontrado para la empresa autenticada', 'not_found');
  }

  try {
    await supplierRepository.removeProductSupplier(productId, supplierId);
  } catch (error) {
    if (error.code === 'P2025') {
      throw createHttpError(404, 'La asignacion de producto no existe', 'not_found');
    }
    throw error;
  }
}

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  addProduct,
  removeProduct,
};
