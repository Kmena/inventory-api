const prisma = require('../lib/prisma');

/** @type {[{ priceType: 'asc' }, { validFrom: 'desc' }]} */
const activeProductPriceOrderBy = [{ priceType: 'asc' }, { validFrom: 'desc' }];

/** @type {{ warehouseId: 'asc' }} */
const warehouseStockOrderBy = { warehouseId: 'asc' };

/** @type {[{ warehouseId: 'asc' }, { lotId: 'asc' }]} */
const warehouseLotStockOrderBy = [{ warehouseId: 'asc' }, { lotId: 'asc' }];

/** @type {[{ warehouseId: 'asc' }]} */
const allowedWarehouseOrderBy = [{ warehouseId: 'asc' }];

/** @type {[{ supplierId: 'asc' }]} */
const supplierLinkOrderBy = [{ supplierId: 'asc' }];

/** @type {[{ id: 'asc' }]} */
const productListOrderBy = [{ id: 'asc' }];

const productInclude = {
  category: true,
  subcategory: true,
  recipe: true,
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      username: true,
      companyId: true,
      roleId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  prices: {
    where: { isActive: true },
    orderBy: activeProductPriceOrderBy,
  },
  supplierLinks: {
    include: { supplier: true },
    orderBy: supplierLinkOrderBy,
  },
  allowedWarehouses: {
    include: { warehouse: true },
    orderBy: allowedWarehouseOrderBy,
  },
  warehouseStocks: {
    include: { warehouse: true },
    orderBy: warehouseStockOrderBy,
  },
  warehouseLotStocks: {
    include: { warehouse: true, lot: true },
    orderBy: warehouseLotStockOrderBy,
  },
};

function transaction(work) {
  return prisma.$transaction(work);
}

function buildDefaultActiveProductWhere(where = {}) {
  return {
    ...where,
    isActive: true,
  };
}

function findAllProducts(companyId, pagination = null) {
  const where = buildDefaultActiveProductWhere({ companyId });
  const orderBy = productListOrderBy;

  if (!pagination) {
    return prisma.product.findMany({
      where,
      orderBy,
      include: productInclude,
    });
  }

  return prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: productInclude,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findProductById(id, companyId, db = prisma) {
  return db.product.findFirst({
    where: buildDefaultActiveProductWhere({ id, companyId }),
    include: productInclude,
  });
}

function findProductsByIds(ids, companyId) {
  return prisma.product.findMany({
    where: { id: { in: ids }, companyId },
    include: { category: true, subcategory: true, prices: true },
  });
}

function findCompanyWarehousesByIds(companyId, warehouseIds, db = prisma) {
  return db.warehouse.findMany({
    where: {
      companyId,
      id: { in: warehouseIds },
      isActive: true,
    },
    select: { id: true },
  });
}

function findCompanySuppliersByIds(companyId, supplierIds, db = prisma) {
  return db.supplier.findMany({
    where: {
      companyId,
      id: { in: supplierIds },
    },
    select: { id: true },
  });
}

function findInventoryByCompanyId(companyId, db = prisma) {
  return db.inventory.findUnique({
    where: { companyId },
  });
}

function findActiveCategoriesByInventoryId(inventoryId, db = prisma) {
  return db.category.findMany({
    where: {
      inventoryId,
      isActive: true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });
}

function findActiveCategoriesWithSubcategories(inventoryId, db = prisma) {
  return db.category.findMany({
    where: { inventoryId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      subcategories: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
      },
    },
  });
}

function findCategoryByType(inventoryId, categoryType, db = prisma) {
  return db.category.findFirst({
    where: { inventoryId, categoryType },
  });
}

function findCategoryByName(inventoryId, name, db = prisma) {
  return db.category.findFirst({
    where: {
      inventoryId,
      name: { equals: name, mode: 'insensitive' },
    },
  });
}

function createCategory(data, db = prisma) {
  return db.category.create({ data });
}

function findSubcategoryByName(categoryId, name, db = prisma) {
  return db.productSubcategory.findFirst({
    where: {
      categoryId,
      name: { equals: name, mode: 'insensitive' },
    },
  });
}

function createSubcategory(data, db = prisma) {
  return db.productSubcategory.create({ data });
}

function createProduct(data) {
  return prisma.product.create({ data, include: productInclude });
}

async function updateProduct(id, companyId, data, db = prisma) {
  const result = await db.product.updateMany({
    where: buildDefaultActiveProductWhere({ id, companyId }),
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return db.product.findFirst({
    where: buildDefaultActiveProductWhere({ id, companyId }),
    include: productInclude,
  });
}

async function replaceProductAllowedWarehouses(productId, warehouseIds, db = prisma) {
  await /** @type {any} */ (db).productAllowedWarehouse.deleteMany({ where: { productId } });
  if (!warehouseIds.length) {
    return;
  }

  await /** @type {any} */ (db).productAllowedWarehouse.createMany({
    data: warehouseIds.map((warehouseId) => ({ productId, warehouseId })),
  });
}

async function replaceProductSupplierLinks(productId, supplierLinks, db = prisma) {
  await db.productSupplier.deleteMany({ where: { productId } });
  if (!supplierLinks.length) {
    return;
  }

  await db.productSupplier.createMany({
    data: supplierLinks.map((supplierLink) => ({
      productId,
      supplierId: supplierLink.supplierId,
      isPreferred: supplierLink.isPreferred,
      supplierSku: supplierLink.supplierSku,
      leadTimeDays: supplierLink.leadTimeDays,
      minimumOrderQuantity: supplierLink.minimumOrderQuantity,
      notes: supplierLink.notes,
    })),
  });
}

function deactivateCompanyProduct(id, companyId) {
  return prisma.product.updateMany({
    where: buildDefaultActiveProductWhere({ id, companyId }),
    data: {
      isActive: false,
    },
  });
}

module.exports = {
  transaction,
  productInclude,
  findAllProducts,
  findProductById,
  findProductsByIds,
  findInventoryByCompanyId,
  findCompanyWarehousesByIds,
  findCompanySuppliersByIds,
  findActiveCategoriesByInventoryId,
  findActiveCategoriesWithSubcategories,
  findCategoryByType,
  findCategoryByName,
  createCategory,
  findSubcategoryByName,
  createSubcategory,
  createProduct,
  updateProduct,
  replaceProductAllowedWarehouses,
  replaceProductSupplierLinks,
  deactivateCompanyProduct,
};
