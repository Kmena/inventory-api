const { z } = require('zod');

const createInvoiceSchema = z.object({
  clientId: z.coerce.bigint(),
  orderId: z.coerce.bigint().optional().nullable(),
  number: z.string().min(1).max(100),
  amount: z.number().min(0).optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'CANCELLED']).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

module.exports = { createInvoiceSchema, updateInvoiceSchema };
