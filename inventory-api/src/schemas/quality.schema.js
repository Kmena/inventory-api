const { z } = require('zod');

const QUALITY_INSPECTION_RESULTS = ['APPROVED', 'CONDITIONALLY_ACCEPTED', 'REJECTED'];
const MATERIAL_DISPOSITION_TYPES = ['RETURN', 'DISCARD', 'RECOLLECT'];
const CONTINUATION_POINT_TYPES = ['CURRENT', 'PRIOR_STAGE'];

// DEC-004: disposición individual por (productId, lotId) consumido.
const materialDispositionItemSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  disposition: z.enum(/** @type {[string, ...string[]]} */ (MATERIAL_DISPOSITION_TYPES)),
  // Requerido para RETURN y DISCARD; ignorado para RECOLLECT (indicativo).
  quantity: z.coerce.number().positive().optional().nullable(),
});

// Disposición fina para una ejecución que quedará INVALIDATED (DEC-004).
const invalidatedStageDispositionsSchema = z.object({
  stageExecutionId: z.coerce.bigint(),
  dispositions: z.array(materialDispositionItemSchema),
});

const qualityInspectionSchemaBase = z.object({
  lotId: z.coerce.bigint().optional().nullable(),
  result: z.enum(/** @type {[string, ...string[]]} */ (QUALITY_INSPECTION_RESULTS)),
  // DEC-001: parámetros esperados también numéricos en esta iteración.
  expectedParameters: z.array(z.object({
    name: z.string().trim().min(1),
    value: z.coerce.number({ invalid_type_error: 'El valor del parámetro esperado debe ser numérico' }),
    unit: z.string().trim().optional(),
  })).optional().nullable(),
  // DEC-001: QA formal de esta iteración acepta únicamente parámetros numéricos.
  // z.coerce.number() convierte strings numéricos ('7.5' → 7.5) y rechaza non-numeric strings.
  actualResults: z.array(z.object({
    name: z.string().trim().min(1),
    value: z.coerce.number({ invalid_type_error: 'El valor del parámetro QA debe ser numérico' }),
    unit: z.string().trim().optional(),
  })).optional().nullable(),
  observations: z.string().trim().max(2000).optional().nullable(),
  evidence: z.array(z.object({
    type: z.string().trim().min(1),
    reference: z.string().trim().min(1),
  })).optional().nullable(),
  correctiveAction: z.string().trim().max(2000).optional().nullable(),
  inspectedAt: z.coerce.date().optional(),
  // TASK-001/DEC-001: optional disposition fields (only relevant when result=REJECTED)
  continuationPoint: z.enum(
    /** @type {[string, ...string[]]} */ (CONTINUATION_POINT_TYPES),
  ).optional().nullable(),
  continuationStageId: z.coerce.bigint().optional().nullable(),
  materialDispositions: z.array(materialDispositionItemSchema).optional().nullable(),
  // DEC-004: disposición fina para ejecuciones INVALIDATED por PRIOR_STAGE
  invalidatedStagesDispositions: z.array(invalidatedStageDispositionsSchema).optional().nullable(),
  // TASK-004 (qa-rejection-material-reconciliation-amendment):
  // When true, a posterior REPLACEMENT_RECOVERY stage is created after rejection
  // to track replacement of damaged or missing inputs before re-execution.
  requiresReplacementStage: z.boolean().optional().nullable(),
  replacementItems: z.array(z.object({
    productId: z.coerce.bigint().optional().nullable(),
    quantity: z.coerce.number().positive(),
    unit: z.string().trim().max(30).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })).optional().nullable(),
}).strict();

const qualityInspectionSchema = qualityInspectionSchemaBase.superRefine((payload, ctx) => {
  if (payload.result !== 'REJECTED' || payload.requiresReplacementStage !== true) {
    return;
  }

  if (!Array.isArray(payload.replacementItems) || payload.replacementItems.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['replacementItems'],
      message: 'replacementItems es requerido cuando requiresReplacementStage es true',
    });
  }
});

module.exports = {
  qualityInspectionSchema,
  QUALITY_INSPECTION_RESULTS,
  MATERIAL_DISPOSITION_TYPES,
  CONTINUATION_POINT_TYPES,
  materialDispositionItemSchema,
  invalidatedStageDispositionsSchema,
};
