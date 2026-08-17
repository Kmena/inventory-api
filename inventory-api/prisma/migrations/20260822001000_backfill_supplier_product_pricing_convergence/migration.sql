DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_suppliers'
      AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE "product_suppliers"
    ADD COLUMN "unit_price" DECIMAL(14, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_suppliers'
      AND column_name = 'currency'
  ) THEN
    ALTER TABLE "product_suppliers"
    ADD COLUMN "currency" TEXT;
  END IF;
END $$;

UPDATE "product_suppliers"
SET "currency" = 'CRC'
WHERE "currency" IS NULL
   OR BTRIM("currency") = '';

ALTER TABLE "product_suppliers"
ALTER COLUMN "currency" SET DEFAULT 'CRC';
