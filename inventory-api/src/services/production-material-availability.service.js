const { createHttpError } = require('../lib/errors');
const productionRepository = require('../repositories/production.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const productRepository = require('../repositories/product.repository');
const { sortLotsByFefo } = require('./inventory-transaction-support.service');
const { deriveLotUsability, lotDateKey } = require('./inventory-lot-policy.service');

const DEFAULT_TOLERANCE_PERCENT = 5;

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
  };
}

function number(value) {
  return Number(value || 0);
}

async function getScopedOrder(orderId, auth) {
  const scope = assertCompanyScope(auth);
  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);

  if (!order) {
    throw createHttpError(404, 'Orden de producción no encontrada', 'not_found');
  }

  return { scope, order };
}

function compareByDateKey(leftValue, rightValue, fallback) {
  const leftKey = lotDateKey(leftValue) || fallback;
  const rightKey = lotDateKey(rightValue) || fallback;
  return leftKey.localeCompare(rightKey);
}

/**
 * Sorts warehouse lot stocks using FEFO/FIFO policy per DEC-003:
 * - Lots WITH expirationDate → sorted by expirationDate ASC (FEFO), then entryDate ASC
 * - Lots WITHOUT expirationDate → sorted by entryDate ASC (FIFO)
 * - Mixed sets: lots with expiration come before lots without expiration.
 *
 * The decision is made per-lot based on the lot's actual expirationDate field,
 * not on the product's requiresExpiration flag.
 *
 * @param {Array<{id?: bigint, lot?: {expirationDate?: Date|null, entryDate?: Date|null}}>} items
 * @returns {Array}
 */
function sortLotsForAvailability(items) {
  return [...items].sort((left, right) => {
    const leftExpiry = left.lot?.expirationDate ?? null;
    const rightExpiry = right.lot?.expirationDate ?? null;

    const leftHasExpiry = leftExpiry !== null && leftExpiry !== undefined;
    const rightHasExpiry = rightExpiry !== null && rightExpiry !== undefined;

    // Both have expiration date → FEFO: compare by expirationDate ASC, then entryDate ASC
    if (leftHasExpiry && rightHasExpiry) {
      const expirationCompare = compareByDateKey(leftExpiry, rightExpiry, '9999-12-31');
      if (expirationCompare !== 0) return expirationCompare;
      return compareByDateKey(left.lot?.entryDate, right.lot?.entryDate, '9999-12-31')
        || Number(left.id - right.id);
    }

    // Only left has expiration → left is more urgent, comes first
    if (leftHasExpiry && !rightHasExpiry) return -1;

    // Only right has expiration → right is more urgent, comes first
    if (!leftHasExpiry && rightHasExpiry) return 1;

    // Neither has expiration → FIFO: compare by entryDate ASC
    return compareByDateKey(left.lot?.entryDate, right.lot?.entryDate, '9999-12-31')
      || Number(left.id - right.id);
  });
}

function buildSuggestedLots(sortedLots, requiredQuantity) {
  let remaining = number(requiredQuantity);
  const suggested = [];

  for (const stock of sortedLots) {
    if (remaining <= 0.000001) {
      break;
    }

    const availableQuantity = Math.max(0, number(stock.quantity) - number(stock.reservedQuantity));
    if (availableQuantity <= 0.000001) {
      continue;
    }

    const quantity = Math.min(availableQuantity, remaining);
    suggested.push({
      lotId: stock.lotId,
      quantity,
    });
    remaining -= quantity;
  }

  return suggested;
}

function getSnapshotStage(order, stageId) {
  const stages = order?.recipeVersionSnapshot?.recipeVersion?.stages;
  const stage = Array.isArray(stages)
    ? stages.find((candidate) => String(candidate?.id) === String(stageId))
    : null;

  if (!stage) {
    throw createHttpError(404, 'Etapa de producción no encontrada en el snapshot de la orden', 'not_found');
  }

  return stage;
}

