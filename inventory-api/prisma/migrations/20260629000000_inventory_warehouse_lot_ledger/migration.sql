CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'QUARANTINED', 'EXPIRED', 'BLOCKED', 'CONSUMED');
CREATE TYPE "LotQaStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

ALTER TABLE "lots"
  ADD COLUMN "internal_lot_number" TEXT,
  ADD COLUMN "manufacturer_lot_number" TEXT,
  ADD COLUMN "original_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN "status" "LotStatus" NOT NULL DEFAULT 'QUARANTINED',
  ADD COLUMN "qa_status" "LotQaStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "lots"
SET
  "internal_lot_number" = COALESCE(NULLIF("lot_number", ''), 'LEGACY-' || "id"::TEXT),
  "manufacturer_lot_number" = NULLIF("lot_number", ''),
  "original_quantity" = "quantity",
  "status" = CASE
    WHEN "expiration_date" IS NOT NULL AND "expiration_date" < CURRENT_TIMESTAMP THEN 'EXPIRED'::"LotStatus"
    WHEN "quantity" <= 0 THEN 'CONSUMED'::"LotStatus"
    ELSE 'AVAILABLE'::"LotStatus"
  END,
  "qa_status" = 'APPROVED'::"LotQaStatus";

CREATE UNIQUE INDEX "lots_product_id_internal_lot_number_key"
  ON "lots"("product_id", "internal_lot_number");
CREATE INDEX "lots_expiration_date_status_qa_status_idx"
  ON "lots"("expiration_date", "status", "qa_status");

INSERT INTO "warehouses" (
  "company_id", "code", "name", "warehouse_type",
  "is_virtual", "is_sellable_source", "is_active", "created_at", "updated_at"
)
SELECT
  c."id", 'LEGACY-GENERAL', 'Bodega general migrada', 'GENERAL',
  FALSE, TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "warehouses" w WHERE w."company_id" = c."id"
);

INSERT INTO "warehouse_stocks" (
  "inventory_id", "warehouse_id", "product_id", "quantity",
  "reserved_quantity", "created_at", "updated_at"
)
SELECT
  i."id",
  selected_warehouse."id",
  p."id",
  p."quantity",
  p."reserved_quantity",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "products" p
JOIN "inventories" i ON i."company_id" = p."company_id"
JOIN LATERAL (
  SELECT w."id"
  FROM "warehouses" w
  WHERE w."company_id" = p."company_id" AND w."is_active" = TRUE
  ORDER BY
    CASE WHEN w."is_sellable_source" THEN 0 ELSE 1 END,
    w."id"
  LIMIT 1
) selected_warehouse ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM "warehouse_stocks" ws
  WHERE ws."product_id" = p."id"
);

CREATE TABLE "warehouse_lot_stocks" (
  "id" BIGSERIAL NOT NULL,
  "warehouse_id" BIGINT NOT NULL,
  "lot_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "reserved_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "warehouse_lot_stocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_lot_stocks_warehouse_id_lot_id_key"
  ON "warehouse_lot_stocks"("warehouse_id", "lot_id");
CREATE INDEX "warehouse_lot_stocks_warehouse_id_product_id_idx"
  ON "warehouse_lot_stocks"("warehouse_id", "product_id");
CREATE INDEX "warehouse_lot_stocks_lot_id_idx"
  ON "warehouse_lot_stocks"("lot_id");

ALTER TABLE "warehouse_lot_stocks"
  ADD CONSTRAINT "warehouse_lot_stocks_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_lot_stocks"
  ADD CONSTRAINT "warehouse_lot_stocks_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_lot_stocks"
  ADD CONSTRAINT "warehouse_lot_stocks_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "warehouse_lot_stocks" (
  "warehouse_id", "lot_id", "product_id", "quantity",
  "reserved_quantity", "created_at", "updated_at"
)
SELECT
  selected_warehouse."id",
  l."id",
  l."product_id",
  l."quantity",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "lots" l
JOIN "products" p ON p."id" = l."product_id"
JOIN LATERAL (
  SELECT w."id"
  FROM "warehouses" w
  LEFT JOIN "warehouse_stocks" ws
    ON ws."warehouse_id" = w."id" AND ws."product_id" = l."product_id"
  WHERE w."company_id" = p."company_id"
  ORDER BY
    CASE WHEN ws."quantity" > 0 THEN 0 ELSE 1 END,
    CASE WHEN w."is_sellable_source" THEN 0 ELSE 1 END,
    w."id"
  LIMIT 1
) selected_warehouse ON TRUE;

ALTER TABLE "stock_movements"
  ADD COLUMN "company_id" BIGINT,
  ADD COLUMN "warehouse_id" BIGINT,
  ADD COLUMN "user_id" BIGINT,
  ADD COLUMN "quantity_before" DECIMAL(14,3),
  ADD COLUMN "quantity_after" DECIMAL(14,3),
  ADD COLUMN "reason_code" TEXT,
  ADD COLUMN "movement_group_id" TEXT;

UPDATE "stock_movements" sm
SET
  "company_id" = p."company_id",
  "warehouse_id" = (
    SELECT w."id"
    FROM "warehouses" w
    WHERE w."company_id" = p."company_id"
    ORDER BY
      CASE WHEN EXISTS (
        SELECT 1
        FROM "warehouse_lot_stocks" wls
        WHERE wls."warehouse_id" = w."id" AND wls."lot_id" = sm."lot_id"
      ) THEN 0 ELSE 1 END,
      CASE WHEN EXISTS (
        SELECT 1
        FROM "warehouse_stocks" ws
        WHERE ws."warehouse_id" = w."id"
          AND ws."product_id" = sm."product_id"
          AND ws."quantity" > 0
      ) THEN 0 ELSE 1 END,
      w."id"
    LIMIT 1
  ),
  "reason_code" = CASE
    WHEN sm."source_type" = 'order' THEN 'ORDER_RESERVATION'
    WHEN sm."source_type" = 'order_dispatch' THEN 'ORDER_DISPATCH'
    WHEN sm."source_type" = 'manual_adjustment' THEN 'MANUAL_ADJUSTMENT'
    ELSE 'LEGACY_MIGRATION'
  END
FROM "products" p
WHERE p."id" = sm."product_id";

ALTER TABLE "stock_movements"
  ALTER COLUMN "company_id" SET NOT NULL,
  ALTER COLUMN "warehouse_id" SET NOT NULL,
  ALTER COLUMN "reason_code" SET NOT NULL;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "stock_movements_company_id_created_at_idx"
  ON "stock_movements"("company_id", "created_at");
CREATE INDEX "stock_movements_warehouse_id_product_id_created_at_idx"
  ON "stock_movements"("warehouse_id", "product_id", "created_at");
CREATE INDEX "stock_movements_lot_id_idx"
  ON "stock_movements"("lot_id");
CREATE INDEX "stock_movements_movement_group_id_idx"
  ON "stock_movements"("movement_group_id");

ALTER TABLE "orders" ADD COLUMN "warehouse_id" BIGINT;

UPDATE "orders" o
SET "warehouse_id" = (
  SELECT w."id"
  FROM "warehouses" w
  WHERE w."company_id" = o."company_id" AND w."is_active" = TRUE
  ORDER BY
    CASE WHEN w."is_sellable_source" THEN 0 ELSE 1 END,
    w."id"
  LIMIT 1
);

ALTER TABLE "orders" ALTER COLUMN "warehouse_id" SET NOT NULL;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "orders_warehouse_id_idx" ON "orders"("warehouse_id");
