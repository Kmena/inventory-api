# Reglas de negocio definidas - Version 2

Este documento reorganiza las reglas de negocio ya definidas usando una plantilla uniforme. Aplica al producto completo, indicando cuando una regla corresponde al MVP 1 o a fases posteriores.

## RN-001

**Codigo de regla:** RN-001

**Nombre de la regla:** Usuario operativo asociado a empresa

**Area:** Seguridad / Empresas / Usuarios

**Descripcion:**
Todo usuario operativo debe pertenecer a una empresa para operar datos del sistema.

**Objetivo de la regla:**
Evitar acceso cruzado entre empresas y mantener trazabilidad por tenant.

**Condicion:**
Si un usuario intenta crear, consultar, modificar o aprobar informacion operativa.

**Regla:**
El sistema debe validar que el usuario tenga una empresa asociada, excepto usuarios root o perfiles globales autorizados.

**Formula o criterio:**
`usuario.company_id != null` o `usuario.role = ROOT`.

**Responsable de aplicar la regla:**
Sistema / Middleware de autenticacion y permisos.

**Responsable de aprobar excepciones:**
Administrador root.

**Excepciones permitidas:**
Usuarios root o procesos globales autorizados.

**Evidencia requerida:**
Registro de usuario, rol, empresa asociada y bitacora de acceso.

**Frecuencia de revision:**
Mensual o cuando se modifiquen roles globales.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-002

**Codigo de regla:** RN-002

**Nombre de la regla:** Acciones sensibles controladas por permisos

**Area:** Seguridad / Roles / Permisos

**Descripcion:**
Las acciones sensibles se validan por permisos activos y no solo por nombre del rol.

**Objetivo de la regla:**
Evitar que un usuario ejecute operaciones criticas sin autorizacion explicita.

**Condicion:**
Si un usuario intenta crear productos, ingresar inventario, aprobar movimientos, transferir stock o facturar.

**Regla:**
El sistema debe verificar que el rol del usuario tenga el permiso requerido para la accion solicitada.

**Formula o criterio:**
`role_permission.active = true` para `permission.code` requerido por la accion.

**Responsable de aplicar la regla:**
Sistema / Middleware de autorizacion.

**Responsable de aprobar excepciones:**
Administrador de empresa o root, segun el permiso.

**Excepciones permitidas:**
Solo permisos temporales registrados y auditados.

**Evidencia requerida:**
Bitacora de cambio de permisos, usuario que autoriza y fecha.

**Frecuencia de revision:**
Mensual o cuando cambie la estructura de roles.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-003

**Codigo de regla:** RN-003

**Nombre de la regla:** Cliente activo para nuevos pedidos

**Area:** Clientes / Ventas

**Descripcion:**
Un cliente debe estar activo para generar nuevos pedidos.

**Objetivo de la regla:**
Evitar ventas a clientes bloqueados, inactivos o fuera de politica comercial.

**Condicion:**
Si un usuario intenta crear un pedido para un cliente.

**Regla:**
No se debe permitir crear pedidos nuevos si el cliente esta inactivo.

**Formula o criterio:**
`client.is_active = true`.

**Responsable de aplicar la regla:**
Ventas / Sistema.

**Responsable de aprobar excepciones:**
Gerencia comercial o administrador autorizado.

**Excepciones permitidas:**
Reactivacion formal del cliente antes de crear el pedido.

**Evidencia requerida:**
Historial de estado del cliente y autorizacion de reactivacion.

**Frecuencia de revision:**
Mensual o segun politica de actividad configurada.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-004

**Codigo de regla:** RN-004

**Nombre de la regla:** Limite de credito para clientes

**Area:** Credito y Cobro / Ventas

**Descripcion:**
Todo cliente que compre a credito debe tener un limite de credito aprobado antes de facturarle nuevos pedidos.

**Objetivo de la regla:**
Evitar ventas a credito que excedan la capacidad de pago autorizada del cliente.

**Condicion:**
Si el cliente tiene saldo pendiente mas el nuevo pedido mayor a su limite aprobado.

**Regla:**
No se debe aprobar la factura hasta que el cliente pague parte del saldo, se aumente formalmente el limite de credito o gerencia autorice la excepcion.

**Formula o criterio:**
`saldo pendiente + monto del nuevo pedido <= limite de credito aprobado`.

**Responsable de aplicar la regla:**
Facturacion / Credito y Cobro.

**Responsable de aprobar excepciones:**
Gerencia General.

**Excepciones permitidas:**
Solo con autorizacion escrita de gerencia.

