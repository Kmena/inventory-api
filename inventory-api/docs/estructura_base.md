# Estructura base montada desde cero

Como no existen datos previos, se recomienda arrancar desde cero con una base relacional limpia.

## Módulos incluidos en la estructura

- roles
- companies
- company_configs
- users
- regions
- clients
- client_contacts
- client_references
- inventories
- categories
- products
- product_competitors
- suppliers
- product_suppliers
- lots
- stock_movements
- recipes
- recipe_ingredients
- orders
- order_items
- invoices
- payments
- production_orders
- production_items

## Enfoque

Se modeló primero el núcleo del negocio:

1. organización
2. clientes
3. inventario
4. productos
5. recetas
6. pedidos
7. facturación
8. producción

## Beneficio de empezar sin datos

Como no hay datos heredados:

- no hace falta ETL
- no hace falta mapear documentos viejos
- no hace falta convivir con decisiones históricas raras
- se puede diseñar bien desde el inicio

## Ruta recomendada

1. generar migración inicial
2. levantar PostgreSQL
3. sembrar datos mínimos con `seed`
4. construir endpoints por dominio
5. agregar autenticación y permisos
6. conectar front-end nuevo o adaptado
