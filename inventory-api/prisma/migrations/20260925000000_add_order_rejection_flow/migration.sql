-- Part 1 of 2: extend the OrderStatus enum.
-- PostgreSQL requires the new enum value to be committed before it can be
-- referenced in column definitions, so this runs as its own migration.
--
-- REJECTED is distinct from CANCELLED:
--   CANCELLED = terminated, no further action.
--   REJECTED  = office sent it back; agent must fix and resubmit.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
