-- Adds transfer-specific StockMovementType enum values required by
-- specs/inventory-ux-mvp TASK-013 / MASTER-027 true transfers.
--
-- Deployment safety:
--   * Additive enum extension only; no historical stock_movements rows are rewritten.
--   * Runtime transfer code already emits TRANSFER_OUT and TRANSFER_IN under a
--     shared movement_group_id, so the database enum must accept both values.
--
-- Rollback note:
--   PostgreSQL cannot drop enum values safely once added. If rollback is needed,
--   disable the transfer endpoint in application code or forward-fix consumers;
--   existing historical transfer movements remain valid audit history.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'StockMovementType'
      AND e.enumlabel = 'TRANSFER_OUT'
  ) THEN
    ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'StockMovementType'
      AND e.enumlabel = 'TRANSFER_IN'
  ) THEN
    ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN';
  END IF;
END $$;
