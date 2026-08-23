'use strict';

const { z } = require('zod');

/**
 * Schema for creating RFQ invitations for suppliers in a purchase request.
 */
const createRfqInvitationsSchema = z.object({
  supplierIds: z.array(z.coerce.bigint()).min(1, 'Debe seleccionar al menos un proveedor'),
}).strict();

/**
 * Schema for a single item in a public supplier response.
 */
const publicResponseItemSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.coerce.number().positive('La cantidad debe ser positiva'),
  unitPrice: z.coerce.number().positive('El precio unitario debe ser positivo'),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

/**
 * Schema for a public supplier RFQ response.
 */
const publicRfqResponseSchema = z.object({
  currency: z.string().trim().min(1).max(10).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(publicResponseItemSchema).min(1, 'Debe responder al menos un producto'),
}).strict();

/**
 * Schema for a manual response captured by an internal user.
 */
const manualRfqResponseSchema = z.object({
  currency: z.string().trim().min(1).max(10).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(publicResponseItemSchema).min(1, 'Debe ingresar al menos un producto'),
}).strict();

module.exports = {
  createRfqInvitationsSchema,
  publicRfqResponseSchema,
  publicResponseItemSchema,
  manualRfqResponseSchema,
};
