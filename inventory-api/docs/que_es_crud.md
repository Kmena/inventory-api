# ¿Qué es CRUD?

CRUD es una sigla muy usada en desarrollo para las 4 operaciones básicas sobre datos.

## Significado

- **C** = Create -> crear
- **R** = Read -> leer o consultar
- **U** = Update -> actualizar
- **D** = Delete -> eliminar

## Ejemplo con clientes

### Create
Crear un cliente nuevo:

```http
POST /api/clients
```

### Read
Consultar clientes o un cliente específico:

```http
GET /api/clients
GET /api/clients/1
```

### Update
Editar un cliente existente:

```http
PUT /api/clients/1
```

### Delete
Eliminar un cliente:

```http
DELETE /api/clients/1
```

## ¿Por qué importa?

Porque casi todos los módulos de negocio empiezan con eso:

- clientes
- productos
- pedidos
- facturas
- pagos

Primero se hace el CRUD base, luego se agregan reglas más complejas.

## Ojo

Un CRUD no es “todo el sistema”.
Es solo el conjunto mínimo de operaciones para administrar registros.

O sea: es el punto de partida, no la novela completa.
