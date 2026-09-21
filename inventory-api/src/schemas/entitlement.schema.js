const { z } = require('zod');

const idStringSchema = z.union([z.string().min(1), z.number().int().positive()]);

const isoDateSchema = z.coerce.date();

const optionalIdSchema = idStringSchema.optional();

const manualActivateEntitlementSchema = z.object({
  clientId: idStringSchema,
  productId: idStringSchema,
  sourceOrderId: optionalIdSchema,
  sourceOrderItemId: optionalIdSchema,
  sourceInvoiceId: optionalIdSchema,
  sourceInvoiceItemId: optionalIdSchema,
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  reason: z.string().trim().min(3).max(500),
}).superRefine((value, ctx) => {
  if (value.endDate && value.startDate && value.endDate <= value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'La fecha final debe ser posterior a la fecha inicial',
    });
  }
});

const cancelEntitlementSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const renewEntitlementSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  sourceOrderId: optionalIdSchema,
  sourceOrderItemId: optionalIdSchema,
  sourceInvoiceId: optionalIdSchema,
  sourceInvoiceItemId: optionalIdSchema,
}).superRefine((value, ctx) => {
  if (value.endDate && value.endDate <= value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'La fecha final debe ser posterior a la fecha inicial',
    });
  }
});

module.exports = {
  cancelEntitlementSchema,
  manualActivateEntitlementSchema,
  renewEntitlementSchema,
};
