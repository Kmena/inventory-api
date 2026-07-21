DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VisitMotive') THEN
    CREATE TYPE "VisitMotive" AS ENUM ('VENTA', 'COBRO', 'SEGUIMIENTO');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VisitResult') THEN
    CREATE TYPE "VisitResult" AS ENUM ('EXITOSA', 'PENDIENTE', 'SIN_CONTACTO', 'REPROGRAMADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales_routes" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "visit_frequency_days" INTEGER NOT NULL DEFAULT 15,
  "near_limit_days" INTEGER NOT NULL DEFAULT 3,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sales_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sales_route_subzones" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "sales_route_id" BIGINT NOT NULL,
  "subregion_id" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sales_route_subzones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_store_backfill_audit" (
  "id" BIGSERIAL NOT NULL,
  "order_id" BIGINT NOT NULL,
  "company_id" BIGINT NOT NULL,
  "client_id" BIGINT,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_store_backfill_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "route_visit_logs" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "sales_route_id" BIGINT NOT NULL,
  "subregion_id" BIGINT NOT NULL,
  "client_id" BIGINT NOT NULL,
  "client_store_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "motive" "VisitMotive" NOT NULL,
  "result" "VisitResult" NOT NULL,
  "comment" TEXT,
  "suggested_next_visit_at" TIMESTAMP(3),
  "visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "route_visit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sales_route_assignments"
  ADD COLUMN IF NOT EXISTS "sales_route_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "effective_to" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "client_store_id" BIGINT;

WITH bootstrap_sources AS (
  SELECT
    s.id AS subregion_id,
    r.company_id,
    COALESCE(NULLIF(s.route_code, ''), NULLIF(r.route_code, ''), CONCAT('SZ-', s.id::text)) AS route_code,
    CASE
      WHEN COALESCE(NULLIF(s.route_code, ''), NULLIF(r.route_code, '')) IS NULL THEN CONCAT('Ruta ', r.name, ' - ', s.name)
      ELSE CONCAT('Ruta ', COALESCE(NULLIF(s.route_code, ''), NULLIF(r.route_code, '')))
    END AS route_name
  FROM "subregions" s
  INNER JOIN "regions" r ON r.id = s.region_id
)
INSERT INTO "sales_routes" (
  "company_id",
  "code",
  "name",
  "visit_frequency_days",
  "near_limit_days",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  bs.company_id,
  bs.route_code,
  MIN(bs.route_name) AS route_name,
  15,
  3,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM bootstrap_sources bs
WHERE NOT EXISTS (
  SELECT 1
  FROM "sales_routes" sr
  WHERE sr."company_id" = bs.company_id
    AND sr."code" = bs.route_code
)
GROUP BY bs.company_id, bs.route_code;

WITH bootstrap_sources AS (
  SELECT
    s.id AS subregion_id,
    r.company_id,
    COALESCE(NULLIF(s.route_code, ''), NULLIF(r.route_code, ''), CONCAT('SZ-', s.id::text)) AS route_code
  FROM "subregions" s
  INNER JOIN "regions" r ON r.id = s.region_id
)
INSERT INTO "sales_route_subzones" (
  "company_id",
  "sales_route_id",
  "subregion_id",
  "created_at",
  "updated_at"
)
SELECT
  bs.company_id,
  sr.id,
  bs.subregion_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM bootstrap_sources bs
INNER JOIN "sales_routes" sr
  ON sr."company_id" = bs.company_id
 AND sr."code" = bs.route_code
WHERE NOT EXISTS (
  SELECT 1
  FROM "sales_route_subzones" srs
  WHERE srs."sales_route_id" = sr.id
    AND srs."subregion_id" = bs.subregion_id
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales_route_assignments'
      AND column_name = 'subregion_id'
  ) THEN
    EXECUTE $sql$
      WITH bootstrap_sources AS (
        SELECT
          s.id AS subregion_id,
          r.company_id,
          COALESCE(NULLIF(s.route_code, ''), NULLIF(r.route_code, ''), CONCAT('SZ-', s.id::text)) AS route_code
        FROM "subregions" s
        INNER JOIN "regions" r ON r.id = s.region_id
      )
      UPDATE "sales_route_assignments" sra
      SET "sales_route_id" = sr.id
      FROM bootstrap_sources bs
      INNER JOIN "sales_routes" sr
        ON sr."company_id" = bs.company_id
       AND sr."code" = bs.route_code
      WHERE sra."subregion_id" = bs.subregion_id
        AND sra."company_id" = bs.company_id
        AND sra."sales_route_id" IS NULL
    $sql$;
  END IF;
END $$;

UPDATE "sales_route_assignments"
SET "effective_from" = COALESCE("effective_from", "created_at")
WHERE "effective_from" IS NULL;

WITH ranked_assignments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, sales_route_id ORDER BY id ASC) AS row_number
  FROM "sales_route_assignments"
  WHERE "sales_route_id" IS NOT NULL
)
DELETE FROM "sales_route_assignments"
WHERE id IN (
  SELECT id
  FROM ranked_assignments
  WHERE row_number > 1
);

