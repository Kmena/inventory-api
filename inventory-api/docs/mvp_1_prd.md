# MVP 1 - Inventario, proveeduria y ventas basicas

## Objetivo

Construir una primera version operativa que permita administrar clientes, tiendas, zonas, subzonas, rutas, usuarios, productos, bodegas, lotes, proveedores, compras, inventario y ventas basicas, sin incluir produccion ni gestion avanzada de agentes.

El MVP 1 debe dejar una base fuerte de trazabilidad:

```text
Producto
  -> Lote
    -> Bodega
      -> Movimiento
        -> Pedido / Factura interna
```

## Alcance incluido

### Seguridad y usuarios

Incluye:

- empresas
- roles
- usuarios
- permisos basicos por rol
- bitacora minima de acciones criticas

Roles minimos:

- `ROOT`
- `ADMIN`
- `BODEGA`
- `PROVEEDURIA`
- `VENTAS`

Reglas:

- Todo usuario pertenece a una empresa.
- Todo usuario tiene un rol.
- Las operaciones criticas deben registrar usuario y fecha.
- Crear productos, ingresar inventario, aprobar movimientos y facturar deben requerir permiso.

### Clientes, tiendas, zonas, subzonas y rutas

Incluye clientes suficientes para vender y ubicar cada tienda dentro de una estructura territorial minima con rutas comerciales basicas.

Campos minimos de cliente:

- codigo
- nombre comercial
- razon social
- tipo de identificacion
- numero de identificacion
- correo
- telefono
- direccion o referencia
- condicion de pago: contado o credito
- limite de credito
- saldo actual
- estado

Campos minimos de tienda:

- cliente
- subzona
- nombre o alias de tienda
- razon social asociada
- tipo de tienda
- latitud
- longitud
- referencia de ubicacion
- direccion
- horario de atencion
- estado

Campos minimos de trabajador/representante de tienda:

- tienda
- nombre
- identificacion
- cargo
- rol que desempena
- correo
- telefonos
- fecha de cumpleanos u otra fecha importante
- comentario
- estado

Campos minimos de zona:

- codigo unico
- nombre
- estado

Campos minimos de subzona:

- zona
- codigo unico
- nombre
- estado

Campos minimos de ruta:

- codigo unico
- nombre
- descripcion
- subzonas asociadas
- estado

Reglas:

- Un cliente debe estar activo para generar pedidos nuevos.
- El credito puede manejarse en forma basica: limite, saldo y facturas pendientes.
- Un cliente puede tener una o varias tiendas.
- Una tienda debe pertenecer a una subzona.
- Una subzona debe pertenecer a una zona.
- Las rutas agrupan una o varias subzonas.
- La zona, subzona y ruta permiten clasificar ventas desde el MVP 1, aunque no existan agentes todavia.
- Una tienda puede tener varios trabajadores o representantes.
- La asignacion de rutas a agentes, hojas de cobro y seguimiento de campo quedan para etapas posteriores.

### Catalogo de productos

Incluye:

- categorias
- subcategorias
- productos
- precio general
- productos fisicos
- cursos
- afiliaciones

Tipos de producto:

```text
RAW_MATERIAL
CONTAINER
CAP
LABEL
FINISHED
MISC
```

Tipos de producto vendible:

```text
PHYSICAL
COURSE
AFFILIATION
```

Reglas:

- Todo producto debe tener categoria y subcategoria.
- Todo producto vendible debe tener precio general activo.
- Productos fisicos usan lote y bodega fisica.
- Cursos usan bodega virtual de cursos y un lote por curso u oferta.
- Afiliaciones usan bodega virtual de afiliaciones y un lote por tipo o plan de afiliacion.
- El producto inactivo no puede agregarse a ventas nuevas.

### Bodegas, lotes e inventario

Incluye:

- bodegas
- tipos de bodega
- lotes obligatorios
- stock por bodega
- movimientos de inventario
- alertas basicas

Tipos de bodega MVP:

```text
GENERAL
QUARANTINE
FINISHED_GOODS
VIRTUAL_COURSE
VIRTUAL_AFFILIATION
```

Reglas:

- Todo lote pertenece a un producto y a una bodega.
- Todo movimiento de inventario debe referenciar producto, lote, bodega, cantidad, tipo y usuario.
- Solo bodegas con `is_sellable_source = true` pueden alimentar ventas.
- Bodegas virtuales no alimentan movimientos fisicos.
- Un lote vencido, rechazado o en cuarentena no debe estar disponible para venta.
- El sistema debe alertar lotes cercanos a vencimiento.

Estados minimos de lote:

```text
QUARANTINE
APPROVED
REJECTED
EXPIRED
BLOCKED
```

Tipos minimos de movimiento:

```text
IN
OUT
ADJUSTMENT
RESERVE
RELEASE
TRANSFER
```

### Proveeduria

Incluye:

- proveedores
- productos ofrecidos por proveedor
- ordenes de compra
- items de orden de compra
- recepcion de compra
- ingreso a lote e inventario

Reglas:

- Un proveedor puede ofrecer varios productos.
- Un producto puede tener varios proveedores.
- Una orden de compra debe tener estado.
- La recepcion de compra debe crear o actualizar lotes.
- El lote recibido debe registrar lote interno y lote del manufacturador cuando aplique.
- La recepcion debe crear movimiento `IN`.
- La revision QA avanzada queda para fase posterior, pero el lote puede iniciar en `QUARANTINE` y pasar a `APPROVED` por usuario autorizado.

