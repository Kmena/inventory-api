# Roles y permisos iniciales

Se definieron 3 roles simples para arrancar.

## admin
Puede hacer todo:

- empresas
- usuarios
- clientes
- productos
- pedidos
- facturas
- pagos
- inventario y movimientos

## sales
Pensado para ventas:

- clientes: crear, ver, editar
- pedidos: crear, ver, editar, aprobar, cancelar
- facturas: crear, ver, editar
- pagos: crear, ver, editar
- productos: solo lectura

## warehouse
Pensado para bodega:

- productos: crear, ver, editar
- pedidos: ver y despachar
- inventario: entradas, ajustes y consulta de movimientos

## Restricciones importantes

- eliminar registros sensibles queda reservado a `admin`
- crear usuarios queda reservado a `admin`
- crear empresas queda reservado a `admin`

## Idea futura

Más adelante se puede reemplazar este modelo simple por permisos granulares, por ejemplo:

- `clients.read`
- `clients.create`
- `orders.approve`
- `inventory.adjust`

Pero por ahora eso sería YAGNI puro. Primero que funcione bien lo esencial.
