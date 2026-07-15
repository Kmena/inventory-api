ALTER TABLE "client_stores" ADD COLUMN "region_id" BIGINT;
ALTER TABLE "client_stores" ADD COLUMN "subregion_id" BIGINT;

CREATE INDEX "client_stores_region_id_idx" ON "client_stores"("region_id");
CREATE INDEX "client_stores_subregion_id_idx" ON "client_stores"("subregion_id");

ALTER TABLE "client_stores" ADD CONSTRAINT "client_stores_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_stores" ADD CONSTRAINT "client_stores_subregion_id_fkey" FOREIGN KEY ("subregion_id") REFERENCES "subregions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