**Evidencia requerida:**
Correo, nota interna, autorizacion en sistema o documento firmado.

**Frecuencia de revision:**
Mensual o cuando cambie el comportamiento de pago del cliente.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-005

**Codigo de regla:** RN-005

**Nombre de la regla:** Tienda ligada a subzona valida

**Area:** Clientes / Zonas / Rutas

**Descripcion:**
Toda tienda debe pertenecer a una subzona valida de la zona seleccionada.

**Objetivo de la regla:**
Mantener consistencia territorial para rutas, ventas y analitica.

**Condicion:**
Si se crea o actualiza una tienda con zona y subzona.

**Regla:**
La subzona seleccionada debe pertenecer a la zona indicada y a la misma empresa.

**Formula o criterio:**
`subzone.zone_id = selected_zone_id` y `zone.company_id = user.company_id`.

**Responsable de aplicar la regla:**
Sistema / Administracion de clientes.

**Responsable de aprobar excepciones:**
Administrador de empresa.

**Excepciones permitidas:**
Ninguna; se debe corregir la zona o subzona.

**Evidencia requerida:**
Registro de tienda, zona, subzona y usuario que modifica.

**Frecuencia de revision:**
Trimestral o cuando se reorganicen rutas.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-006

**Codigo de regla:** RN-006

**Nombre de la regla:** Precio general activo para producto vendible

**Area:** Catalogo / Precios / Ventas

**Descripcion:**
Todo producto vendible debe tener un precio general activo antes de agregarse a pedidos.

**Objetivo de la regla:**
Evitar ventas sin base de precio autorizada.

**Condicion:**
Si un usuario intenta agregar un producto vendible a un pedido.

**Regla:**
El sistema debe tomar el precio general vigente y conservarlo historicamente en el detalle del pedido.

**Formula o criterio:**
Existe `ProductPrice` activo y vigente para el producto.

**Responsable de aplicar la regla:**
Ventas / Catalogo / Sistema.

**Responsable de aprobar excepciones:**
Root o administrador con permiso de precios.

**Excepciones permitidas:**
Ajustes comerciales activos y vigentes, sin borrar el precio general.

**Evidencia requerida:**
Precio general usado, ajuste aplicado, usuario, fecha y total calculado.

**Frecuencia de revision:**
Cada cambio de lista de precios.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-007

**Codigo de regla:** RN-007

**Nombre de la regla:** Producto inactivo no vendible en pedidos nuevos

**Area:** Catalogo / Ventas

**Descripcion:**
Un producto terminado inactivo no puede agregarse a pedidos nuevos ni asociarse a promociones nuevas.

**Objetivo de la regla:**
Evitar ventas o promociones de productos fuera del catalogo activo.

**Condicion:**
Si se intenta usar un producto terminado inactivo en una operacion comercial nueva.

**Regla:**
El sistema debe bloquear la seleccion del producto para pedidos, promociones, bonificaciones o regalias nuevas.

**Formula o criterio:**
`product.is_active = true` para operaciones nuevas.

**Responsable de aplicar la regla:**
Sistema / Catalogo / Ventas.

**Responsable de aprobar excepciones:**
Root o administrador de catalogo.

**Excepciones permitidas:**
Solo reactivacion formal del producto.

**Evidencia requerida:**
Historial de activacion/desactivacion y usuario responsable.

**Frecuencia de revision:**
Mensual o antes de publicar catalogos comerciales.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-008

**Codigo de regla:** RN-008

**Nombre de la regla:** Recepcion de compra con lote y movimiento

**Area:** Proveedores / Compras / Inventario

**Descripcion:**
Toda recepcion de compra debe crear o actualizar lotes y registrar movimiento de inventario.

**Objetivo de la regla:**
Mantener trazabilidad desde proveedor hasta inventario disponible.

**Condicion:**
Si una orden de compra aceptada se recibe en bodega.

**Regla:**
La recepcion debe registrar lote interno, lote del manufacturador cuando aplique y movimiento tipo `IN`.

**Formula o criterio:**
Existe `Lot` asociado y `StockMovement.movement_type = IN`.

**Responsable de aplicar la regla:**
Bodega / Compras.

**Responsable de aprobar excepciones:**
Jefatura de bodega o QA segun aplique.

**Excepciones permitidas:**
Recepcion retenida en cuarentena hasta completar datos faltantes.

**Evidencia requerida:**
Orden de compra, recepcion, lote, usuario receptor y movimiento.

**Frecuencia de revision:**
En cada recepcion.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-009

