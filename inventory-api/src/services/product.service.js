const productRepository = require('../repositories/product.repository');
const inventoryService = require('./inventory.service');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const { hasPermission, serializeProductForPermissions } = require('./product-permission-shaping.service');
const { syncGeneralPrice } = require('./product-pricing.service');

function authScope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa', 'forbidden');
  }
  return { companyId: BigInt(auth.companyId), userId: BigInt(auth.sub) };
}
function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  return Number(value);
}

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  return Number.parseInt(String(value), 10);
}

function normalizeCategoryName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function deriveProductType(categoryType) {
  switch (categoryType) {
    case 'MP':
      return 'RAW_MATERIAL';
    case 'EM':
      return 'PACKAGING';
    default:
      return 'FINISHED_PRODUCT';
  }
}

function deriveInventoryTypeFromCategoryType(categoryType) {
  switch (categoryType) {
    case 'MP':
      return 'RAW_MATERIAL';
    case 'EM':
      return 'PACKAGING';
    default:
      return 'FINISHED_GOOD';
  }
}

function normalizeInventoryType(value) {
  switch (normalizeOptionalString(value)) {
    case 'RAW_MATERIAL':
      return 'RAW_MATERIAL';
    case 'PACKAGING':
      return 'PACKAGING';
    case 'WORK_IN_PROCESS':
      return 'WORK_IN_PROCESS';
    case 'FINISHED_GOOD':
    case 'FINISHED_PRODUCT':
      return 'FINISHED_GOOD';
    default:
      return null;
  }
}

function deriveSourcingMethodFromInventoryType(inventoryType) {
  if (inventoryType === 'RAW_MATERIAL' || inventoryType === 'PACKAGING') {
    return 'PURCHASE_ONLY';
  }
  return 'PRODUCTION_OR_PURCHASE';
}

function deriveSellableKind(categoryType) {
  return categoryType === 'PT' ? 'STANDARD' : 'NON_SELLABLE';
}

function deriveTaxDefaults(taxExempt) {
  if (taxExempt) {
    return {
      taxCategory: 'VAT_EXEMPT',
      taxRate: 0,
    };
  }

  return {
    taxCategory: 'VAT_STANDARD',
    taxRate: 13,
  };
}

function buildNormalizedAllowedWarehouseIds(allowedWarehouseIds) {
  if (!Array.isArray(allowedWarehouseIds)) {
    return [];
  }
  return [...new Set(allowedWarehouseIds.map((warehouseId) => BigInt(warehouseId).toString()))].map((warehouseId) => BigInt(warehouseId));
}

function buildNormalizedAuthorizedSuppliers(authorizedSuppliers) {
  if (!Array.isArray(authorizedSuppliers)) {
    return [];
  }

  const supplierLinksById = new Map();
  for (const supplierLink of authorizedSuppliers) {
    const supplierId = BigInt(supplierLink.supplierId);
    supplierLinksById.set(supplierId.toString(), {
      supplierId,
      isPreferred: supplierLink.isPreferred ?? false,
      supplierSku: normalizeOptionalString(supplierLink.supplierSku),
      leadTimeDays: normalizeOptionalInteger(supplierLink.leadTimeDays),
      minimumOrderQuantity: normalizeOptionalNumber(supplierLink.minimumOrderQuantity),
      notes: normalizeOptionalString(supplierLink.notes),
    });
  }

  return [...supplierLinksById.values()];
}

async function ensureAllowedWarehousesBelongToCompany(companyId, allowedWarehouseIds, db) {
  if (!allowedWarehouseIds.length) {
    return;
  }

  const warehouses = await productRepository.findCompanyWarehousesByIds(companyId, allowedWarehouseIds, db);
  if (warehouses.length !== allowedWarehouseIds.length) {
    throw createHttpError(404, 'Una o mas bodegas autorizadas no pertenecen a la empresa', 'not_found');
  }
}

