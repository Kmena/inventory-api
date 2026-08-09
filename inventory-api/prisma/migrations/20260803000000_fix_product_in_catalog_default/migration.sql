-- Migration: fix_product_in_catalog_default
--
-- Bug: buildProductWriteData omitia el campo inCatalog, por lo que Prisma
-- usaba el @default(false) de la columna. Todos los productos creados via
-- el formulario admin quedaron con in_catalog = false, haciendolos invisibles
-- para el agente de ventas que filtra por product.inCatalog = true.
--
-- Fix: establece in_catalog = true para todos los productos activos que
-- tengan in_catalog = false (productos afectados por el bug).
-- Productos inactivos se dejan sin cambios (ya no son visibles de todos modos).

UPDATE "products"
SET    "in_catalog" = true
WHERE  "is_active"  = true
AND    "in_catalog" = false;
