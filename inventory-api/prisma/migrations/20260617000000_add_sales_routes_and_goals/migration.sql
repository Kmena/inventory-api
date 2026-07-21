CREATE TABLE "sales_route_assignments" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "subregion_id" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sales_route_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_goals" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "title" TEXT NOT NULL,
  "period_label" TEXT,
  "target_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "current_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sales_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_route_assignments_user_id_subregion_id_key"
ON "sales_route_assignments"("user_id", "subregion_id");

CREATE INDEX "sales_route_assignments_company_id_idx"
ON "sales_route_assignments"("company_id");

CREATE INDEX "sales_route_assignments_user_id_idx"
ON "sales_route_assignments"("user_id");

CREATE INDEX "sales_route_assignments_subregion_id_idx"
ON "sales_route_assignments"("subregion_id");

CREATE INDEX "sales_goals_company_id_idx"
ON "sales_goals"("company_id");

CREATE INDEX "sales_goals_user_id_idx"
ON "sales_goals"("user_id");

ALTER TABLE "sales_route_assignments"
ADD CONSTRAINT "sales_route_assignments_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_route_assignments"
ADD CONSTRAINT "sales_route_assignments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_route_assignments"
ADD CONSTRAINT "sales_route_assignments_subregion_id_fkey"
FOREIGN KEY ("subregion_id") REFERENCES "subregions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_goals"
ADD CONSTRAINT "sales_goals_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_goals"
ADD CONSTRAINT "sales_goals_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
