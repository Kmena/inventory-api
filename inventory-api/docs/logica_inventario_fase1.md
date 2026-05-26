# Lógica de inventario - fase 1

En esta fase se implementó la lógica básica operativa del inventario.

## Objetivos cubiertos

- registrar entradas manuales
- registrar ajustes manuales
- reservar stock al aprobar pedidos
- liberar reserva al cancelar pedidos aprobados
- descontar stock real al despachar pedidos
- registrar movimientos de inventario en bitácora

## Reglas aplicadas

### Pedido en borrador
- no mueve stock
- se puede editar

### Pedido aprobado
- valida stock disponible
- aumenta `reservedQuantity`
- crea movimientos `RESERVE`

### Pedido cancelado
- si estaba aprobado, libera reserva
- crea movimientos `RELEASE`

### Pedido despachado
- baja `quantity`
- baja `reservedQuantity`
- crea movimientos `OUT`

### Entrada manual
- aumenta `quantity`
- opcionalmente crea lote
- crea movimiento `IN`

### Ajuste manual
- sube o baja `quantity`
- opcionalmente toca un lote específico
- crea movimiento `ADJUSTMENT`

## Endpoints nuevos

- `GET /api/inventory/movements`
- `POST /api/inventory/entries`
- `POST /api/inventory/adjustments`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/dispatch`

## Restricciones

- no se permite aprobar si no hay stock disponible suficiente
- no se permite despachar si no hay stock real suficiente
- no se permite editar un pedido si ya no está en borrador
- no se permite eliminar un pedido aprobado o despachado

## Siguiente fase recomendada

- consumo de ingredientes por receta
- producción de producto terminado
- asignación FIFO/FEFO por lote
- recalculo automático de estados de factura y saldo de cliente
