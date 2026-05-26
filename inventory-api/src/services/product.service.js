const productRepository = require('../repositories/product.repository');
const { createHttpError } = require('../lib/errors');

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  return Number(value);
}

function buildImportedProductData(row, companyId, categoryId) {
  const code = normalizeOptionalString(row.code) ?? row.id.toString();
  const description = normalizeOptionalString(row.description);
  const unit = normalizeOptionalString(row.unit) ?? 'UN';
  const currency = normalizeOptionalString(row.currency) ?? 'CRC';

  return {
    companyId,
    categoryId,
    code,
    name: row.name.trim(),
    description,
    unit,
    currency,
    price: normalizeOptionalNumber(row.price),
    quantity: normalizeOptionalNumber(row.quantity) ?? 0,
    reservedQuantity: normalizeOptionalNumber(row.reservedQuantity) ?? 0,
    taxExempt: row.taxExempt ?? false,
    inCatalog: row.inCatalog ?? true,
    netContent: normalizeOptionalNumber(row.netContent) ?? 0,
    conversionFactor: normalizeOptionalNumber(row.conversionFactor) ?? 1,
    minStock: normalizeOptionalNumber(row.minStock),
    maxStock: normalizeOptionalNumber(row.maxStock),
    standbyStock: normalizeOptionalNumber(row.standbyStock) ?? 0,
  };
}

async function listProducts() {
  return productRepository.findAllProducts();
}

async function getProduct(id) {
  const product = await productRepository.findProductById(id);
  if (!product) throw createHttpError(404, 'Producto no encontrado', 'not_found');
  return product;
}

async function createProduct(payload) {
  return productRepository.createProduct(payload);
}

async function updateProduct(id, payload) {
  await getProduct(id);
  return productRepository.updateProduct(id, payload);
}

async function removeProduct(id) {
  await getProduct(id);
  return productRepository.deleteProduct(id);
}

async function importProducts(rows, auth) {
  const companyId = BigInt(auth.companyId);
  const productIds = rows.map((row) => row.id);
  const existingProducts = await productRepository.findProductsByIds(productIds);
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

      const data = buildImportedProductData(row, companyId, categoryId);

      if (existing) {
        if (existing.companyId.toString() !== companyId.toString()) {
          summary.skipped.push({ id: row.id.toString(), name: row.name, reason: 'belongs_to_other_company' });
          continue;
        }

        if (!row.overwrite) {
          summary.skipped.push({ id: row.id.toString(), name: row.name, reason: 'exists_without_overwrite' });
          continue;
        }

        const updated = await tx.product.update({
          where: { id: row.id },
          data,
          include: { category: true, recipe: true },
        });

        summary.updated.push({ id: updated.id.toString(), name: updated.name });
        continue;
      }

      const created = await tx.product.create({
        data: {
          id: row.id,
          ...data,
        },
        include: { category: true, recipe: true },
      });

      summary.created.push({ id: created.id.toString(), name: created.name });
    }

    return summary;
  });
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  removeProduct,
  importProducts,
};
