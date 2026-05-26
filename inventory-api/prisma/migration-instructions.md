# Cómo crear la base desde cero

## 1. Configurar variables
Copie:

```bash
cp .env.example .env
```

En Windows PowerShell puede hacerlo manualmente o con:

```powershell
Copy-Item .env.example .env
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Generar cliente Prisma

```bash
npx prisma generate
```

## 4. Crear la migración inicial

```bash
npx prisma migrate dev --name init
```

## 5. Sembrar datos base

```bash
npm run prisma:seed
```

## 6. Levantar API

```bash
npm run dev
```

## Con Docker

```bash
docker compose up --build
```

## Qué crea el seed

- roles base
- empresa demo
- configuración de empresa
- inventario demo
- categorías demo
- regiones demo
- usuario admin demo
- cliente demo
- materia prima demo
- receta demo
- producto terminado demo
