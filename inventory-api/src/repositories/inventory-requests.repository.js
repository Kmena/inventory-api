'use strict';

const prisma = require('../lib/prisma');

/**
 * Create a new InventoryRequest record.
 * @param {object} data
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function createRequest(data, db = prisma) {
  return (db ?? prisma).inventoryRequest.create({ data });
}

/**
 * Find a single InventoryRequest by id scoped to companyId.
 * Includes related lot, product, warehouses, and users.
 * @param {bigint} id
 * @param {bigint} companyId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function findRequestById(id, companyId, db = prisma) {
  return (db ?? prisma).inventoryRequest.findFirst({
    where: { id, companyId },
    include: {
      lot: true,
      product: { select: { id: true, name: true, code: true } },
      sourceWarehouse: { select: { id: true, name: true, code: true } },
      destinationWarehouse: { select: { id: true, name: true, code: true } },
      requestedByUser: { select: { id: true, fullName: true, username: true } },
      assignedToUser: { select: { id: true, fullName: true, username: true } },
    },
  });
}

/**
 * List InventoryRequests for a company with optional filters.
 * @param {bigint} companyId
 * @param {{ status?: string; type?: string; lotId?: bigint; productId?: bigint }} [filters]
 * @param {{ skip?: number; take?: number } | null} [pagination]
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function findAllRequests(companyId, filters = {}, pagination = null, db = prisma) {
  const where = {
    companyId,
    ...(filters.status ? { status: { in: filters.status.split(',').map((s) => s.trim()) } } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.lotId ? { lotId: filters.lotId } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
  };

  const queryOptions = {
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lot: { select: { id: true, lotNumber: true, internalLotNumber: true, warehouseLotStocks: { select: { warehouseId: true, quantity: true, reservedQuantity: true } } } },
      product: { select: { id: true, name: true, code: true } },
      sourceWarehouse: { select: { id: true, name: true, code: true } },
      destinationWarehouse: { select: { id: true, name: true, code: true } },
      requestedByUser: { select: { id: true, fullName: true, username: true } },
    },
  };

  if (pagination) {
    const [items, total] = await Promise.all([
      (db ?? prisma).inventoryRequest.findMany({ ...queryOptions, skip: pagination.skip, take: pagination.take }),
      (db ?? prisma).inventoryRequest.count({ where }),
    ]);
    return { items, total };
  }

  return (db ?? prisma).inventoryRequest.findMany(queryOptions);
}

/**
 * Apply a status patch to a single InventoryRequest.
 * The service is responsible for verifying companyId ownership before calling this.
 * @param {bigint} id
 * @param {bigint} companyId
 * @param {object} patch
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function updateRequestStatus(id, companyId, patch, db = prisma) {
  return (db ?? prisma).inventoryRequest.update({
    where: { id },
    data: { ...patch, updatedAt: new Date() },
  });
}

/**
 * Return the highest numeric suffix N for lots matching `${baseLotNumber}-TNNN` pattern.
 * Returns 0 when no matching lots exist.
 * @param {bigint} companyId
 * @param {string} baseLotNumber
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function findMaxTransferSuffixForLot(companyId, baseLotNumber, db = prisma) {
  const prefix = `${baseLotNumber}-T`;
  const lots = await (db ?? prisma).lot.findMany({
    where: { companyId, internalLotNumber: { startsWith: prefix } },
    select: { internalLotNumber: true },
  });

  let max = 0;
  for (const lot of lots) {
    const suffix = lot.internalLotNumber.slice(prefix.length);
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > max) {
      max = n;
    }
  }
  return max;
}

module.exports = {
  createRequest,
  findRequestById,
  findAllRequests,
  updateRequestStatus,
  findMaxTransferSuffixForLot,
};
