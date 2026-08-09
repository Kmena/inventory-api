-- Migration: add_order_payment_condition
--
-- Agrega el enum PaymentConditionType y las columnas paymentCondition y
-- transferMetadata al modelo Order para soportar el ciclo de facturacion
-- y cobro del agente (feature: client-payment-ledger).
--
-- Los pedidos existentes mantienen payment_condition = NULL y no cambian
-- su comportamiento (compatibilidad backward con pedidos legacy).
--
-- Rollback:
--   DROP INDEX IF EXISTS "orders_payment_condition_idx";
--   ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_condition";
--   ALTER TABLE "orders" DROP COLUMN IF EXISTS "transfer_metadata";
--   DROP TYPE IF EXISTS "PaymentConditionType";

-- 1. Crear el enum
CREATE TYPE "PaymentConditionType" AS ENUM ('CASH', 'TRANSFER', 'CREDIT');

-- 2. Agregar las columnas (nullable para backward compat)
ALTER TABLE "orders" ADD COLUMN "payment_condition" "PaymentConditionType";
ALTER TABLE "orders" ADD COLUMN "transfer_metadata" JSONB;

-- 3. Crear el indice para filtros por condicion de pago
CREATE INDEX "orders_payment_condition_idx" ON "orders"("payment_condition");