async function ensureAuthorizedSuppliersBelongToCompany(companyId, authorizedSuppliers, db) {
  if (!authorizedSuppliers.length) {
    return;
  }

  const supplierIds = authorizedSuppliers.map((supplierLink) => supplierLink.supplierId);
  const suppliers = await productRepository.findCompanySuppliersByIds(companyId, supplierIds, db);
  if (suppliers.length !== supplierIds.length) {
    throw createHttpError(404, 'Uno o mas proveedores autorizados no pertenecen a la empresa', 'not_found');
  }
}

function buildImportedProductData(row, companyId, category, auth) {
  const code = normalizeOptionalString(row.code) ?? row.id.toString();
  const description = normalizeOptionalString(row.description);
  const unit = normalizeOptionalString(row.unit) ?? 'UN';
  const currency = normalizeOptionalString(row.currency) ?? 'CRC';
  const taxExempt = row.taxExempt ?? false;
  const taxDefaults = deriveTaxDefaults(taxExempt);
  const categoryType = category?.categoryType ?? 'PT';
  const inventoryType = normalizeInventoryType(row.inventoryType)
    ?? normalizeInventoryType(row.productType)
    ?? deriveInventoryTypeFromCategoryType(categoryType);
  const requiresLot = row.requiresLot ?? true;

  return {
    companyId,
    categoryId: category?.id ?? null,
    createdByUserId: auth?.sub ? BigInt(auth.sub) : null,
    code,
    sku: normalizeOptionalString(row.sku),
    barcode: normalizeOptionalString(row.barcode),
    name: row.name.trim(),
    description,
    sourcingMethod: normalizeOptionalString(row.sourcingMethod) ?? deriveSourcingMethodFromInventoryType(inventoryType),
    inventoryType,
    productType: normalizeOptionalString(row.productType) ?? deriveProductType(categoryType),
    sellableKind: normalizeOptionalString(row.sellableKind) ?? deriveSellableKind(categoryType),
    unit,
    cabysCode: normalizeOptionalString(row.cabysCode),
    currency,
    price: normalizeOptionalNumber(row.price),
    taxExempt,
    taxCategory: normalizeOptionalString(row.taxCategory) ?? taxDefaults.taxCategory,
    taxRate: normalizeOptionalNumber(row.taxRate) ?? taxDefaults.taxRate,
    density: normalizeOptionalNumber(row.density),
    densityUnit: normalizeOptionalString(row.densityUnit),
    requiresLot,
    requiresExpiration: row.requiresExpiration ?? false,
    standardCost: normalizeOptionalNumber(row.standardCost),
    realCost: normalizeOptionalNumber(row.realCost),
    isActive: row.isActive ?? true,
    lotStrategy: 'TRACKED',
    inCatalog: row.inCatalog ?? true,
    netContent: normalizeOptionalNumber(row.netContent) ?? 0,
    conversionFactor: normalizeOptionalNumber(row.conversionFactor) ?? 1,
    kgConversionFactor: normalizeOptionalNumber(row.kgConversionFactor) ?? normalizeOptionalNumber(row.conversionFactor) ?? 1,
    minStock: normalizeOptionalNumber(row.minStock),
    maxStock: normalizeOptionalNumber(row.maxStock),
    standbyStock: normalizeOptionalNumber(row.standbyStock) ?? 0,
  };
}