**Codigo de regla:** RN-009

**Nombre de la regla:** Lote no vendible por estado de calidad o vencimiento

**Area:** Inventario / Calidad / Ventas

**Descripcion:**
Un lote vencido, rechazado, fallido en QA o en cuarentena no debe estar disponible para venta.

**Objetivo de la regla:**
Evitar despacho de producto no apto o no liberado.

**Condicion:**
Si un pedido, factura o salida de venta intenta usar un lote.

**Regla:**
El sistema debe bloquear lotes vencidos, rechazados, fallidos en QA o en cuarentena.

**Formula o criterio:**
`lot.status` y `lot.qa_status` deben permitir venta; `expiration_date` no debe estar vencida.

**Responsable de aplicar la regla:**
Bodega / QA / Sistema.

**Responsable de aprobar excepciones:**
QA y gerencia, solo para flujos no comerciales permitidos.

**Excepciones permitidas:**
Reproceso, destruccion o devolucion, nunca venta directa.

**Evidencia requerida:**
Estado del lote, decision QA, alerta y movimiento asociado.

**Frecuencia de revision:**
Diaria o segun politica de vencimientos.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-010

**Codigo de regla:** RN-010

**Nombre de la regla:** Movimientos de inventario autorizados y trazables

**Area:** Inventario / Bodegas

**Descripcion:**
Todo movimiento de inventario debe registrar producto, lote, bodega, cantidad, tipo y usuario.

**Objetivo de la regla:**
Permitir auditoria completa de entradas, salidas, reservas, liberaciones, ajustes y transferencias.

**Condicion:**
Si se registra cualquier movimiento de inventario.

**Regla:**
El sistema no debe permitir movimientos sin trazabilidad minima ni aprobacion requerida.

**Formula o criterio:**
Campos obligatorios: `product_id`, `lot_id`, `warehouse_id`, `quantity`, `movement_type`, `user_id`.

**Responsable de aplicar la regla:**
Bodega / Sistema.

**Responsable de aprobar excepciones:**
Jefatura de bodega.

**Excepciones permitidas:**
Ajustes manuales con motivo obligatorio y permiso especial.

**Evidencia requerida:**
Movimiento, motivo, usuario solicitante, usuario autorizador y fecha.

**Frecuencia de revision:**
Semanal o durante cierre de inventario.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-011

**Codigo de regla:** RN-011

**Nombre de la regla:** Descuento de inventario al facturar

**Area:** Ventas / Facturacion / Inventario

**Descripcion:**
El inventario no se descuenta al registrar ni al aprobar un pedido.

**Objetivo de la regla:**
Evitar rebajas prematuras de inventario antes de la facturacion.

**Condicion:**
Si un pedido se registra o aprueba.

**Regla:**
El inventario fisico se descuenta hasta que se factura, usando la factura como origen del movimiento de salida.

**Formula o criterio:**
`StockMovement.OUT` se genera desde factura, no desde pedido en borrador o aprobado.

**Responsable de aplicar la regla:**
Facturacion / Bodega / Sistema.

**Responsable de aprobar excepciones:**
Gerencia operativa.

**Excepciones permitidas:**
Reservas de stock sin salida fisica, cuando el flujo lo permita.

**Evidencia requerida:**
Factura, item, lote, bodega y movimiento de salida.

**Frecuencia de revision:**
En cada facturacion y cierre de inventario.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-012

**Codigo de regla:** RN-012

**Nombre de la regla:** Historial obligatorio de estados de pedido

**Area:** Ventas / Pedidos

**Descripcion:**
Todo pedido debe conservar historial de cambios de estado.

**Objetivo de la regla:**
Auditar revisiones, aprobaciones, rechazos, facturacion, entrega, pago, vencimiento y cancelacion.

**Condicion:**
Si un pedido cambia de estado.

**Regla:**
Cada cambio debe registrar usuario, fecha, estado anterior, estado nuevo, motivo y comentario cuando aplique.

**Formula o criterio:**
Existe registro en historial por cada transicion de estado.

**Responsable de aplicar la regla:**
Ventas / Sistema.

**Responsable de aprobar excepciones:**
Administrador de empresa.

**Excepciones permitidas:**
Ninguna para cambios de estado criticos.

**Evidencia requerida:**
Historial de estado del pedido.

**Frecuencia de revision:**
Mensual o ante reclamos comerciales.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-013

**Codigo de regla:** RN-013

**Nombre de la regla:** Pagos con comprobante

**Area:** Facturas / Pagos / Tesoreria