async function getMaterialRequirementsWithAvailability(orderId, auth) {
  const { scope, order } = await getScopedOrder(orderId, auth);
  const requirements = await productionRepository.findMaterialRequirementsByOrderIdForCompany(order.id, scope.companyId);
  const productIds = [...new Set(requirements.map((requirement) => requirement.productId).filter(Boolean))];
  const warehouseStocks = await inventoryRepository.findWarehouseStocksByProductIds(
    scope.companyId,
    order.originWarehouseId,
    productIds,
  );

  const availableByProductId = new Map(
    warehouseStocks.map((stock) => [
      String(stock.productId),
      Math.max(0, number(stock.quantity) - number(stock.reservedQuantity)),
    ]),
  );

  const items = requirements.map((requirement) => {
    const required = number(requirement.requiredQuantity);
    const available = availableByProductId.get(String(requirement.productId)) ?? 0;
    const missing = Math.max(0, required - available);

    return {
      productId: requirement.productId,
      unit: requirement.unit,
      required,
      available,
      missing,
    };
  });

  return {
    orderId: order.id,
    originWarehouseId: order.originWarehouseId,
    quantity: number(order.quantity),
    items,
    hasShortage: items.some((item) => item.missing > 0.000001),
  };
}

async function getAvailableLotsForStage(orderId, stageId, auth) {
  const { scope, order } = await getScopedOrder(orderId, auth);
  const stage = getSnapshotStage(order, stageId);
  const stageInputs = Array.isArray(stage.stageInputs)
    ? stage.stageInputs.filter((input) => input?.productId)
    : [];
  const uniqueProductIds = [...new Set(stageInputs.map((input) => BigInt(input.productId)))];
  const products = uniqueProductIds.length > 0
    ? await productRepository.findProductsByIds(uniqueProductIds, scope.companyId)
    : [];
  const productById = new Map(products.map((product) => [String(product.id), product]));

  const productsWithLots = [];

  // Todos los insumos de etapa requieren seleccion de lote. La politica es
  // FEFO cuando el producto tiene vencimiento, FIFO cuando no. No se filtra
  // por product.requiresLot porque en este sistema todo movimiento de insumo
  // debe trazarse a un lote especifico.
  for (const stageInput of stageInputs) {
    const product = productById.get(String(stageInput.productId));
    if (!product) {
      continue;
    }

    const requiredQuantity = number(stageInput.quantity) * number(order.quantity);
    const reservableLotStocks = await inventoryRepository.findReservableLotStocks(
      order.originWarehouseId,
      product.id,
    );
    const sellableLotStocks = reservableLotStocks.filter((stock) => deriveLotUsability(stock.lot).sellable);
    // DEC-003: FEFO cuando hay vencimiento, FIFO cuando no — decisión por lote.
    const sortedLots = sortLotsForAvailability(sellableLotStocks);

    productsWithLots.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      unit: stageInput.unit ?? product.unit,
      requiredQuantity,
      toleranceDefaultPercent: DEFAULT_TOLERANCE_PERCENT,
      lots: sortedLots.map((stock) => ({
        lotId: stock.lotId,
        lotNumber: stock.lot?.lotNumber ?? stock.lot?.manufacturerLotNumber ?? null,
        expirationDate: stock.lot?.expirationDate ?? null,
        entryDate: stock.lot?.entryDate ?? null,
        availableQuantity: Math.max(0, number(stock.quantity) - number(stock.reservedQuantity)),
        reservedQuantity: number(stock.reservedQuantity),
      })),
      suggested: buildSuggestedLots(sortedLots, requiredQuantity),
    });
  }

  return {
    orderId: order.id,
    stageId,
    originWarehouseId: order.originWarehouseId,
    products: productsWithLots,
  };
}

module.exports = {
  getMaterialRequirementsWithAvailability,
  getAvailableLotsForStage,
  __private__: {
    DEFAULT_TOLERANCE_PERCENT,
    sortLotsForAvailability,
    buildSuggestedLots,
    getSnapshotStage,
    assertCompanyScope,
  },
};