function buildProductWriteData(payload, auth, existingProduct) {
  const taxExempt = payload.taxExempt ?? existingProduct?.taxExempt ?? false;
  const defaults = deriveTaxDefaults(taxExempt);
  const categoryType = payload.productType ? null : existingProduct?.category?.categoryType ?? 'PT';
  const inventoryType = normalizeInventoryType(payload.inventoryType)
    ?? normalizeInventoryType(payload.productType)
    ?? normalizeInventoryType(existingProduct?.inventoryType)
    ?? normalizeInventoryType(existingProduct?.productType)
    ?? deriveInventoryTypeFromCategoryType(categoryType);
  const requiresLot = payload.requiresLot ?? existingProduct?.requiresLot ?? ((payload.lotStrategy ?? existingProduct?.lotStrategy ?? 'TRACKED') === 'TRACKED');

  return {
    ...payload,
    companyId: payload.companyId ?? (auth?.companyId ? BigInt(auth.companyId) : existingProduct?.companyId),
    createdByUserId: payload.createdByUserId ?? existingProduct?.createdByUserId ?? (auth?.sub ? BigInt(auth.sub) : null),
    sku: normalizeOptionalString(payload.sku) ?? existingProduct?.sku ?? null,
    barcode: normalizeOptionalString(payload.barcode) ?? existingProduct?.barcode ?? null,
    sourcingMethod: normalizeOptionalString(payload.sourcingMethod) ?? existingProduct?.sourcingMethod ?? deriveSourcingMethodFromInventoryType(inventoryType),
    inventoryType,
    productType: payload.productType ?? existingProduct?.productType ?? deriveProductType(categoryType),
    sellableKind: payload.sellableKind ?? existingProduct?.sellableKind ?? deriveSellableKind(categoryType),
    cabysCode: normalizeOptionalString(payload.cabysCode) ?? existingProduct?.cabysCode ?? null,
    taxExempt,
    taxCategory: payload.taxCategory ?? existingProduct?.taxCategory ?? defaults.taxCategory,
    taxRate: payload.taxRate ?? existingProduct?.taxRate ?? defaults.taxRate,
    density: payload.density ?? existingProduct?.density ?? null,
    densityUnit: normalizeOptionalString(payload.densityUnit) ?? existingProduct?.densityUnit ?? null,
    requiresLot,
    requiresExpiration: payload.requiresExpiration ?? existingProduct?.requiresExpiration ?? false,
    standardCost: payload.standardCost ?? existingProduct?.standardCost ?? null,
    realCost: payload.realCost ?? existingProduct?.realCost ?? null,
    isActive: payload.isActive ?? existingProduct?.isActive ?? true,
    // inCatalog no se envia desde el formulario admin — sin este default
    // Prisma usaria el @default(false) de la DB y el producto quedaria
    // invisible para el agente de ventas
    inCatalog: payload.inCatalog ?? existingProduct?.inCatalog ?? true,
    lotStrategy: payload.lotStrategy ?? existingProduct?.lotStrategy ?? 'TRACKED',
    kgConversionFactor: payload.kgConversionFactor
      ?? payload.conversionFactor
      ?? existingProduct?.kgConversionFactor
      ?? existingProduct?.conversionFactor
      ?? 1,
  };
}

async function listProducts(auth, pagination = null) {
  const { companyId } = authScope(auth);
  const products = await productRepository.findAllProducts(companyId, pagination);
  if (pagination) {
    const paginatedProducts = /** @type {{ items: Array<any>, totalItems: number }} */ (products);
    return buildPaginatedResponse(
      paginatedProducts.items.map((product) => serializeProductForPermissions(product, auth)),
      pagination,
      paginatedProducts.totalItems,
    );
  }
  const productRows = /** @type {Array<any>} */ (products);
  return productRows.map((product) => serializeProductForPermissions(product, auth));
}

async function getProduct(id, auth) {
  const { companyId } = authScope(auth);
  const product = await productRepository.findProductById(id, companyId);
  if (!product) throw createHttpError(404, 'Producto no encontrado', 'not_found');
  return serializeProductForPermissions(product, auth);
}

/** System-level categories that every inventory must have, in display order. */
const SYSTEM_CATEGORIES = [
  { categoryType: 'PT', name: 'Producto Terminado', sortOrder: 0 },
  { categoryType: 'MP', name: 'Materia Prima', sortOrder: 1 },
  { categoryType: 'EM', name: 'Empaques', sortOrder: 2 },
];

