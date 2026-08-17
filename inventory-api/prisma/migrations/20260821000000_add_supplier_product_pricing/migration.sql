-- Add supplier product pricing fields
-- The product_suppliers table is currently empty, so this migration is zero-risk.
-- These fields allow tracking the unit purchase price and currency for each product-supplier link.

ALTER TABLE "product_suppliers"
ADD COLUMN "unit_price" DECIMAL(14, 2),
ADD COLUMN "currency" VARCHAR(10) DEFAULT 'CRC';
