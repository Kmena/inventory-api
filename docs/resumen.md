# Resumen ejecutivo

## Recomendación principal

Se recomienda migrar el núcleo transaccional de `Track_sys-master` desde MongoDB hacia PostgreSQL de manera gradual, no mediante un corte total.

## Motivos

- el dominio es altamente relacional
- existe configuración hardcodeada
- hay contraseñas en texto plano
- la conexión a la base de datos está duplicada en modelos
- hay dependencia de estructuras manuales como `next`, `before` y `last`
- el proyecto no está listo todavía para una dockerización sólida sin ordenar primero la configuración

## Prioridad sugerida

1. seguridad y configuración
2. docker para desarrollo
3. esquema SQL inicial
4. migración de usuarios, empresas, clientes, productos y pedidos
5. refactor de backend por capas

## Tecnología recomendada

- **Base de datos:** PostgreSQL
- **ORM/migraciones:** Prisma
- **Contenedores:** Docker + Docker Compose

## Resultado esperado

Una nueva base técnica más mantenible, segura y preparada para despliegues repetibles.