Estados minimos de orden de compra:

```text
DRAFT
SUBMITTED
APPROVED
RECEIVED
CANCELLED
```

### Ventas basicas

Incluye:

- pedidos de venta
- detalle de pedido
- validacion de precio general
- validacion de cliente activo
- validacion de tienda y ruta cuando aplique
- validacion de stock por lote y bodega
- reserva o salida de inventario
- documento comercial interno o factura interna
- pagos basicos

Estados minimos de pedido:

```text
DRAFT
SUBMITTED
ACCEPTED
REJECTED
INVOICED
PAID
CANCELLED
```

Reglas:

- Un pedido debe conservar historial de estados.
- Un pedido debe conservar cliente, tienda y ruta asociada cuando aplique.
- Cada item debe guardar precio general usado, descuento, precio final y total.
- Cada item fisico vendido debe ligar producto, lote y bodega.
- Las ventas de cursos deben crear inscripcion.
- Las ventas de afiliaciones deben crear afiliacion de cliente y siguiente fecha de cobro.
- La factura interna o documento comercial debe preservar los datos historicos de productos, lotes, precios e impuestos.
- Los pagos pueden ser totales o parciales.
- Hacienda directa queda preparada en modelo documental, pero la emision fiscal electronica completa queda para fase posterior si el MVP necesita salir rapido.

### Facturacion fiscal preparada

MVP 1 incluye el espacio de datos, no necesariamente la integracion completa.

Incluye:

- `CompanyFiscalConfig`
- `FiscalSequence`
- `ElectronicDocument`
- `ElectronicDocumentStatusHistory`

Reglas:

- La empresa puede almacenar datos fiscales necesarios para emitir a Hacienda.
- Los consecutivos fiscales deben poder configurarse.
- El sistema debe estar listo para asociar factura, nota de credito o nota de debito con un documento electronico.
- La implementacion real de XML, firma, envio y consulta a Hacienda queda prevista para fase posterior, salvo que se decida convertirla en requisito del MVP 1.

## Fuera de alcance del MVP 1

Queda fuera:

- produccion
- formulas
- BOM
- dispensado
- QA por etapas
- transformacion, llenado, tapado, etiquetado y loteo de produccion
- rendimiento y merma de produccion
- calculo avanzado de costo minimo por formula
- agentes asignados a rutas
- hojas de ruta
- hojas de cobro de agente
- hoja conozca a sus clientes
- metas por agente
- prospectos
- analitica avanzada por rutas
- promociones, bonificaciones y regalias complejas
- integracion completa directa con Hacienda
- notas fiscales avanzadas
- conciliacion de efectivo de agentes
- exportaciones PDF/Excel avanzadas

## Fases posteriores previstas

### Fase 2 - Facturacion electronica directa con Hacienda

Incluye:

- generacion de clave y consecutivo fiscal
- XML oficial
- validacion XSD
- firma XML
- envio a Hacienda
- consulta de estado
- respuesta aceptada/rechazada
- PDF con QR
- envio de XML/PDF al cliente
- nota de credito electronica
- tiquete electronico

Documento guia:

- `docs/facturacion_hacienda_costa_rica.md`

### Fase 3 - Ventas avanzadas, agentes y operacion de rutas

Incluye:

- asignacion de rutas a agentes
- agentes
- supervisores
- hojas de cobro
- hojas de inventario de ruta
- hoja conozca a sus clientes
- bitacora de visitas
- metas por agente
- prospectos
- analitica por zona, subzona y ruta

### Fase 4 - Produccion

Incluye:

- formulas maestras
- versiones de formula
- BOM automatico
- orden de produccion
- dispensado
- QA por etapa
- transformacion
- solicitud de envases, tapas y etiquetas
- llenado
- loteo de producto terminado
- etiquetado
- QA final
- almacenamiento
- rendimiento
- merma
- calculo de precio minimo por costos

## Criterios de aceptacion

El MVP 1 se considera funcional cuando:

- Se pueden crear usuarios y roles.
- Se pueden crear clientes activos.
- Se pueden crear zonas y subzonas con codigo unico.
- Se pueden crear rutas y asociarlas a una o varias subzonas.
- Se pueden crear tiendas por cliente con ubicacion, referencia, horario y subzona.
- Se pueden registrar trabajadores o representantes por tienda.
- Se pueden crear productos con categoria, subcategoria y precio general.
- Se pueden crear proveedores y asociarlos a productos.
- Se pueden crear ordenes de compra.
- Una recepcion de compra crea lote, stock y movimiento `IN`.
- Se puede consultar stock por bodega, producto y lote.
- Se puede crear pedido de venta.
- El pedido valida cliente, producto, precio, lote y stock.
- La venta de producto fisico afecta inventario.
- La venta de curso crea inscripcion y controla cupo.
- La venta de afiliacion crea afiliacion de cliente y proximo cobro.
- Se pueden registrar pagos basicos.
- Se conserva historial de estados de pedidos y movimientos.
- Se dejan configurados los datos fiscales de empresa para una fase posterior de Hacienda.