WITH single_store_clients AS (
  SELECT
    client_id,
    MIN(id) AS store_id
  FROM "client_stores"
  WHERE "is_active" = true
  GROUP BY client_id
  HAVING COUNT(*) = 1
)
UPDATE "orders" o
SET "client_store_id" = ssc.store_id
FROM single_store_clients ssc
WHERE o.client_id = ssc.client_id
  AND o.client_store_id IS NULL;

WITH single_primary_store_clients AS (
  SELECT
    client_id,
    MIN(id) AS store_id
  FROM "client_stores"
  WHERE "is_active" = true
    AND "is_primary" = true
  GROUP BY client_id
  HAVING COUNT(*) = 1
)
UPDATE "orders" o
SET "client_store_id" = spsc.store_id
FROM single_primary_store_clients spsc
WHERE o.client_id = spsc.client_id
  AND o.client_store_id IS NULL;

INSERT INTO "order_store_backfill_audit" (
  "order_id",
  "company_id",
  "client_id",
  "reason"
)
SELECT
  o.id,
  o.company_id,
  o.client_id,
  CASE
    WHEN o.client_id IS NULL THEN 'order_without_client'
    WHEN COALESCE(store_context.active_store_count, 0) = 0 THEN 'client_without_active_stores'
    WHEN COALESCE(store_context.active_store_count, 0) = 1 THEN 'single_store_expected_but_not_resolved'
    WHEN COALESCE(store_context.primary_store_count, 0) = 1 THEN 'single_primary_store_expected_but_not_resolved'
    ELSE 'multiple_active_stores_without_safe_match'
  END AS reason
FROM "orders" o
LEFT JOIN (
  SELECT
    client_id,
    COUNT(*) FILTER (WHERE "is_active" = true) AS active_store_count,
    COUNT(*) FILTER (WHERE "is_active" = true AND "is_primary" = true) AS primary_store_count
  FROM "client_stores"
  GROUP BY client_id
) store_context
  ON store_context.client_id = o.client_id
WHERE o.client_store_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "order_store_backfill_audit" audit
    WHERE audit."order_id" = o.id
  );

DO $$
DECLARE
  unresolved_count bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales_route_assignments'
      AND column_name = 'subregion_id'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM "sales_route_assignments" WHERE "sales_route_id" IS NULL' INTO unresolved_count;
    IF unresolved_count > 0 THEN
      RAISE EXCEPTION 'No se puede completar la migracion de rutas: % asignaciones siguen sin sales_route_id', unresolved_count;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'sales_route_assignments_subregion_id_idx'
  ) THEN
    DROP INDEX "sales_route_assignments_subregion_id_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_route_assignments_user_id_subregion_id_key'
  ) THEN
    ALTER TABLE "sales_route_assignments" DROP CONSTRAINT "sales_route_assignments_user_id_subregion_id_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_route_assignments_subregion_id_fkey'
  ) THEN
    ALTER TABLE "sales_route_assignments" DROP CONSTRAINT "sales_route_assignments_subregion_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_route_assignments_sales_route_id_fkey'
  ) THEN
    ALTER TABLE "sales_route_assignments"
    ADD CONSTRAINT "sales_route_assignments_sales_route_id_fkey"
    FOREIGN KEY ("sales_route_id") REFERENCES "sales_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  nullable_flag text;
BEGIN
  SELECT is_nullable
  INTO nullable_flag
  FROM information_schema.columns
  WHERE table_name = 'sales_route_assignments'
    AND column_name = 'sales_route_id';

  IF nullable_flag = 'YES' THEN
    EXECUTE 'ALTER TABLE "sales_route_assignments" ALTER COLUMN "sales_route_id" SET NOT NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales_route_assignments'
      AND column_name = 'subregion_id'
  ) THEN
    ALTER TABLE "sales_route_assignments" DROP COLUMN "subregion_id";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_routes_company_id_code_key"
ON "sales_routes"("company_id", "code");

