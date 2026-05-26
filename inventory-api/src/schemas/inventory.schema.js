const { z } = require('zod');

const createStockEntrySchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  note: z.string().max(500).optional(),
  supplierId: z.coerce.bigint().optional().nullable(),
  invoiceNumber: z.string().max(100).optional(),
  lotNumber: z.string().max(100).optional(),
  productionDate: z.string().datetime().optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
  entryDate: z.string().datetime().optional().nullable(),
  casNumber: z.string().max(100).optional(),
  useLot: z.boolean().optional(),
});

const adjustStockSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  direction: z.enum(['IN', 'OUT']),
  note: z.string().min(3).max(500),
  lotId: z.coerce.bigint().optional().nullable(),
});

module.exports = {
  createStockEntrySchema,
  adjustStockSchema,
};
