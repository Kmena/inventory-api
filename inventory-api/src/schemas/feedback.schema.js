const { z } = require('zod');

const FEEDBACK_CATEGORIES = /** @type {const} */ (['bug', 'sugerencia', 'elogio']);
const FEEDBACK_CONTEXTS = /** @type {const} */ ([
  'rfq', 'billing', 'produccion', 'recibo',
  'cliente', 'usuario', 'manual',
  'planificacion', 'compras',
]);

const createFeedbackSchema = z.object({
  rating:      z.number().int().min(1).max(5),
  category:    z.enum(FEEDBACK_CATEGORIES),
  comment:     z.string().min(1).max(2000),
  improvement: z.string().max(2000).optional(),
  context:     z.enum(FEEDBACK_CONTEXTS),
  route:       z.string().max(500).optional(),
});

module.exports = { createFeedbackSchema, FEEDBACK_CATEGORIES, FEEDBACK_CONTEXTS };