**Descripcion:**
Todo pago debe adjuntar comprobante o documento equivalente.

**Objetivo de la regla:**
Evitar pagos sin respaldo y facilitar conciliacion.

**Condicion:**
Si se registra pago total o parcial de una factura.

**Regla:**
El sistema debe exigir comprobante de SINPE, transferencia, ticket de efectivo, factura o documento equivalente.

**Formula o criterio:**
`payment.receipt_ref != null` o comprobante equivalente registrado.

**Responsable de aplicar la regla:**
Tesoreria / Credito y Cobro / Sistema.

**Responsable de aprobar excepciones:**
Administracion financiera.

**Excepciones permitidas:**
Pago pendiente de comprobante con estado temporal y plazo definido.

**Evidencia requerida:**
Comprobante, usuario receptor, fecha, monto y factura relacionada.

**Frecuencia de revision:**
Diaria o en cierre de caja.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-014

**Codigo de regla:** RN-014

**Nombre de la regla:** Configuracion fiscal por empresa SaaS

**Area:** Facturacion fiscal Costa Rica / SaaS

**Descripcion:**
Cada empresa representa un cliente/tenant independiente y debe usar sus propias credenciales fiscales ante Hacienda.

**Objetivo de la regla:**
Evitar cruces de credenciales y asegurar que cada comprobante se emita en nombre de la empresa correcta.

**Condicion:**
Si una empresa emite factura, tiquete, nota de credito, nota de debito u otro comprobante fiscal.

**Regla:**
La empresa no puede emitir documentos fiscales sin configuracion fiscal activa y validada. Un usuario o proceso de una empresa no puede usar credenciales fiscales de otra empresa.

**Formula o criterio:**
`electronic_document.company_id = company_fiscal_config.company_id` y `company_fiscal_config.is_active = true`.

**Responsable de aplicar la regla:**
Facturacion / Sistema.

**Responsable de aprobar excepciones:**
No aplica para cruce de credenciales. La configuracion debe corregirse.

**Excepciones permitidas:**
Ninguna para uso de credenciales de otra empresa.

**Evidencia requerida:**
Configuracion fiscal usada, documento electronico, ambiente, certificado/secret refs y bitacora.

**Frecuencia de revision:**
Cada emision y cuando se renueven credenciales.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-015

**Codigo de regla:** RN-015

**Nombre de la regla:** Consecutivos fiscales sin duplicados

**Area:** Facturacion fiscal Costa Rica

**Descripcion:**
Los consecutivos fiscales se controlan por empresa, tipo de comprobante, sucursal y terminal.

**Objetivo de la regla:**
Evitar duplicidad fiscal y mantener cumplimiento ante Hacienda.

**Condicion:**
Si se genera un comprobante fiscal.

**Regla:**
La asignacion de consecutivo debe ser transaccional, unica y no editable despues de emitir.

**Formula o criterio:**
Unicidad por `company_id + document_type + branch_code + terminal_code + consecutive_number`.

**Responsable de aplicar la regla:**
Sistema / Facturacion.

**Responsable de aprobar excepciones:**
Administracion fiscal.

**Excepciones permitidas:**
No reutilizar consecutivos salvo regla fiscal explicita documentada.

**Evidencia requerida:**
Secuencia fiscal, clave, documento emitido y bitacora de generacion.

**Frecuencia de revision:**
En cada emision fiscal.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-016

**Codigo de regla:** RN-016

**Nombre de la regla:** Documento fiscal aceptado no editable

**Area:** Facturacion fiscal Costa Rica / Notas

**Descripcion:**
Una factura, nota de credito o nota de debito aceptada por Hacienda no debe editarse destructivamente.

**Objetivo de la regla:**
Preservar evidencia historica y cumplimiento fiscal.

**Condicion:**
Si Hacienda acepta un documento electronico.

**Regla:**
Cualquier correccion debe realizarse mediante documento relacionado, nota de credito, nota de debito o flujo fiscal permitido.

**Formula o criterio:**
Si `hacienda_status = ACCEPTED`, bloquear edicion destructiva del documento original.

**Responsable de aplicar la regla:**
Facturacion / Sistema.

**Responsable de aprobar excepciones:**
No aplica para edicion destructiva.

**Excepciones permitidas:**
Correcciones mediante documentos fiscales permitidos.

**Evidencia requerida:**
XML firmado, respuesta de Hacienda, documento relacionado y bitacora.

**Frecuencia de revision:**
En cada correccion fiscal.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-017

**Codigo de regla:** RN-017

