const { z } = require('zod');

const createPaymentSchema = z.object({
  invoiceId: z.coerce.bigint(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CREDIT', 'TRANSFER', 'CARD']),
  reference: z.string().max(255).optional(),
});

const updatePaymentSchema = createPaymentSchema.partial();

module.exports = { createPaymentSchema, updatePaymentSchema };
