CREATE TYPE "WarehouseType" AS ENUM (
    'GENERAL',
    'RAW_MATERIAL',
    'FINISHED_GOODS',
    'PACKAGING',
    'QUARANTINE',
    'RETURNS',
    'PRODUCTION',
    'ADMIN_VIRTUAL',
    'COURSES_VIRTUAL',
    'AFFILIATIONS_VIRTUAL'
);

CREATE TABLE "warehouses" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse_type" "WarehouseType" NOT NULL DEFAULT 'GENERAL',
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "is_sellable_source" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouse_stocks" (
    "id" BIGSERIAL NOT NULL,
    "inventory_id" BIGINT NOT NULL,
    "warehouse_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouses_company_id_code_key" ON "warehouses"("company_id", "code");
CREATE UNIQUE INDEX "warehouses_company_id_name_key" ON "warehouses"("company_id", "name");
CREATE INDEX "warehouses_company_id_warehouse_type_idx" ON "warehouses"("company_id", "warehouse_type");
CREATE UNIQUE INDEX "warehouse_stocks_warehouse_id_product_id_key" ON "warehouse_stocks"("warehouse_id", "product_id");
CREATE INDEX "warehouse_stocks_inventory_id_idx" ON "warehouse_stocks"("inventory_id");
CREATE INDEX "warehouse_stocks_product_id_idx" ON "warehouse_stocks"("product_id");

ALTER TABLE "warehouses"
ADD CONSTRAINT "warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_stocks"
ADD CONSTRAINT "warehouse_stocks_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_stocks"
ADD CONSTRAINT "warehouse_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_stocks"
ADD CONSTRAINT "warehouse_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