CREATE INDEX IF NOT EXISTS "sales_routes_company_id_is_active_idx"
ON "sales_routes"("company_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "sales_route_subzones_sales_route_id_subregion_id_key"
ON "sales_route_subzones"("sales_route_id", "subregion_id");

CREATE INDEX IF NOT EXISTS "sales_route_subzones_company_id_idx"
ON "sales_route_subzones"("company_id");

CREATE INDEX IF NOT EXISTS "sales_route_subzones_subregion_id_idx"
ON "sales_route_subzones"("subregion_id");

CREATE UNIQUE INDEX IF NOT EXISTS "sales_route_assignments_user_id_sales_route_id_key"
ON "sales_route_assignments"("user_id", "sales_route_id");

CREATE INDEX IF NOT EXISTS "sales_route_assignments_sales_route_id_idx"
ON "sales_route_assignments"("sales_route_id");

CREATE INDEX IF NOT EXISTS "orders_client_store_id_idx"
ON "orders"("client_store_id");

CREATE UNIQUE INDEX IF NOT EXISTS "order_store_backfill_audit_order_id_key"
ON "order_store_backfill_audit"("order_id");

CREATE INDEX IF NOT EXISTS "order_store_backfill_audit_company_id_idx"
ON "order_store_backfill_audit"("company_id");

CREATE INDEX IF NOT EXISTS "route_visit_logs_company_id_visited_at_idx"
ON "route_visit_logs"("company_id", "visited_at");

CREATE INDEX IF NOT EXISTS "route_visit_logs_sales_route_id_visited_at_idx"
ON "route_visit_logs"("sales_route_id", "visited_at");

CREATE INDEX IF NOT EXISTS "route_visit_logs_client_store_id_visited_at_idx"
ON "route_visit_logs"("client_store_id", "visited_at");

CREATE INDEX IF NOT EXISTS "route_visit_logs_user_id_visited_at_idx"
ON "route_visit_logs"("user_id", "visited_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_routes_company_id_fkey'
  ) THEN
    ALTER TABLE "sales_routes"
    ADD CONSTRAINT "sales_routes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_route_subzones_company_id_fkey'
  ) THEN
    ALTER TABLE "sales_route_subzones"
    ADD CONSTRAINT "sales_route_subzones_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_route_subzones_sales_route_id_fkey'
  ) THEN
    ALTER TABLE "sales_route_subzones"
    ADD CONSTRAINT "sales_route_subzones_sales_route_id_fkey"
    FOREIGN KEY ("sales_route_id") REFERENCES "sales_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_route_subzones_subregion_id_fkey'
  ) THEN
    ALTER TABLE "sales_route_subzones"
    ADD CONSTRAINT "sales_route_subzones_subregion_id_fkey"
    FOREIGN KEY ("subregion_id") REFERENCES "subregions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_client_store_id_fkey'
  ) THEN
    ALTER TABLE "orders"
    ADD CONSTRAINT "orders_client_store_id_fkey"
    FOREIGN KEY ("client_store_id") REFERENCES "client_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_store_backfill_audit_order_id_fkey'
  ) THEN
    ALTER TABLE "order_store_backfill_audit"
    ADD CONSTRAINT "order_store_backfill_audit_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_store_backfill_audit_company_id_fkey'
  ) THEN
    ALTER TABLE "order_store_backfill_audit"
    ADD CONSTRAINT "order_store_backfill_audit_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_store_backfill_audit_client_id_fkey'
  ) THEN
    ALTER TABLE "order_store_backfill_audit"
    ADD CONSTRAINT "order_store_backfill_audit_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_visit_logs_company_id_fkey'
  ) THEN
    ALTER TABLE "route_visit_logs"
    ADD CONSTRAINT "route_visit_logs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_visit_logs_sales_route_id_fkey'
  ) THEN
    ALTER TABLE "route_visit_logs"
    ADD CONSTRAINT "route_visit_logs_sales_route_id_fkey"
    FOREIGN KEY ("sales_route_id") REFERENCES "sales_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_visit_logs_subregion_id_fkey'
  ) THEN
    ALTER TABLE "route_visit_logs"
    ADD CONSTRAINT "route_visit_logs_subregion_id_fkey"
    FOREIGN KEY ("subregion_id") REFERENCES "subregions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_visit_logs_client_id_fkey'
  ) THEN
    ALTER TABLE "route_visit_logs"
    ADD CONSTRAINT "route_visit_logs_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_visit_logs_client_store_id_fkey'
  ) THEN
    ALTER TABLE "route_visit_logs"
    ADD CONSTRAINT "route_visit_logs_client_store_id_fkey"
    FOREIGN KEY ("client_store_id") REFERENCES "client_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_visit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "route_visit_logs"
    ADD CONSTRAINT "route_visit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