**Nombre de la regla:** Productos temporales o limitados con disponibilidad controlada

**Area:** Productos no fisicos / Ventas

**Descripcion:**
Los productos temporales o limitados deben manejar disponibilidad controlada mediante lote virtual.

**Objetivo de la regla:**
Evitar reservas o ventas por encima del cupo o disponibilidad definida.

**Condicion:**
Si se vende o reserva una oferta de producto temporal o limitado.

**Regla:**
Cada oferta debe tener un lote virtual asociado y el sistema no debe permitir reservar o vender por encima de la disponibilidad controlada.

**Formula o criterio:**
`reserved_count <= capacity` y disponibilidad del lote virtual suficiente.

**Responsable de aplicar la regla:**
Ventas / Sistema.

**Responsable de aprobar excepciones:**
Administrador comercial.

**Excepciones permitidas:**
Aumento formal de capacidad o disponibilidad antes de vender.

**Evidencia requerida:**
Oferta, lote virtual, reserva, cliente, pedido y usuario.

**Frecuencia de revision:**
En cada venta o reserva.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-018

**Codigo de regla:** RN-018

**Nombre de la regla:** Afiliaciones con vigencia y cobro recurrente

**Area:** Productos no fisicos / Afiliaciones / Facturacion

**Descripcion:**
Las afiliaciones deben manejar vigencia, estado y cobros recurrentes segun frecuencia configurable por plan.

**Objetivo de la regla:**
Controlar membresias, suscripciones o planes recurrentes con trazabilidad comercial y fiscal.

**Condicion:**
Si se activa una afiliacion para un cliente.

**Regla:**
Cada afiliacion activa debe tener codigo unico en la relacion cliente-plan y conservar trazabilidad hacia el plan y el cliente en facturas recurrentes.

**Formula o criterio:**
`client_affiliation.code` unico y `billing_frequency` definida en el plan.

**Responsable de aplicar la regla:**
Ventas / Facturacion / Sistema.

**Responsable de aprobar excepciones:**
Administrador comercial.

**Excepciones permitidas:**
Suspension o cancelacion documentada de afiliacion.

**Evidencia requerida:**
Plan, cliente, afiliacion, codigo unico, factura recurrente y estado.

**Frecuencia de revision:**
En cada ciclo de facturacion recurrente.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-019

**Codigo de regla:** RN-019

**Nombre de la regla:** Formula maestra con componentes completos

**Area:** Produccion / Formulas

**Descripcion:**
Una formula solo puede ser formula maestra si todos sus componentes existen y el porcentaje total suma 100%.

**Objetivo de la regla:**
Evitar produccion con formulas incompletas o inconsistentes.

**Condicion:**
Si se intenta marcar una formula como maestra.

**Regla:**
El sistema debe validar que todos los componentes existan, esten activos y que los porcentajes sumen 100%.

**Formula o criterio:**
`sum(component.percentage) = 100%` y todos los componentes estan activos.

**Responsable de aplicar la regla:**
Produccion / Sistema.

**Responsable de aprobar excepciones:**
Regente de produccion.

**Excepciones permitidas:**
Formula en borrador o incompleta, no formula maestra.

**Evidencia requerida:**
Formula, componentes, version, usuario y fecha.

**Frecuencia de revision:**
Cada alta o cambio de formula.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026

## RN-020

**Codigo de regla:** RN-020

**Nombre de la regla:** Trazabilidad de acciones criticas

**Area:** Auditoria / Operaciones

**Descripcion:**
Las operaciones criticas deben registrar usuario, fecha y motivo o comentario cuando aplique.

**Objetivo de la regla:**
Permitir auditoria operativa y reconstruccion de decisiones relevantes.

**Condicion:**
Si se ejecuta una operacion critica como aprobacion, rechazo, cambio de permisos, movimiento de inventario, facturacion o cambio de estado.

**Regla:**
El sistema debe registrar una bitacora o historial formal de la accion ejecutada.

**Formula o criterio:**
Existe registro con `user_id`, fecha/hora, entidad afectada, accion y motivo cuando aplique.

**Responsable de aplicar la regla:**
Sistema / Administradores de modulo.

**Responsable de aprobar excepciones:**
No aplica para omitir auditoria.

**Excepciones permitidas:**
Ninguna para acciones criticas.

**Evidencia requerida:**
Bitacora de auditoria o historial de estado.

**Frecuencia de revision:**
Mensual o ante auditorias internas.

**Estado:**
Activa

**Fecha de creacion:**
14/06/2026
