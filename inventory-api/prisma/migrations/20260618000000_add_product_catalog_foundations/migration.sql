ALTER TABLE "categories"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "product_subcategories" (
    "id" BIGSERIAL NOT NULL,
    "category_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_subcategories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_prices" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "price_type" TEXT NOT NULL DEFAULT 'GENERAL',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "products"
ADD COLUMN "subcategory_id" BIGINT,
ADD COLUMN "created_by_user_id" BIGINT,
ADD COLUMN "product_type" TEXT NOT NULL DEFAULT 'FINISHED_PRODUCT',
ADD COLUMN "sellable_kind" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "cabys_code" TEXT,
ADD COLUMN "tax_category" TEXT NOT NULL DEFAULT 'VAT_STANDARD',
ADD COLUMN "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 13.0,
ADD COLUMN "density" DECIMAL(14,6),
ADD COLUMN "density_unit" TEXT,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lot_strategy" TEXT NOT NULL DEFAULT 'TRACKED',
ADD COLUMN "kg_conversion_factor" DECIMAL(14,6) NOT NULL DEFAULT 1;

UPDATE "products"
SET
    "kg_conversion_factor" = COALESCE("conversion_factor", 1),
    "tax_category" = CASE WHEN "tax_exempt" THEN 'VAT_EXEMPT' ELSE 'VAT_STANDARD' END,
    "tax_rate" = CASE WHEN "tax_exempt" THEN 0 ELSE 13.0 END,
    "product_type" = CASE
        WHEN EXISTS (
            SELECT 1
            FROM "categories" c
            WHERE c."id" = "products"."category_id" AND c."category_type" = 'MP'
        ) THEN 'RAW_MATERIAL'
        WHEN EXISTS (
            SELECT 1
            FROM "categories" c
            WHERE c."id" = "products"."category_id" AND c."category_type" = 'EM'
        ) THEN 'PACKAGING'
        ELSE 'FINISHED_PRODUCT'
    END,
    "sellable_kind" = CASE
        WHEN EXISTS (
            SELECT 1
            FROM "categories" c
            WHERE c."id" = "products"."category_id" AND c."category_type" = 'PT'
        ) THEN 'STANDARD'
        ELSE 'NON_SELLABLE'
    END;

INSERT INTO "product_prices" ("product_id", "price_type", "amount", "currency", "valid_from", "is_active", "created_at", "updated_at")
SELECT "id", 'GENERAL', "price", COALESCE("currency", 'CRC'), CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "products"
WHERE "price" IS NOT NULL;

CREATE UNIQUE INDEX "product_subcategories_category_id_code_key" ON "product_subcategories"("category_id", "code");
CREATE UNIQUE INDEX "product_subcategories_category_id_name_key" ON "product_subcategories"("category_id", "name");
CREATE INDEX "product_prices_product_id_price_type_is_active_idx" ON "product_prices"("product_id", "price_type", "is_active");

ALTER TABLE "product_subcategories"
ADD CONSTRAINT "product_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_prices"
ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "product_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
