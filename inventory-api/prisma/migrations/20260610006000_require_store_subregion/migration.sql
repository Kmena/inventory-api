INSERT INTO "regions" ("company_id", "name", "route_code", "created_at", "updated_at")
SELECT missing."company_id", 'Sin zona', 'SIN-ZONA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT client."company_id"
    FROM "client_stores" store
    INNER JOIN "clients" client ON client."id" = store."client_id"
    WHERE store."subregion_id" IS NULL
) missing
WHERE NOT EXISTS (
    SELECT 1
    FROM "regions" region
    WHERE region."company_id" = missing."company_id"
);

INSERT INTO "subregions" ("region_id", "name", "route_code", "created_at", "updated_at")
SELECT region."id", 'Sin subzona', 'SIN-SUBZONA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "regions" region
INNER JOIN (
    SELECT DISTINCT client."company_id"
    FROM "client_stores" store
    INNER JOIN "clients" client ON client."id" = store."client_id"
    WHERE store."subregion_id" IS NULL
) missing ON missing."company_id" = region."company_id"
WHERE region."id" = (
    SELECT first_region."id"
    FROM "regions" first_region
    WHERE first_region."company_id" = region."company_id"
    ORDER BY first_region."id" ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1
    FROM "subregions" subregion
    WHERE subregion."region_id" = region."id"
);

UPDATE "client_stores" store
SET "subregion_id" = (
    SELECT subregion."id"
    FROM "subregions" subregion
    INNER JOIN "regions" region ON region."id" = subregion."region_id"
    INNER JOIN "clients" client ON client."id" = store."client_id"
    WHERE region."company_id" = client."company_id"
    ORDER BY subregion."id" ASC
    LIMIT 1
)
WHERE store."subregion_id" IS NULL;

ALTER TABLE "client_stores" ALTER COLUMN "subregion_id" SET NOT NULL;