function serializeCategory(category) {
  return {
    id: category.id,
    inventoryId: category.inventoryId,
    name: category.name,
    categoryType: category.categoryType,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function serializeCategoryWithSubcategories(category) {
  return {
    ...serializeCategory(category),
    subcategories: (category.subcategories || []).map((sub) => ({
      id: sub.id,
      categoryId: sub.categoryId,
      name: sub.name,
      code: sub.code || null,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    })),
  };
}

/**
 * Ensures the three system categories (PT/MP/EM) exist for the inventory.
 * Uses categoryType as the uniqueness key so that existing user-named categories
 * are preserved and no duplicates are created.
 */
async function ensureSystemCategoriesExist(inventoryId) {
  for (const { categoryType, name, sortOrder } of SYSTEM_CATEGORIES) {
    const existing = await productRepository.findCategoryByType(inventoryId, categoryType);
    if (!existing) {
      await productRepository.createCategory({ inventoryId, name, categoryType, isActive: true, sortOrder });
    }
  }
}

async function listCategories(auth) {
  const { companyId } = authScope(auth);
  const inventory = await productRepository.findInventoryByCompanyId(companyId);
  if (!inventory) {
    return [];
  }

  await ensureSystemCategoriesExist(inventory.id);
  const allCategories = await productRepository.findActiveCategoriesWithSubcategories(inventory.id);

  // Deduplicate: keep only the first (lowest-id) category per system type.
  // Prevents duplicate entries when the DB already had categories with the same categoryType.
  const seen = new Set();
  const categories = allCategories.filter((cat) => {
    if (seen.has(cat.categoryType)) return false;
    seen.add(cat.categoryType);
    return true;
  });

  return categories.map(serializeCategoryWithSubcategories);
}

async function createSubcategory(payload, auth) {
  const { companyId } = authScope(auth);
  const inventory = await productRepository.findInventoryByCompanyId(companyId);
  if (!inventory) {
    throw createHttpError(409, 'La empresa del usuario no tiene inventario configurado', 'conflict');
  }

  const categoryId = BigInt(payload.categoryId);

  // Verify the target category belongs to this company's inventory
  const allCategories = await productRepository.findActiveCategoriesWithSubcategories(inventory.id);
  const seenTypes = new Set();
  const categories = allCategories.filter((cat) => {
    if (seenTypes.has(cat.categoryType)) return false;
    seenTypes.add(cat.categoryType);
    return true;
  });
  const validCategory = categories.find((c) => String(c.id) === String(categoryId));
  if (!validCategory) {
    throw createHttpError(404, 'La categoria padre indicada no existe en el inventario de esta empresa', 'not_found');
  }

  const normalizedName = normalizeCategoryName(payload.name);
  const existingSubcategory = await productRepository.findSubcategoryByName(categoryId, normalizedName);
  if (existingSubcategory) {
    throw createHttpError(409, 'Ya existe una subcategoria con ese nombre en esta categoria', 'conflict');
  }

  try {
    const subcategory = await productRepository.createSubcategory({
      categoryId,
      name: normalizedName,
      code: payload.code || null,
      isActive: true,
    });

    return {
      id: subcategory.id,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      code: subcategory.code,
      isActive: subcategory.isActive,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt,
    };
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una subcategoria con ese nombre en esta categoria', 'conflict');
    }
    throw error;
  }
}

/** @deprecated Use createSubcategory instead. Kept for internal import compatibility. */
async function createCategory(payload, auth) {
  const { companyId } = authScope(auth);
  const inventory = await productRepository.findInventoryByCompanyId(companyId);
  if (!inventory) {
    throw createHttpError(409, 'La empresa del usuario no tiene inventario configurado', 'conflict');
  }

  const normalizedName = normalizeCategoryName(payload.name);
  const existingCategory = await productRepository.findCategoryByName(inventory.id, normalizedName);
  if (existingCategory) {
    throw createHttpError(409, 'Ya existe una categoria con ese nombre', 'conflict');
  }

  try {
    const category = await productRepository.createCategory({
      inventoryId: inventory.id,
      name: normalizedName,
      categoryType: payload.categoryType,
      isActive: true,
      sortOrder: payload.sortOrder ?? 0,
    });

    return serializeCategory(category);
  } catch (error) {
    if (error.code === 'P2002') {
      throw createHttpError(409, 'Ya existe una categoria con ese nombre', 'conflict');
    }

    throw error;
  }
}

async function createProduct(payload, auth) {
  const scope = authScope(auth);
  const {
    initialLots = [],
    allowedWarehouseIds,
    authorizedSuppliers,
    quantity: _quantity,
    reservedQuantity: _reserved,
    companyId: _company,
    ...productPayload
  } = payload;

  if (initialLots.length && !hasPermission(auth, 'inventory.manage')) {
    throw createHttpError(403, 'Se requiere permiso de inventario para registrar existencias iniciales', 'forbidden');
  }

  const normalizedAllowedWarehouseIds = buildNormalizedAllowedWarehouseIds(allowedWarehouseIds);
  const normalizedAuthorizedSuppliers = buildNormalizedAuthorizedSuppliers(authorizedSuppliers);

  return productRepository.transaction(async (tx) => {
    await ensureAllowedWarehousesBelongToCompany(scope.companyId, normalizedAllowedWarehouseIds, tx);
    await ensureAuthorizedSuppliersBelongToCompany(scope.companyId, normalizedAuthorizedSuppliers, tx);

    const data = buildProductWriteData({
      ...productPayload,
      companyId: scope.companyId,
      createdByUserId: scope.userId,
      quantity: 0,
      reservedQuantity: 0,
    }, auth);

    const product = await tx.product.create({
      data: {
        ...data,
        ...(normalizedAllowedWarehouseIds.length > 0 ? {
          allowedWarehouses: {
            create: normalizedAllowedWarehouseIds.map((warehouseId) => ({ warehouseId })),
          },
        } : {}),
        ...(normalizedAuthorizedSuppliers.length > 0 ? {
          supplierLinks: {
            create: normalizedAuthorizedSuppliers,
          },
        } : {}),
      },
      include: productRepository.productInclude,
    });

    await syncGeneralPrice(tx, product.id, data.price, data.currency);

    for (const initialLot of initialLots) {
      await inventoryService.registerStockEntryInTransaction(tx, {
        ...initialLot,
        productId: product.id,
        reasonCode: 'INITIAL_PRODUCT_STOCK',
        note: initialLot.note || 'Existencia inicial registrada con el producto',
        useLot: true,
      }, auth);
    }

    const createdProduct = await tx.product.findUnique({
      where: { id: product.id },
      include: productRepository.productInclude,
    });
    return serializeProductForPermissions(createdProduct, auth);
  });
}

async function updateProduct(id, payload, auth) {
  const scope = authScope(auth);
  const existingProduct = await getProduct(id, auth);
  const hasAllowedWarehouseUpdate = Object.prototype.hasOwnProperty.call(payload, 'allowedWarehouseIds');
  const hasAuthorizedSupplierUpdate = Object.prototype.hasOwnProperty.call(payload, 'authorizedSuppliers');
  const normalizedAllowedWarehouseIds = buildNormalizedAllowedWarehouseIds(payload.allowedWarehouseIds);
  const normalizedAuthorizedSuppliers = buildNormalizedAuthorizedSuppliers(payload.authorizedSuppliers);

  return productRepository.transaction(async (tx) => {
    if (hasAllowedWarehouseUpdate) {
      await ensureAllowedWarehousesBelongToCompany(scope.companyId, normalizedAllowedWarehouseIds, tx);
    }
    if (hasAuthorizedSupplierUpdate) {
      await ensureAuthorizedSuppliersBelongToCompany(scope.companyId, normalizedAuthorizedSuppliers, tx);
    }

    const {
      allowedWarehouseIds: _allowedWarehouseIds,
      authorizedSuppliers: _authorizedSuppliers,
      companyId: _companyId,
      ...productPayload
    } = payload;
    const data = buildProductWriteData(productPayload, auth, existingProduct);
    const product = await productRepository.updateProduct(id, scope.companyId, data, tx);
    if (!product) {
      throw createHttpError(404, 'Producto no encontrado', 'not_found');
    }

    if (hasAllowedWarehouseUpdate) {
      await productRepository.replaceProductAllowedWarehouses(product.id, normalizedAllowedWarehouseIds, tx);
    }
    if (hasAuthorizedSupplierUpdate) {
      await productRepository.replaceProductSupplierLinks(product.id, normalizedAuthorizedSuppliers, tx);
    }

    await syncGeneralPrice(tx, product.id, data.price, data.currency ?? product.currency);

    const reloadedProduct = await productRepository.findProductById(id, scope.companyId, tx);
    return serializeProductForPermissions(reloadedProduct, auth);
  });
}

async function removeProduct(id, auth) {
  const { companyId } = authScope(auth);
  await getProduct(id, auth);
  return productRepository.deactivateCompanyProduct(id, companyId);
}

async function importProducts(rows, auth) {
  const { companyId } = authScope(auth);
  if (rows.some((row) => Number(row.quantity || 0) > 0) && !hasPermission(auth, 'inventory.manage')) {
    throw createHttpError(403, 'Se requiere permiso de inventario para importar existencias', 'forbidden');
  }
  const productIds = rows.map((row) => row.id);
  const existingProducts = await productRepository.findProductsByIds(productIds, companyId);
  const existingProductsById = new Map(existingProducts.map((product) => [product.id.toString(), product]));

  return productRepository.transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({ where: { companyId } });
    if (!inventory) {
      throw createHttpError(409, 'La empresa del usuario no tiene inventario configurado', 'conflict');
    }

    const categoryCache = new Map();
    const summary = {
      created: [],
      updated: [],
      skipped: [],
    };

    for (const row of rows) {
      const existing = existingProductsById.get(row.id.toString());
      const categoryName = normalizeOptionalString(row.categoryName);
      let categoryId = null;

      if (categoryName) {
        const cacheKey = `${inventory.id.toString()}:${categoryName.toLowerCase()}`;
        let category = categoryCache.get(cacheKey);

        if (!category) {
          category = await tx.category.findFirst({
            where: {
              inventoryId: inventory.id,
              name: { equals: categoryName, mode: 'insensitive' },
            },
          });

          if (!category) {
            category = await tx.category.create({
              data: {
                inventoryId: inventory.id,
                name: categoryName,
                categoryType: 'PT',
              },
            });
          }

          categoryCache.set(cacheKey, category);
        }

        categoryId = category.id;
      }

      const category = categoryId
        ? await tx.category.findUnique({
            where: { id: categoryId },
          })
        : null;

      const data = buildImportedProductData(row, companyId, category, auth);

      if (existing) {
        if (existing.companyId.toString() !== companyId.toString()) {
          summary.skipped.push({ id: row.id.toString(), name: row.name, reason: 'belongs_to_other_company' });
          continue;
        }

        if (!row.overwrite) {
          summary.skipped.push({ id: row.id.toString(), name: row.name, reason: 'exists_without_overwrite' });
          continue;
        }

        const updated = await productRepository.updateProduct(row.id, companyId, data, tx);
        if (!updated) {
          summary.skipped.push({ id: row.id.toString(), name: row.name, reason: 'not_found_during_update' });
          continue;
        }

        await syncGeneralPrice(tx, updated.id, data.price, data.currency);

        summary.updated.push({ id: updated.id.toString(), name: updated.name });
        continue;
      }

      const created = await tx.product.create({
        data: {
          id: row.id,
          ...data,
          quantity: 0,
          reservedQuantity: 0,
        },
        include: productRepository.productInclude,
      });

      await syncGeneralPrice(tx, created.id, data.price, data.currency);

      if (Number(row.quantity || 0) > 0) {
        await inventoryService.registerStockEntryInTransaction(tx, {
          warehouseId: row.warehouseId,
          productId: created.id,
          quantity: Number(row.quantity),
          internalLotNumber: row.internalLotNumber,
          manufacturerLotNumber: row.manufacturerLotNumber,
          expirationDate: row.expirationDate,
          reasonCode: 'INITIAL_IMPORT_STOCK',
          note: 'Existencia inicial importada desde Excel',
          useLot: true,
        }, auth);
      }

      summary.created.push({ id: created.id.toString(), name: created.name });
    }

    return summary;
  });
}

module.exports = {
  listProducts,
  listCategories,
  getProduct,
  createCategory,
  createSubcategory,
  createProduct,
  updateProduct,
  removeProduct,
  importProducts,
};

