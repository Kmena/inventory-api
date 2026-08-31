const { z } = require('zod');

const optionalDateSchema = z.union([z.coerce.date(), z.null()]).optional();

const createProductionOrderSchema = z.object({
  productId: z.coerce.bigint(),
  recipeVersionId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  originWarehouseId: z.coerce.bigint(),
  destinationWarehouseId: z.coerce.bigint(),
  responsibleUserId: z.coerce.bigint(),
  priority: z.coerce.number().int().min(0).max(999).optional(),
  productionLotCode: z.string().trim().min(1).max(100),
  plannedDate: optionalDateSchema,
  productionDate: optionalDateSchema,
  expirationDate: optionalDateSchema,
  overrideJustification: z.string().trim().min(10).max(1000).optional().nullable(),
}).strict().superRefine((payload, context) => {
  if (payload.originWarehouseId === payload.destinationWarehouseId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['destinationWarehouseId'],
      message: 'La bodega destino debe ser distinta de la bodega origen',
    });
  }

  if (payload.productionDate && payload.expirationDate && payload.expirationDate < payload.productionDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expirationDate'],
      message: 'La fecha de vencimiento no puede ser anterior a la fecha de producción',
    });
  }

  if (payload.plannedDate && payload.expirationDate && payload.expirationDate < payload.plannedDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expirationDate'],
      message: 'La fecha de vencimiento no puede ser anterior a la fecha planificada',
    });
  }
});

const productionApprovalSchema = z.object({
  overrideJustification: z.string().trim().min(10).max(1000).optional().nullable(),
}).strict();

const productionStageMaterialSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionStageParameterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  actualValue: z.coerce.number().optional(),
  value: z.coerce.number().optional(),
  unit: z.string().trim().min(1).max(40).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict().transform((payload) => ({
  name: payload.name,
  actualValue: payload.actualValue ?? payload.value,
  unit: payload.unit ?? null,
  note: payload.note ?? null,
})).superRefine((payload, context) => {
  if (typeof payload.actualValue !== 'number' || Number.isNaN(payload.actualValue)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['actualValue'],
      message: 'Cada parámetro QA debe incluir un valor numérico',
    });
  }
});

const productionStageEvidenceSchema = z.object({
  type: z.string().trim().min(1).max(80),
  reference: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionStageExecutionSchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  actualParameters: z.array(productionStageParameterSchema).optional().default([]),
  evidence: z.array(productionStageEvidenceSchema).optional().default([]),
  consumptions: z.array(productionStageMaterialSchema).optional().default([]),
  waste: z.array(productionStageMaterialSchema).optional().default([]),
  overrideJustification: z.string().trim().min(10).max(1000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict().superRefine((payload, context) => {
  if (payload.endedAt < payload.startedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endedAt'],
      message: 'La hora de finalización no puede ser anterior a la hora de inicio',
    });
  }
}
);

const productionStageReturnSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  reasonCode: z.string().trim().min(1).max(80),
  returnedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionCompletionSchema = z.object({
  producedQuantity: z.coerce.number().positive(),
  lotCode: z.string().trim().min(1).max(100).optional().nullable(),
  expirationDate: optionalDateSchema,
  productionDate: optionalDateSchema,
  /** Override de bodega destino; si se omite se usa la definida en la orden. */
  destinationWarehouseId: z.coerce.bigint().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
}).strict();

// ─── TASK-006: Stage loss registration schema (production-stage-rejection-and-reexecution) ───

const stageLossItemSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  // quantity must be positive; validated also at service layer (BR-002)
  quantity: z.coerce.number().positive('La cantidad de pérdida debe ser positiva'),
  // reasonCode: free text, max 100 chars (DEC-005)
  reasonCode: z.string().trim().min(1, 'El código de razón es obligatorio').max(100),
  note: z.string().trim().max(1000).optional().nullable(),
}).strict();

// losses can be empty [] — explicit declaration of zero losses (DEC-003)
const stageLossSchema = z.object({
  losses: z.array(stageLossItemSchema),
}).strict();

// ─── Cancel with material returns ────────────────────────────────────────────
// Each item represents one batch to put back into stock when cancelling.
// quantity = 0 items are silently skipped by the service.
// Either targetLotId (existing lot) OR newLotCode (create new lot) is required
// when quantity > 0; the service enforces this — schema stays permissive.

const cancelReturnItemSchema = z.object({
  productId:      z.coerce.bigint(),
  quantity:       z.coerce.number().nonnegative(),
  targetLotId:    z.coerce.bigint().optional().nullable(),
  newLotCode:     z.string().trim().min(1).max(100).optional().nullable(),
  expirationDate: z.union([z.coerce.date(), z.null()]).optional(),
  note:           z.string().trim().max(500).optional().nullable(),
}).strict();

const cancelWithReturnsSchema = z.object({
  returns: z.array(cancelReturnItemSchema).optional().default([]),
  note:    z.string().trim().max(1000).optional().nullable(),
}).strict();

// TASK-006 (original): recolection confirmation payload
// AUD-001: entries allows lot-level declaration when confirming REPLACEMENT_RECOVERY stages
const recolectionEntryItemSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().max(30).optional().nullable(),
});

const recolectionConfirmSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
  entries: z.array(recolectionEntryItemSchema).optional().nullable(),
}).strict();

// TASK-006 (qa-rejection-material-reconciliation-amendment): reconciliation outcome payload
const reconciliationOutcomeItemSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  outcome: z.enum(['USED', 'RETURNED', 'DISCARDED']),
  notes: z.string().trim().max(500).optional().nullable(),
});

const recordReconciliationOutcomesSchema = z.object({
  outcomes: z.array(reconciliationOutcomeItemSchema).min(1),
}).strict();

module.exports = {
  createProductionOrderSchema,
  productionApprovalSchema,
  productionStageExecutionSchema,
  productionStageReturnSchema,
  productionCompletionSchema,
  stageLossItemSchema,
  stageLossSchema,
  cancelReturnItemSchema,
  cancelWithReturnsSchema,
  recolectionConfirmSchema,
  reconciliationOutcomeItemSchema,
  recordReconciliationOutcomesSchema,
};
