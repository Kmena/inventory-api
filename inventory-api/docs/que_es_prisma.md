# ¿Qué es Prisma?

Prisma es una herramienta para trabajar con bases de datos desde Node.js o TypeScript/JavaScript sin escribir SQL manual para todo.

## Dicho simple

Prisma sirve como una **capa intermedia** entre su aplicación y PostgreSQL.

En vez de hacer cosas como:

```sql
SELECT * FROM users WHERE username = 'admin';
```

usted puede hacer en código:

```js
const user = await prisma.user.findUnique({
  where: { username: 'admin' }
});
```

## Partes principales

### 1. `schema.prisma`
Es el archivo donde usted define:
- qué base usa
- cuáles son las tablas
- cuáles son las relaciones
- qué campos tiene cada entidad

Ejemplo:

```prisma
model User {
  id           BigInt  @id @default(autoincrement())
  username     String  @unique
  passwordHash String  @map("password_hash")
}
```

### 2. Prisma Client
Es la librería que Prisma genera para consultar la base desde Node.

Ejemplo:

```js
const users = await prisma.user.findMany();
```

### 3. Migraciones
Prisma puede generar cambios de base de datos versionados.

Ejemplo:

```bash
npx prisma migrate dev --name init
```

Eso crea o actualiza las tablas según el `schema.prisma`.

## ¿Por qué conviene aquí?

Para este proyecto conviene porque:

- evita repetir consultas manuales por todo lado
- deja el modelo de datos centralizado
- facilita migraciones desde cero
- trabaja muy bien con PostgreSQL
- hace más claro el diseño relacional
- ayuda a mantener orden entre código y base

## ¿Prisma reemplaza PostgreSQL?

No.

PostgreSQL sigue siendo la base de datos real.
Prisma es la herramienta que usa la aplicación para hablar con PostgreSQL de forma ordenada.

## Ventajas

- modelo declarativo
- migraciones controladas
- relaciones claras
- menos código repetido
- menos riesgo de inconsistencias tontas

## Cosas a tener claras

- no elimina la necesidad de diseñar bien la base
- no reemplaza reglas de negocio
- no hace magia si el modelo está mal pensado

O sea, Prisma ayuda bastante, pero tampoco bautiza una mala arquitectura y la vuelve santa.
