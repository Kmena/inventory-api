INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('recipes.view', 'production', 'view_recipes', 'Ver recetas y versiones', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('recipes.operations.view', 'production', 'view_recipe_ops', 'Consultar formulas operativas congeladas', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('recipes.manage', 'production', 'manage_recipes', 'Gestionar recetas y versiones', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('recipes.approve', 'production', 'approve_recipes', 'Aprobar versiones de receta', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.view', 'production', 'view_orders', 'Ver ordenes de produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.create', 'production', 'create_orders', 'Crear ordenes de produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.approve', 'production', 'approve_orders', 'Aprobar ordenes de produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.execute', 'production', 'execute', 'Ejecutar produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.complete', 'production', 'complete', 'Completar produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.cancel', 'production', 'cancel', 'Cancelar produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('production.override', 'production', 'override', 'Sobrescribir guardas de produccion', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;
