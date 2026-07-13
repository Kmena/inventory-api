# Domain Analysis

## 1. Objective
Analizar el dominio involucrado en la etapa P0 de estabilización enfocada en:
- aislamiento tenant,
- validación de relaciones cross-entity,
- protección de documentos,
- reducción de logging sensible.

## 2. Relevant bounded areas

### 2.1 Customer Management
Responsable de:
- clientes,
- documentos de clientes,
- relaciones básicas de pertenencia a empresa.

Core rule:
- un `Client` pertenece a exactamente una `Company`.

### 2.2 Billing / Invoicing
Responsable de:
- facturas,
- referencias a clientes,
- referencias opcionales a pedidos.

Core rule:
- una `Invoice` pertenece al tenant de su `Client`.

### 2.3 Payments
Responsable de:
- pagos,
- asociación a facturas.

Core rule:
- un `Payment` pertenece al tenant de la `Invoice` asociada.

## 3. Domain entities and ownership

### Company
- Marca el boundary de tenant.
- Fuente de autorización empresarial.

### User
- Actor autenticado con:
  - `role`
  - `permissions`
  - `companyId` opcional
- Regla:
  - si no tiene `companyId`, no participa en flujos empresariales de clientes/facturas/pagos en esta etapa.

### Client
- Tiene `companyId` directo.
- Es el owner tenant de:
  - sus propios datos,
  - sus documentos,
  - la pertenencia tenant de facturas relacionadas.

### ClientDocument
- Pertenece a un `Client`.
- No debe exponerse por ruta pública estática.
- Su acceso debe derivarse de:
  - autenticación,
  - autorización,
  - pertenencia tenant del cliente.

### Invoice
- No tiene `companyId` directo en el esquema actual.
- Su pertenencia tenant se deriva por `clientId`.
- Si tiene `orderId`, ese pedido también debe pertenecer a la misma empresa.

### Payment
- No tiene `companyId` directo en el esquema actual.
- Su pertenencia tenant se deriva por `invoiceId -> invoice.client.companyId`.

## 4. Domain invariants

### INV-001
Un usuario empresarial solo puede operar recursos de su propia empresa.

### INV-002
Un usuario sin `companyId` no puede operar clientes, facturas ni pagos en esta etapa.

### INV-003
El `companyId` de registros empresariales no puede ser controlado por el payload del cliente cuando debe derivarse del actor autenticado.

### INV-004
Una factura solo puede referenciar un cliente de la empresa autenticada.

### INV-005
Si una factura referencia un pedido, el pedido debe pertenecer a la misma empresa autenticada.

### INV-006
Un pago solo puede referenciar una factura de la empresa autenticada.

### INV-007
Un documento de cliente solo puede descargarse dentro del tenant correcto y mediante endpoint autenticado.

## 5. Authorization boundaries
La autorización se compone de dos capas:
1. permisos/rol ya existentes;
2. aislamiento tenant server-side obligatorio.

La segunda capa no puede omitirse aunque el usuario tenga permiso funcional.

## 6. Data derivation rules

### Clients
- Tenant source: `Client.companyId`

### Invoices
- Tenant source: `Invoice.client.companyId`

### Payments
- Tenant source: `Payment.invoice.client.companyId`

### Client documents
- Tenant source: `ClientDocument.client.companyId`

## 7. Risk-sensitive behaviors
- listados globales sin filtro tenant;
- búsquedas por id global;
- updates/deletes por id global;
- payload con `companyId` arbitrario;
- acceso público a `fileUrl`;
- logs excesivos fuera de `development`.

## 8. Domain conclusions
La estabilización P0 no requiere rediseño del modelo.
Sí requiere:
- enforcement consistente de invariantes,
- derivación explícita de tenant en servicios y repositorios,
- privatización del acceso a documentos,
- cobertura mínima de pruebas para evitar regresiones.
