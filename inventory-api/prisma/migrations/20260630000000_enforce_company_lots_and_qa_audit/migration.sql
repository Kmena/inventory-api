ALTER TABLE "lots" ADD COLUMN "company_id" BIGINT;

UPDATE "lots" AS l
SET "company_id" = p."company_id"
FROM "products" AS p
WHERE p."id" = l."product_id";

UPDATE "lots"
SET "internal_lot_number" = COALESCE(
  NULLIF(BTRIM("internal_lot_number"), ''),
  NULLIF(BTRIM("lot_number"), ''),
  'LEGACY-' || "id"::text
);

WITH duplicate_lots AS (
  SELECT
    l."id",
    l."internal_lot_number",
    ROW_NUMBER() OVER (
      PARTITION BY l."company_id", l."internal_lot_number"
      ORDER BY l."id"
    ) AS duplicate_number
  FROM "lots" AS l
)
UPDATE "lots" AS l
SET "internal_lot_number" =
  LEFT(d."internal_lot_number", 94)
  || '-R'
  || LPAD((d."duplicate_number" - 1)::text, 2, '0')
FROM duplicate_lots AS d
WHERE l."id" = d."id"
  AND d."duplicate_number" > 1;

ALTER TABLE "lots"
  ALTER COLUMN "company_id" SET NOT NULL,
  ALTER COLUMN "internal_lot_number" SET NOT NULL;

ALTER TABLE "lots"
  DROP CONSTRAINT IF EXISTS "lots_product_id_internal_lot_number_key";

ALTER TABLE "lots"
  ADD CONSTRAINT "lots_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "lots_company_id_internal_lot_number_key"
  ON "lots"("company_id", "internal_lot_number");

CREATE INDEX "lots_product_id_idx" ON "lots"("product_id");

CREATE TABLE "inventory_alerts" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "lot_id" BIGINT,
  "warehouse_id" BIGINT,
  "alert_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lot_status_history" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "lot_id" BIGINT NOT NULL,
  "user_id" BIGINT,
  "action" TEXT NOT NULL,
  "previous_status" "LotStatus" NOT NULL,
  "new_status" "LotStatus" NOT NULL,
  "previous_qa_status" "LotQaStatus" NOT NULL,
  "new_qa_status" "LotQaStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lot_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_alerts_company_id_alert_type_status_idx"
  ON "inventory_alerts"("company_id", "alert_type", "status");
CREATE INDEX "inventory_alerts_product_id_lot_id_idx"
  ON "inventory_alerts"("product_id", "lot_id");
CREATE INDEX "lot_status_history_company_id_created_at_idx"
  ON "lot_status_history"("company_id", "created_at");
CREATE INDEX "lot_status_history_lot_id_created_at_idx"
  ON "lot_status_history"("lot_id", "created_at");

ALTER TABLE "inventory_alerts"
  ADD CONSTRAINT "inventory_alerts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_alerts_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_alerts_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_alerts_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lot_status_history"
  ADD CONSTRAINT "lot_status_history_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lot_status_history_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lot_status_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "products" SET "lot_strategy" = 'TRACKED' WHERE "lot_strategy" <> 'TRACKED';
INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('inventory.qa.manage', 'inventory', 'qa_manage', 'Aprobar, rechazar y reactivar lotes con control QA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory.approve', 'inventory', 'approve', 'Aprobar movimientos excepcionales de inventario', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" IN ('inventory.qa.manage', 'inventory.approve')
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;