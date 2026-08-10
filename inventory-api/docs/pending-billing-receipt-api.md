# API pendiente: Facturación y recibos automáticos al aprobar pedidos

## Estado: No desarrollado

## Contexto

Cuando un pedido es aprobado por la oficina, el sistema actualmente genera:

1. **Factura interna** (`Invoice`) vinculada al pedido y al cliente.
2. **Pago con estado `PENDING_APPROVAL`** cuando la condición de pago es CONTADO o TRANSFERENCIA.

Sin embargo, el flujo completo de facturación y recibos **requiere una API dedicada que aún no está desarrollada**.

## Requerimiento pendiente

### 1. API de generación de factura fiscal

Al aprobar un pedido, el sistema debe:

- Generar la factura a través de una **API externa de facturación** (no la tabla interna `invoices` actual).
- El número de factura debe ser el emitido por dicha API (consecutivo fiscal real).
- La factura interna debe almacenar la referencia al documento fiscal generado.

### 2. API de generación de recibo de dinero

Cuando se recibe el dinero (especialmente en pedidos de contado):

- El sistema debe generar un **recibo de dinero** a través de la misma API externa o una API complementaria.
- El **número de referencia del pago** (`payment.reference`) debe ser el número del recibo generado por la API.
- El recibo debe quedar vinculado a la factura del pedido.

### 3. Flujo esperado completo

```
Agente crea pedido (CASH)
    ↓
Admin aprueba pedido
    ↓
Sistema reserva stock
    ↓
Sistema llama API de facturación → genera factura fiscal
    ↓
Sistema crea registro Invoice con número fiscal real
    ↓
Agente entrega dinero en oficina
    ↓
Oficina confirma recepción del dinero
    ↓
Sistema llama API de recibos → genera recibo de dinero
    ↓
Sistema crea/actualiza Payment con reference = número de recibo generado
    ↓
Factura se marca como pagada
```

### 4. Estado actual (solución transitoria)

Mientras la API de facturación y recibos no esté disponible:

- La factura se crea internamente con número `INV-{orderId}`.
- El pago de contado se crea con referencia `COBRO-CONTADO-{orderId}` y estado `PENDING_APPROVAL`.
- La oficina verifica y aprueba el cobro manualmente desde **Facturación → Cobros pendientes**.
- No se genera recibo fiscal real.

### 5. Impacto en el código actual

Archivos que deberán modificarse cuando la API esté disponible:

| Archivo | Cambio requerido |
|---|---|
| `src/services/billing-trigger.service.js` | Llamar API de facturación en vez de crear Invoice directamente |
| `src/services/billing-trigger.service.js` | Llamar API de recibos al crear el pago de contado |
| `src/services/payment.service.js` | Actualizar `reference` con el número de recibo de la API |
| `src/services/inventory.service.js` | Coordinar la llamada de facturación al aprobar |
| `src/repositories/invoice.repository.js` | Posible adaptación para almacenar referencia fiscal externa |

### 6. Campos clave

- `Invoice.number` → debe contener el número fiscal emitido por la API de facturación.
- `Payment.reference` → debe contener el número del recibo generado por la API de recibos.
- `PaymentReceipt` (modelo existente) → puede usarse para adjuntar evidencia del recibo físico/digital.

### 7. Reglas de negocio pendientes

- Todo pedido aprobado debe tener factura (fiscal o interna).
- Todo cobro de contado verificado debe generar un recibo.
- El número de referencia del pago es el número del recibo, no un valor interno.
- La oficina debe poder verificar que el agente entregó el dinero antes de generar el recibo.
- El recibo es la evidencia de que el dinero fue recibido.

## Prioridad

Alta — este flujo es necesario para la operación diaria de verificación de cobros en oficina.

## Dependencias

- API externa de facturación electrónica (por definir proveedor/implementación).
- API de generación de recibos de dinero (por definir).
- Configuración fiscal de la empresa (`CompanyFiscalConfig`, `FiscalSequence` — modelos ya existentes en el schema).
