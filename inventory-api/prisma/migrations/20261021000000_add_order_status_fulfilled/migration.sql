-- Migration: add_order_status_fulfilled (MASTER-004 / NPP-TASK-005)
-- Adds the FULFILLED value to the OrderStatus enum required by
--   * specs/non-physical-products-mvp/data-model.md §1
--   * specs/non-physical-products-mvp/migration.md §2 Migration B
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 2
--
-- Strategy:
--   * Additive enum extension only.
--   * Historical DELIVERED rows MUST remain untouched. No UPDATE runs on the
--     orders table in this migration.
--   * No runtime code writes FULFILLED yet. That behavior is scheduled for
--     Wave 2 (mixed-order approval/dispatch).
--
-- Rollback note: PostgreSQL cannot drop enum values. Forward-fix strategy
-- applies. This is safe because the enum value only exists in DDL until Wave 2
-- code deployment starts writing it.
--
-- Idempotency: guarded by pg_enum lookup so re-running the migration in
-- environments that already carry the value is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = 'OrderStatus'
       AND e.enumlabel = 'FULFILLED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'FULFILLED' AFTER 'DELIVERED';
  END IF;
END$$;
