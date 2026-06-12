CREATE TABLE "subregions" (
    "id" BIGSERIAL NOT NULL,
    "region_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "route_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subregions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subregions_region_id_name_key" ON "subregions"("region_id", "name");

ALTER TABLE "subregions" ADD CONSTRAINT "subregions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
