const { z } = require('zod');

const QUALITY_INSPECTION_RESULTS = ['APPROVED', 'CONDITIONALLY_ACCEPTED', 'REJECTED'];

const qualityInspectionSchema = z.object({
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
}).strict();

module.exports = {
  qualityInspectionSchema,
  QUALITY_INSPECTION_RESULTS,
};
